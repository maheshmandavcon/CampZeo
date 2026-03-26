import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
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
    let errors = 0;

    try {
        const expiringTrials = await prisma.organisation.findMany({
            where: {
                isTrial: true,
                trialEndDate: {
                    not: null,
                  
                }
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
                    await sendExpiryEmail(user.email, org.name, "Free Trial", org.trialEndDate, daysRemaining);
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
                endDate: {
                    not: null
                }
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
                    await sendExpiryEmail(
                        user.email, 
                        sub.organisation.name, 
                        sub.plan?.name || "Paid Plan", 
                        sub.endDate, 
                        daysRemaining,
                        sub.autoRenew
                    );
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

async function sendExpiryEmail(
    to: string, 
    orgName: string, 
    planName: string, 
    expiryDate: Date, 
    daysRemaining: number,
    autoRenew: boolean = false
) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campzeo.com';
    const renewalUrl = `${appUrl}/organisation/billing`;
    const formattedExpiry = expiryDate.toLocaleDateString();

    const subject = `Action Required: Your ${planName} for ${orgName} expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`;
    
    let autoPayMessage = "";
    if (autoRenew) {
        autoPayMessage = `
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold;">Auto-Pay is Enabled</p>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Your plan will be automatically renewed on ${formattedExpiry}. Please ensure your payment method has sufficient funds.</p>
            </div>
        `;
    }

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <div style="text-align: center; padding: 20px 0;">
                <img src="${appUrl}/logo-1.png" alt="CampZeo" style="height: 50px;">
            </div>
            <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <div style="background-color: ${daysRemaining === 1 ? '#fee2e2' : '#fef3c7'}; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; color: ${daysRemaining === 1 ? '#991b1b' : '#92400e'};">Plan Expiring Soon</h2>
                </div>
                <div style="padding: 30px;">
                    <p>Hi there,</p>
                    <p>This is a reminder that your <strong>${planName}</strong> for <strong>${orgName}</strong> is set to expire in <strong>${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}</strong> on <strong>${formattedExpiry}</strong>.</p>
                    
                    ${autoPayMessage}

                    <p>To ensure uninterrupted service and keep managing your social media effectively, please renew your plan now.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${renewalUrl}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Pay Now & Renew
                        </a>
                    </div>

                    <p style="font-size: 14px; color: #666;">If you have already renewed or upgraded, please ignore this email.</p>
                </div>
            </div>
            <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
                &copy; ${new Date().getFullYear()} CampZeo. All rights reserved.<br>
                This is an automated message regarding your subscription.
            </div>
        </div>
    `;

    return sendEmail({ to, subject, html });
}
