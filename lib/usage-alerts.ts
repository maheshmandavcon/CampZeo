import { prisma } from './prisma';
import { sendEmail } from './email';
import { sendRawSms, sendRawWhatsapp } from './twilio-client';

export async function checkAndSendUsageAlert(
    organisationId: number,
    service: 'SMS' | 'WHATSAPP'
) {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { organisationId },
            include: { organisation: true }
        });

        if (!wallet) return;

        const available = service === 'SMS' ? wallet.smsCreditsAvailable : wallet.whatsappCreditsAvailable;
        const used = service === 'SMS' ? wallet.smsCreditsUsed : wallet.whatsappCreditsUsed;
        const total = available + used;

        if (total === 0) return;

        const usagePercent = (used / total) * 100;
        let threshold = 0;

        if (usagePercent >= 100) threshold = 100;
        else if (usagePercent >= 80) threshold = 80;
        else if (usagePercent >= 50) threshold = 50;

        if (threshold === 0) return;

        const recentNotif = await prisma.notification.findFirst({
            where: {
                organisationId,
                category: `USAGE_ALERT_${service}_${threshold}`,
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });

        if (recentNotif) return;

        const orgName = wallet.organisation.name;
        const ownerEmail = wallet.organisation.email;
        const ownerPhone = wallet.organisation.phone;

        const subject = `CampZeo Alert: ${service} Usage Limit reached (${threshold}%)`;
        const message = threshold === 100 
            ? `Your ${service} credits for ${orgName} have been fully exhausted. Please recharge to continue using the service.`
            : `Your ${service} usage for ${orgName} has reached ${threshold}% of your current credits. Please consider recharging soon to avoid service interruption.`;

        await prisma.notification.create({
            data: {
                organisationId,
                message,
                type: 'USAGE_ALERT',
                category: `USAGE_ALERT_${service}_${threshold}`,
                isSuccess: threshold < 100
            }
        });

        if (ownerEmail) {
            await sendEmail({
                to: ownerEmail,
                subject,
                html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: ${threshold === 100 ? '#e11d48' : '#f59e0b'};">${subject}</h2>
                    <p>${message}</p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/organisation/billing" style="display: inline-block; padding: 10px 20px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">Recharge Credits</a>
                </div>`,
                text: message
            });
        }

        if (ownerPhone && threshold >= 80) {
            await sendRawSms(ownerPhone, message);
            await sendRawWhatsapp(ownerPhone, message);
        }

        console.log(`✅ Usage alert (${threshold}%) sent for ${orgName} (${service})`);
    } catch (error) {
        console.error("Error in checkAndSendUsageAlert:", error);
    }
}
