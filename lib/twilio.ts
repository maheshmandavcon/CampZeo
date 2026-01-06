import twilio from 'twilio';
import { prisma } from './prisma';

async function getTwilioConfig() {
    try {
        const configs = await prisma.adminPlatformConfiguration.findMany({
            where: {
                key: { in: ['WHATSAPP_ACCOUNT_SID', 'WHATSAPP_AUTH_TOKEN', 'WHATSAPP_NUMBER', 'SMS_NUMBER'] }
            }
        });

        const accountSid = configs.find(c => c.key === 'WHATSAPP_ACCOUNT_SID')?.value;
        const authToken = configs.find(c => c.key === 'WHATSAPP_AUTH_TOKEN')?.value;
        const twilioNumber = configs.find(c => c.key === 'WHATSAPP_NUMBER')?.value;
        const twilioSMSNumber = configs.find(c => c.key === 'SMS_NUMBER')?.value;

        return { accountSid, authToken, twilioNumber, twilioSMSNumber };
    } catch (error) {
        console.error("Failed to fetch Twilio config:", error);
        return { accountSid: null, authToken: null, twilioNumber: null, twilioSMSNumber: null };
    }
}

// import { checkMessageLimit, incrementMessageUsage } from './usage';

export async function sendSms(to: string, body: string, organisationId?: number) {
    try {
        // if (organisationId) {
        //     console.log(`Checking SMS limit for organisation ${organisationId}`);
        //     const allowed = await checkMessageLimit(organisationId, 'SMS');
        //     if (!allowed) {
        //         console.error(`[SMS] Limit exceeded for organisation ${organisationId}`);
        //         return null;
        //     }
        // }

        const { accountSid, authToken, twilioNumber, twilioSMSNumber } = await getTwilioConfig();
        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }

        const client = twilio(accountSid ?? undefined, authToken ?? undefined);
        const message = await client.messages.create({
            body: body,
            from: twilioSMSNumber ?? undefined,
            to: formattedNumber,
        });
        console.log(`SMS sent to ${formattedNumber}: ${message.sid}`);

        // if (organisationId && message.sid) {
        //     await incrementMessageUsage(organisationId, 'SMS');
        // }

        return message;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return null;
    }
}

export async function sendWhatsapp(to: string, body: string, mediaUrl?: string | string[], organisationId?: number) {
    try {
        // if (organisationId) {
        //     const allowed = await checkMessageLimit(organisationId, 'WHATSAPP');
        //     if (!allowed) {
        //         console.error(`[WhatsApp] Limit exceeded for organisation ${organisationId}`);
        //         return null;
        //     }
        // }

        const { accountSid, authToken, twilioNumber, twilioSMSNumber } = await getTwilioConfig();
        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }

        const client = twilio(accountSid ?? undefined, authToken ?? undefined);
        const message = await client.messages.create({
            body: body,
            from: twilioNumber ? `whatsapp:${twilioNumber}` : undefined,
            to: `whatsapp:${formattedNumber}`,
            mediaUrl: mediaUrl ? (Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl]) : undefined,
        });

        console.log(`✅ WhatsApp sent to ${formattedNumber}`);

        // if (organisationId && message.sid) {
        //     await incrementMessageUsage(organisationId, 'WHATSAPP');
        // }

        return message;
    } catch (error: any) {
        console.error(`❌ Error sending WhatsApp to ${to}:`);
        console.error(`[WhatsApp] Error code: ${error.code || 'N/A'}`);
        console.error(`[WhatsApp] Error message: ${error.message || 'Unknown error'}`);
        if (error.moreInfo) {
            console.error(`[WhatsApp] More info: ${error.moreInfo}`);
        }
        console.error(`[WhatsApp] Full error:`, error);
        return null;
    }
}
