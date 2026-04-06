import twilio from 'twilio';
import { prisma } from './prisma';

export async function getTwilioConfig() {
    try {
        const configs = await prisma.adminPlatformConfiguration.findMany({
            where: {
                key: { in: ['WHATSAPP_ACCOUNT_SID', 'WHATSAPP_AUTH_TOKEN', 'WHATSAPP_NUMBER', 'SMS_NUMBER', 'SMS_ACCOUNT_SID', 'SMS_AUTH_TOKEN', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'] }
            }
        });

        const whatsappAccountSid = configs.find(c => c.key === 'WHATSAPP_ACCOUNT_SID')?.value || configs.find(c => c.key === 'TWILIO_ACCOUNT_SID')?.value;
        const whatsappAuthToken = configs.find(c => c.key === 'WHATSAPP_AUTH_TOKEN')?.value || configs.find(c => c.key === 'TWILIO_AUTH_TOKEN')?.value;
        const twilioNumber = configs.find(c => c.key === 'WHATSAPP_NUMBER')?.value || configs.find(c => c.key === 'TWILIO_PHONE_NUMBER')?.value;
        const twilioSMSNumber = configs.find(c => c.key === 'SMS_NUMBER')?.value || configs.find(c => c.key === 'TWILIO_PHONE_NUMBER')?.value;

        const smsAccountSid = configs.find(c => c.key === 'SMS_ACCOUNT_SID')?.value || configs.find(c => c.key === 'TWILIO_ACCOUNT_SID')?.value || whatsappAccountSid;
        const smsAuthToken = configs.find(c => c.key === 'SMS_AUTH_TOKEN')?.value || configs.find(c => c.key === 'TWILIO_AUTH_TOKEN')?.value || whatsappAuthToken;

        return { whatsappAccountSid, whatsappAuthToken, smsAccountSid, smsAuthToken, twilioNumber, twilioSMSNumber };
    } catch (error) {
        console.error("Failed to fetch Twilio config:", error);
        return { whatsappAccountSid: null, whatsappAuthToken: null, smsAccountSid: null, smsAuthToken: null, twilioNumber: null, twilioSMSNumber: null };
    }
}
export function replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value || '');
    }
    return result;
}

export async function sendRawSms(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
        const { smsAccountSid, smsAuthToken, twilioSMSNumber } = await getTwilioConfig();
        if (!smsAccountSid || !smsAuthToken) return { success: false, error: 'Twilio SMS credentials missing' };

        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }

        const client = twilio(smsAccountSid, smsAuthToken);
        const result = await client.messages.create({
            body,
            from: twilioSMSNumber ?? undefined,
            to: formattedNumber,
        });

        return { success: true, sid: result.sid };
    } catch (error: any) {
        console.error('Error in sendRawSms:', error);
        return { success: false, error: error.message || 'Error sending' };
    }
}

export async function sendRawWhatsapp(to: string, body: string, mediaUrl?: string | string[]): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
        const { whatsappAccountSid, whatsappAuthToken, twilioNumber } = await getTwilioConfig();
        if (!whatsappAccountSid || !whatsappAuthToken || !twilioNumber) return { success: false, error: 'Twilio WhatsApp credentials missing' };

        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }

        const client = twilio(whatsappAccountSid, whatsappAuthToken);
        const result = await client.messages.create({
            body,
            from: `whatsapp:${twilioNumber}`,
            to: `whatsapp:${formattedNumber}`,
            mediaUrl: mediaUrl ? (Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl]) : undefined,
        });

        return { success: true, sid: result.sid };
    } catch (error: any) {
        console.error(`❌ Error in sendRawWhatsapp to ${to}:`, error);
        return { success: false, error: error.message || 'Error sending' };
    }
}
