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

export async function sendSms(to: string, body: string, organisationId?: number): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
        const { accountSid, authToken, twilioNumber, twilioSMSNumber } = await getTwilioConfig();
        
        if (!accountSid || !authToken) {
            return { success: false, error: 'Twilio credentials missing' };
        }

        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }
        console.log("📤 Sending SMS:");
        console.log("TO:", formattedNumber);
        console.log("FROM (Twilio):", twilioSMSNumber);

        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
            body: body,
            from: twilioSMSNumber ?? undefined,
            to: formattedNumber,
        });
        console.log(`SMS sent to ${formattedNumber}: ${message.sid}`);
  
        return { success: true, sid: message.sid };
    } catch (error: any) {
        console.error('Error sending SMS:', error);
        return { 
            success: false, 
            error: error.message || 'Unknown error sending SMS' 
        };
    }
}

export async function sendWhatsapp(to: string, body: string, mediaUrl?: string | string[], organisationId?: number): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
        const { accountSid, authToken, twilioNumber } = await getTwilioConfig();
        
        if (!accountSid || !authToken || !twilioNumber) {
            return { success: false, error: 'Twilio credentials missing' };
        }

        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }

        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
            body: body,
            from: `whatsapp:${twilioNumber}`,
            to: `whatsapp:${formattedNumber}`,
            mediaUrl: mediaUrl ? (Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl]) : undefined,
        });

        console.log(`✅ WhatsApp sent to ${formattedNumber}: ${message.sid}`);

        return { success: true, sid: message.sid };
    } catch (error: any) {
        console.error(`❌ Error sending WhatsApp to ${to}:`, error);
        return { 
            success: false, 
            error: error.message || 'Unknown error sending WhatsApp' 
        };
    }
}
