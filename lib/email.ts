import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { prisma } from '@/lib/prisma';


interface OrganisationInviteParams {
    email: string;
    password: string;
    organisationName: string;
    ownerName?: string;
}

async function getEmailConfig() {
    try {
        const configs = await prisma.adminPlatformConfiguration.findMany({
            where: {
                key: { in: ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'MAILGUN_FROM_EMAIL'] },
                platform: 'EMAIL'
            }
        });

        const apiKey = configs.find(c => c.key === 'MAILGUN_API_KEY')?.value;
        const domain = configs.find(c => c.key === 'MAILGUN_DOMAIN')?.value;
        const fromEmail = configs.find(c => c.key === 'MAILGUN_FROM_EMAIL')?.value;

        return { apiKey, domain, fromEmail };
    } catch (error) {
        console.error("Failed to fetch email config:", error);
        return { apiKey: null, domain: null, fromEmail: null };
    }
}

/**
 * Send organisation invitation email with login credentials
 * @param params - Email parameters including recipient, password, and org details
 */
export async function sendOrganisationInvite(params: OrganisationInviteParams): Promise<void> {
    const { email, password, organisationName, ownerName } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg = {
            from: fromEmail,
            to: [email],
            subject: `Welcome to ${organisationName} - Your Account Details`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to ${organisationName}!</h2>
                    <p>Dear ${ownerName || 'User'},</p>
                    <p>Your organisation "${organisationName}" has been created successfully.</p>
                    <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3>Login Credentials</h3>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Temporary Password:</strong> ${password}</p>
                    </div>
                    <p>Please login and change your password immediately.</p>
                    <p>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in" 
                           style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                           Login to Dashboard
                        </a>
                    </p>
                </div>
            `,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Email sent to ${email} via Mailgun`);
            return;
        } catch (error: any) {
            console.error('Error sending email via Mailgun:', error);

        }
    }

    console.log('='.repeat(60));
    console.log('⚠️  MOCK EMAIL SERVICE (Mailgun not configured or failed)');
    console.log('='.repeat(60));
    console.log('📧 Email Content:');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: Welcome to ${organisationName} - Your Account Details`);
    console.log('\nEmail Body:');
    console.log(`Dear ${ownerName || 'User'},\n`);
    console.log(`Your organisation "${organisationName}" has been created successfully!\n`);
    console.log('Login Credentials:');
    console.log(`Email: ${email}`);
    console.log(`Temporary Password: ${password}\n`);
    console.log('Please login and change your password immediately.');
    console.log(`Login URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in\n`);
    console.log('='.repeat(60));
}

/**
 * Generate a random password
 * @param length - Password length (default: 12)
 * @returns Random password string
 */
export function generatePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';

    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

interface OrganisationApprovedParams {
    email: string;
    organisationName: string;
    ownerName?: string;
}

/**
 * Send organisation approval email
 * @param params - Email parameters
 */
export async function sendOrganisationApproved(params: OrganisationApprovedParams): Promise<void> {
    const { email, organisationName, ownerName } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg = {
            from: fromEmail,
            to: [email],
            subject: `Your Organisation ${organisationName} is Approved!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Organisation Approved!</h2>
                    <p>Dear ${ownerName || 'User'},</p>
                    <p>Great news! Your organisation "${organisationName}" has been approved by the administrator.</p>
                    <p>You can now access your dashboard and start using all features.</p>
                    <p>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in" 
                           style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                           Go to Dashboard
                        </a>
                    </p>
                </div>
            `,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Email sent to ${email} via Mailgun`);
            return;
        } catch (error: any) {
            console.error('Error sending email via Mailgun:', error);
        }
    }

    // Mock implementation - logs to console
    console.log('='.repeat(60));
    console.log('📧 MOCK EMAIL: Organisation Approved');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: Your Organisation ${organisationName} is Approved!`);
    console.log('\nEmail Body:');
    console.log(`Dear ${ownerName || 'User'},\n`);
    console.log(`Great news! Your organisation "${organisationName}" has been approved by the administrator.\n`);
    console.log('You can now access your dashboard and start using all features.');
    console.log(`Login URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in\n`);
    console.log('='.repeat(60));
    console.log(`Login URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in\n`);
    console.log('='.repeat(60));
}

export interface CampaignEmailParams {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    tags?: string[];
    attachments?: string[];
}

/**
 * Send a campaign email to a contact
 * @param params - Email parameters
 */
export async function sendCampaignEmail(params: CampaignEmailParams): Promise<boolean> {
    const { to, subject, html, replyTo, tags, attachments } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg: any = {
            from: fromEmail,
            to: [to],
            subject: subject,
            html: html,
        };

        if (replyTo) {
            msg['h:Reply-To'] = replyTo;
        }

        if (tags && tags.length > 0) {
            msg['o:tag'] = tags;
        }

        // Handle attachments
        if (attachments && attachments.length > 0) {
            try {
                const attachmentData = await Promise.all(attachments.map(async (url) => {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Failed to fetch attachment: ${url}`);
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Extract filename from URL
                    const filename = url.split('/').pop() || 'attachment';

                    return {
                        filename: decodeURIComponent(filename),
                        data: buffer
                    };
                }));

                msg.attachment = attachmentData;
            } catch (error) {
                console.error('Error processing attachments:', error);
                // Continue without attachments or fail? 
                // Let's log and continue, or maybe we should fail if attachments were critical.
                // For now, logging error but trying to send message.
            }
        }

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Campaign email sent to ${to} with tags: ${tags?.join(', ')}`);
            return true;
        } catch (error: any) {
            console.error('Error sending campaign email via Mailgun:', error);
            return false;
        }
    }

    // Mock implementation
    console.log('='.repeat(60));
    console.log('📧 MOCK CAMPAIGN EMAIL');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (replyTo) console.log(`Reply-To: ${replyTo}`);
    if (tags) console.log(`Tags: ${tags.join(', ')}`);
    if (attachments) console.log(`Attachments: ${attachments.length} files`);
    console.log('\nBody:');
    console.log(html);
    console.log('='.repeat(60));

    return true; // Return true for mock success
}

export interface EmailAnalytics {
    accepted: number;
    delivered: number;
    opened: number;
    clicked: number;
}

export async function getMailgunAnalytics(tag: string): Promise<EmailAnalytics> {
    const { apiKey, domain } = await getEmailConfig();

    if (apiKey && domain) {
        // Mailgun Analytics API for Tags
        // usage: GET /v3/{domain}/tags/{tag}/stats
        // Docs: https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/action-get-tag-stats/

        try {
            const auth = Buffer.from(`api:${apiKey}`).toString('base64');
            const response = await fetch(`https://api.mailgun.net/v3/${domain}/tags/${tag}/stats?event=accepted&event=delivered&event=opened&event=clicked`, {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            });

            if (!response.ok) {
                console.warn(`[Mailgun] Failed to fetch stats for tag ${tag}: ${response.status}`);
                return { accepted: 0, delivered: 0, opened: 0, clicked: 0 };
            }

            const data = await response.json();
            // data.stats is an array, e.g. [{ time: ..., accepted: { total: 10 }, ... }]
            // We need to aggregate the totals

            let accepted = 0;
            let delivered = 0;
            let opened = 0;
            let clicked = 0;

            if (data.stats && Array.isArray(data.stats)) {
                data.stats.forEach((stat: any) => {
                    accepted += stat.accepted?.total || 0;
                    delivered += stat.delivered?.total || 0;
                    opened += stat.opened?.total || 0;
                    clicked += stat.clicked?.total || 0;
                });
            }

            return { accepted, delivered, opened, clicked };
        } catch (error) {
            console.error('[Mailgun] Error fetching analytics:', error);
            return { accepted: 0, delivered: 0, opened: 0, clicked: 0 };
        }
    }

    return { accepted: 0, delivered: 0, opened: 0, clicked: 0 };
}

