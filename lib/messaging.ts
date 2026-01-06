import { sendEmail as sendEmailBase } from './email';
import { sendSms, sendWhatsapp } from './twilio';

/**
 * Helper functions for the scheduler to send messages
 */

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
    await sendEmailBase(params);
}

interface SendSMSParams {
    to: string;
    message: string;
}

export async function sendSMS(params: SendSMSParams): Promise<void> {
    await sendSms(params.to, params.message);
}

interface SendWhatsAppParams {
    to: string;
    message: string;
    mediaUrls?: string[];
}

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<void> {
    await sendWhatsapp(params.to, params.message, params.mediaUrls);
}
