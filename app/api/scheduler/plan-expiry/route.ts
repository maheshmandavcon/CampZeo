import { prisma } from "@/lib/prisma";
import { sendPlanExpiryEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { logInfo, logError } from "@/lib/audit-logger";


export async function GET(req: Request) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
        return new Response("Unauthorized", { status: 401 });
    }

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const threeDaysStr = formatDate(threeDaysFromNow);
    const oneDayStr = formatDate(oneDayFromNow);

    let notificationsSent = 0;

    try {
        const expiringTrials = await prisma.organisation.findMany({
            where: {
                isTrial: true,
                trialEndDate: { not: null }
            },
            include: {
                users: {
                    where: { role: 'ORGANISATION_USER' },
                    take: 1
                }
            }
        });

        for (const org of expiringTrials) {
            if (!org.trialEndDate) continue;
            
            const expiryStr = formatDate(org.trialEndDate);
            const daysRemaining = expiryStr === threeDaysStr ? 3 : (expiryStr === oneDayStr ? 1 : null);

            if (daysRemaining) {
                const user = org.users[0];
                if (user?.email) {
                    await sendPlanExpiryEmail({
                        email: user.email,
                        orgName: org.name,
                        planName: "Free Trial",
                        expiryDate: org.trialEndDate,
                        daysRemaining: daysRemaining
                    });
                    notificationsSent++;
                    
                    await prisma.notification.create({
                        data: {
                            message: `Sent ${daysRemaining}-day trial expiry reminder to ${org.name}`,
                            type: 'PLAN_EXPIRY',
                            organisationId: org.id,
                            isSuccess: true
                        }
                    });
                }
            }
        }

        const expiringSubscriptions = await prisma.subscription.findMany({
            where: {
                status: 'ACTIVE',
                endDate: { not: null }
            },
            include: {
                organisation: {
                    include: {
                        users: {
                            where: { role: 'ORGANISATION_USER' },
                            take: 1
                        }
                    }
                },
                plan: true
            }
        });

        for (const sub of expiringSubscriptions) {
            if (!sub.endDate) continue;

            const expiryStr = formatDate(sub.endDate);
            const daysRemaining = expiryStr === threeDaysStr ? 3 : (expiryStr === oneDayStr ? 1 : null);

            if (daysRemaining) {
                const user = sub.organisation.users[0];
                if (user?.email) {
                    await sendPlanExpiryEmail({
                        email: user.email,
                        orgName: sub.organisation.name,
                        planName: sub.plan?.name || "Paid Plan",
                        expiryDate: sub.endDate,
                        daysRemaining: daysRemaining,
                        autoRenew: sub.autoRenew
                    });
                    notificationsSent++;

                    await prisma.notification.create({
                        data: {
                            message: `Sent ${daysRemaining}-day plan expiry reminder to ${sub.organisation.name}`,
                            type: 'PLAN_EXPIRY',
                            organisationId: sub.organisationId,
                            isSuccess: true
                        }
                    });
                }
            }
        }

        await logInfo(`Plan expiry scheduler completed. Notifications sent: ${notificationsSent}`, {
            action: "plan_expiry_scheduler",
            notificationsSent
        });

        return NextResponse.json({
            success: true,
            notificationsSent,
            message: `Processed plan expiries. Sent ${notificationsSent} notifications.`
        });

    } catch (error: any) {
        console.error("Error in plan expiry scheduler:", error);
        await logError("Plan expiry scheduler failed", { 
            action: "plan_expiry_scheduler",
            error: error.message 
        });
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