interface PaymentReceiptParams {
    email: string;
    amount: number;
    currency: string;
    planName: string;
    receiptId: string;
    date: Date;
    organisationName: string;
}

/**
 * Send payment receipt email
 * @param params - Payment receipt parameters
 */
export async function sendPaymentReceipt(params: PaymentReceiptParams): Promise<void> {
    const { email, amount, currency, planName, receiptId, date, organisationName } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    const formattedAmount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency
    }).format(amount / 100); // Amount is in smallest currency unit

    const formattedDate = new Date(date).toLocaleDateString();

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg = {
            from: fromEmail,
            to: [email],
            subject: `Payment Receipt - ${receiptId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Payment Receipt</h2>
                    <p>Dear Customer,</p>
                    <p>Thank you for your payment. Here are the details of your transaction:</p>
                    
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Receipt ID:</strong> ${receiptId}</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Organisation:</strong> ${organisationName}</p>
                        <p><strong>Plan:</strong> ${planName}</p>
                        <hr style="border: 1px solid #eee; margin: 10px 0;">
                        <p style="font-size: 18px;"><strong>Amount Paid:</strong> ${formattedAmount}</p>
                    </div>

                    <p>You can view your invoice in your dashboard.</p>
                    
                    <p>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/organisation/settings/billing" 
                           style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                           View Billing History
                        </a>
                    </p>
                </div>
            `,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Payment receipt sent to ${email}`);
            return;
        } catch (error: any) {
            console.error('Error sending payment receipt via Mailgun:', error);
        }
    }

    // Mock implementation
    console.log('='.repeat(60));
    console.log('📧 MOCK EMAIL: Payment Receipt');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: Payment Receipt - ${receiptId}`);
    console.log('\nEmail Body:');
    console.log(`Receipt ID: ${receiptId}`);
    console.log(`Amount: ${formattedAmount}`);
    console.log(`Plan: ${planName}`);
    console.log('='.repeat(60));
}

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}

/**
 * Generic function to send an email
 * @param params - Email parameters
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
    const { to, subject, html, from, replyTo } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    const senderEmail = from || fromEmail;

    if (apiKey && domain && senderEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg: any = {
            from: senderEmail,
            to: [to],
            subject: subject,
            html: html,
        };

        if (replyTo) {
            msg['h:Reply-To'] = replyTo;
        }

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Email sent to ${to}`);
            return true;
        } catch (error: any) {
            console.error('Error sending email via Mailgun:', error);
            return false;
        }
    }

    // Mock implementation
    console.log('='.repeat(60));
    console.log('📧 MOCK EMAIL');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    if (replyTo) console.log(`Reply-To: ${replyTo}`);
    console.log('\nBody:');
    console.log(html);
    console.log('='.repeat(60));

    return true; // Return true for mock success
}
