import twilio from 'twilio';
import { prisma } from './prisma';

async function getTwilioConfig() {
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

/**
 * Replace variables like {{name}} with actual values
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value || '');
    }
    return result;
}

/**
 * Deduct credits from the organization's wallet and log the transaction.
 * Uses an atomic check+decrement to prevent race conditions under concurrent sends.
 */
async function deductCredits(
    organisationId: number, 
    amount: number, 
    service: 'SMS' | 'WHATSAPP', 
    campaignId?: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Atomic: check balance + decrement in a single interactive transaction.
            // updateMany with a WHERE condition ensures no over-deduction.
            const creditField = service === 'SMS' ? 'smsCreditsAvailable' : 'whatsappCreditsAvailable';

            const updated = await tx.wallet.updateMany({
                where: {
                    organisationId,
                    [creditField]: { gte: amount }
                },
                data: {
                    smsCreditsAvailable: service === 'SMS' ? { decrement: amount } : undefined,
                    smsCreditsUsed: service === 'SMS' ? { increment: amount } : undefined,
                    whatsappCreditsAvailable: service === 'WHATSAPP' ? { decrement: amount } : undefined,
                    whatsappCreditsUsed: service === 'WHATSAPP' ? { increment: amount } : undefined,
                }
            });

            if (updated.count === 0) {
                // Either wallet doesn't exist or insufficient credits
                const wallet = await tx.wallet.findUnique({ where: { organisationId } });
                if (!wallet) return { success: false as const, error: 'Wallet not found' };
                const available = service === 'SMS' ? wallet.smsCreditsAvailable : wallet.whatsappCreditsAvailable;
                return { success: false as const, error: `Insufficient ${service} credits. Available: ${available}, Required: ${amount}` };
            }

            // Log the transaction
            const wallet = await tx.wallet.findUnique({ where: { organisationId } });
            if (wallet) {
                await tx.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        amount,
                        type: 'DEBIT',
                        service,
                        description: `Sent ${amount} ${service}${campaignId ? ` for campaign #${campaignId}` : ''}`,
                        campaignId
                    }
                });
            }

            return { success: true as const };
        });

        return result;
    } catch (error: any) {
        console.error(`Failed to deduct credits:`, error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}

/**
 * Refund credits back to the wallet if a send fails.
 * Uses an interactive transaction for consistency.
 */
async function refundCredits(
    organisationId: number, 
    amount: number, 
    service: 'SMS' | 'WHATSAPP',
    campaignId?: number
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({
                where: { organisationId }
            });

            if (!wallet) throw new Error('Wallet not found');

            await tx.wallet.update({
                where: { organisationId },
                data: {
                    smsCreditsAvailable: service === 'SMS' ? { increment: amount } : undefined,
                    smsCreditsUsed: service === 'SMS' ? { decrement: amount } : undefined,
                    whatsappCreditsAvailable: service === 'WHATSAPP' ? { increment: amount } : undefined,
                    whatsappCreditsUsed: service === 'WHATSAPP' ? { decrement: amount } : undefined,
                }
            });

            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    type: 'REFUND',
                    service,
                    description: `Refund for failed ${service}${campaignId ? ` in campaign #${campaignId}` : ''}`,
                    campaignId
                }
            });
        });

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to refund credits:`, error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}

export async function sendSms(
    to: string, 
    body: string, 
    organisationId?: number, 
    campaignId?: number,
    variables?: Record<string, string>
): Promise<{ success: boolean; sid?: string; error?: string }> {
    const finalBody = variables ? replaceVariables(body, variables) : body;
    let deductionSuccessful = false;

    try {
        const { smsAccountSid, smsAuthToken, twilioSMSNumber } = await getTwilioConfig();
        if (!smsAccountSid || !smsAuthToken) return { success: false, error: 'Twilio SMS credentials missing' };

        // 1. Deduct credits
        if (organisationId) {
            const deduction = await deductCredits(organisationId, 1, 'SMS', campaignId);
            if (!deduction.success) return { success: false, error: deduction.error };
            deductionSuccessful = true;
        }

        // 2. Format number and send
        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }

        const client = twilio(smsAccountSid, smsAuthToken);
        const result = await client.messages.create({
            body: finalBody,
            from: twilioSMSNumber ?? undefined,
            to: formattedNumber,
        });

        return { success: true, sid: result.sid };
    } catch (error: any) {
        console.error('Error sending SMS:', error);

        // 3. Refund if deduction happened but send failed
        if (organisationId && deductionSuccessful) {
            await refundCredits(organisationId, 1, 'SMS', campaignId);
        }

        return { success: false, error: error.message || 'Error sending' };
    }
}

export async function sendWhatsapp(
    to: string, 
    body: string, 
    mediaUrl?: string | string[], 
    organisationId?: number, 
    campaignId?: number,
    variables?: Record<string, string>
): Promise<{ success: boolean; sid?: string; error?: string }> {
    const finalBody = variables ? replaceVariables(body, variables) : body;
    let deductionSuccessful = false;

    try {
        const { whatsappAccountSid, whatsappAuthToken, twilioNumber } = await getTwilioConfig();
        if (!whatsappAccountSid || !whatsappAuthToken || !twilioNumber) return { success: false, error: 'Twilio WhatsApp credentials missing' };

        // 1. Deduct credits
        if (organisationId) {
            const deduction = await deductCredits(organisationId, 1, 'WHATSAPP', campaignId);
            if (!deduction.success) return { success: false, error: deduction.error };
            deductionSuccessful = true;
        }

        // 2. Format number and send
        let formattedNumber = to.trim();
        if (!formattedNumber.startsWith('+')) {
            formattedNumber = formattedNumber.replace(/^0+/, '');
            formattedNumber = `+91${formattedNumber}`;
        }

        const client = twilio(whatsappAccountSid, whatsappAuthToken);
        const result = await client.messages.create({
            body: finalBody,
            from: `whatsapp:${twilioNumber}`,
            to: `whatsapp:${formattedNumber}`,
            mediaUrl: mediaUrl ? (Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl]) : undefined,
        });

        return { success: true, sid: result.sid };
    } catch (error: any) {
        console.error(`❌ Error sending WhatsApp to ${to}:`, error);

        // 3. Refund if deduction happened but send failed
        if (organisationId && deductionSuccessful) {
            await refundCredits(organisationId, 1, 'WHATSAPP', campaignId);
        }

        return { success: false, error: error.message || 'Error sending' };
    }
}
