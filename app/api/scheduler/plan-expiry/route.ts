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
                        status: "ACTIVE",
                    },
                },
            },
            include: {
                users: {
                    where: { role: "ORGANISATION_USER" },
                },
                notifications: {
                    where: {
                        type: "PLAN_EXPIRY",
                        createdAt: { gte: threeDaysAgo },
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

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

            if (alreadySent) continue;

            const user = org.users[0];
            if (user?.email) {
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
                status: "ACTIVE",
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
                        users: {
                            where: { role: "ORGANISATION_USER" },
                        },
                        notifications: {
                            where: {
                                type: "PLAN_EXPIRY",
                                createdAt: { gte: threeDaysAgo },
                            },
                            orderBy: { createdAt: "desc" },
                        },
                    },
                },
                plan: true,
            },
        });

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

            if (alreadySent) continue;

            const user = sub.organisation.users[0];
            if (user?.email) {
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