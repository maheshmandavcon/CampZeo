import { prisma } from "@/lib/prisma";
import { sendPlanExpiryEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { logInfo, logError } from "@/lib/audit-logger";

export async function GET(req: Request) {
    const authHeader = req.headers.get("Authorization");
    if (
        authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
        process.env.NODE_ENV === "production"
    ) {
        return new Response("Unauthorized", { status: 401 });
    }

    const now = new Date();
    const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    let notificationsSent = 0;

    try {

        const expiringTrials = await prisma.organisation.findMany({
            where: {
                isTrial: true,
                isDeleted: false,
                isApproved: true,
                trialEndDate: {
                    not: null,
                    gte: now,
                    lte: fourDaysFromNow,
                },

                subscriptions: {
                    none: {
                        status: {
                            in: ["ACTIVE", "active", "COMPLETED"],
                        },
                    },
                },
            },
            include: {
                users: true, // Fetch all users to find a fallback if no ORGANISATION_USER exists
                notifications: {
                    where: {
                        type: "PLAN_EXPIRY",
                        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // Use 24h window for deduplication
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        console.log(`[PlanExpiry] Found ${expiringTrials.length} expiring trials`);

        for (const org of expiringTrials) {
            if (!org.trialEndDate) continue;

            const msDiff = org.trialEndDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

            let milestone: number | null = null;
            if (daysRemaining <= 1) {
                milestone = 1;
            } else if (daysRemaining <= 3) {
                milestone = 3;
            }

            if (milestone === null) continue;

            const alreadySent = org.notifications.some(
                (n) =>
                    n.message.includes(`${milestone}-day`) &&
                    n.type === "PLAN_EXPIRY"
            );

            if (alreadySent) {
                console.log(`[PlanExpiry] Notification already sent for trial org ${org.name} milestone ${milestone}-day`);
                continue;
            }

            const organisationUser = org.users.find(u => u.role === "ORGANISATION_USER");
            const user = organisationUser || org.users[0];

            if (user?.email) {
                console.log(`[PlanExpiry] Sending ${milestone}-day trial expiry mail to ${user.email} (Org: ${org.name}, Role: ${user.role})`);
                await sendPlanExpiryEmail({
                    email: user.email,
                    orgName: org.name,
                    planName: "FREE_TRIAL",
                    expiryDate: org.trialEndDate,
                    daysRemaining,
                });
                notificationsSent++;

                await prisma.notification.create({
                    data: {
                        message: `${milestone}-day trial expiry reminder to ${org.name} (${daysRemaining} days left). Please upgrade your plan to continue using our services.`,
                        type: "PLAN_EXPIRY",
                        organisationId: org.id,
                        isSuccess: true,
                    },
                });
            }
        }

        const expiringSubscriptions = await prisma.subscription.findMany({
            where: {
                status: {
                    in: ["ACTIVE", "active", "COMPLETED"],
                },
                endDate: {
                    not: null,
                    gte: now,
                    lte: fourDaysFromNow,
                },
                organisation: {
                    isDeleted: false,
                    isApproved: true,
                    isTrial: false,
                },
            },
            include: {
                organisation: {
                    include: {
                        users: true, 
                        notifications: {
                            where: {
                                type: "PLAN_EXPIRY",
                                createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, 
                            },
                            orderBy: { createdAt: "desc" },
                        },
                    },
                },
                plan: true,
            },
        });

        console.log(`[PlanExpiry] Found ${expiringSubscriptions.length} expiring subscriptions`);

        for (const sub of expiringSubscriptions) {
            if (!sub.endDate) continue;

            const msDiff = sub.endDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

            let milestone: number | null = null;
            if (daysRemaining <= 1) {
                milestone = 1;
            } else if (daysRemaining <= 3) {
                milestone = 3;
            }

            if (milestone === null) continue;

            const alreadySent = sub.organisation.notifications.some(
                (n) =>
                    n.message.includes(`${milestone}-day`) &&
                    n.type === "PLAN_EXPIRY"
            );

            if (alreadySent) {
                console.log(`[PlanExpiry] Notification already sent for subscription org ${sub.organisation.name} milestone ${milestone}-day`);
                continue;
            }

            // Fallback: Pick any user if no ORGANISATION_USER exists
            const organisationUser = sub.organisation.users.find(u => u.role === "ORGANISATION_USER");
            const user = organisationUser || sub.organisation.users[0];

            if (user?.email) {
                console.log(`[PlanExpiry] Sending ${milestone}-day subscription expiry mail to ${user.email} (Org: ${sub.organisation.name}, Role: ${user.role})`);
                await sendPlanExpiryEmail({
                    email: user.email,
                    orgName: sub.organisation.name,
                    planName: sub.plan?.name || "Paid Plan",
                    expiryDate: sub.endDate,
                    daysRemaining,
                    autoRenew: sub.autoRenew,
                });
                notificationsSent++;

                await prisma.notification.create({
                    data: {
                        message: `${milestone}-day plan expiry reminder to ${sub.organisation.name} (${daysRemaining} days left). Please upgrade your plan to continue using our services.`,
                        type: "PLAN_EXPIRY",
                        organisationId: sub.organisationId,
                        isSuccess: true,
                    },
                });
            }
        }

        await logInfo(
            `Plan expiry scheduler completed. Notifications sent: ${notificationsSent}`,
            {
                action: "plan_expiry_scheduler",
                notificationsSent,
            }
        );

        return NextResponse.json({
            success: true,
            notificationsSent,
            message: `Processed plan expiries. Sent ${notificationsSent} notifications.`,
        });
    } catch (error: any) {
        console.error("Error in plan expiry scheduler:", error);
        await logError("Plan expiry scheduler failed", {
            action: "plan_expiry_scheduler",
            error: error.message,
        });
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}