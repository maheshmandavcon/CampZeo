import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { prisma } from '@/lib/prisma';


interface OrganisationInviteParams {
    email: string;
    password?: string;
    
    organisationName: string;
    ownerName?: string;
    setupUrl?: string;
}

async function getEmailConfig() {
    let apiKey: string | undefined;
    let domain: string | undefined;
    let fromEmail: string | undefined;

    try {
        const configs = await prisma.adminPlatformConfiguration.findMany({
            where: {
                key: { in: ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'MAILGUN_FROM_EMAIL'] },
                platform: 'EMAIL'
            }
        });

        apiKey = configs.find(c => c.key === 'MAILGUN_API_KEY')?.value || undefined;
        domain = configs.find(c => c.key === 'MAILGUN_DOMAIN')?.value || undefined;
        fromEmail = configs.find(c => c.key === 'MAILGUN_FROM_EMAIL')?.value || undefined;
    } catch (error) {
        console.error("Failed to fetch email config from DB, falling back to ENV:", error);
    }

    return {
        apiKey: apiKey || process.env.MAILGUN_API_KEY,
        domain: domain || process.env.MAILGUN_DOMAIN,
        fromEmail: fromEmail || process.env.MAILGUN_FROM_EMAIL
    };
}

/**
 * Send organisation invitation email with login credentials
 * @param params - Email parameters including recipient, password, and org details
 */
export async function sendOrganisationInvite(params: OrganisationInviteParams): Promise<void> {
    const { email, password, organisationName, ownerName, setupUrl } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const credentialsHtml = setupUrl 
            ? `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${setupUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        Set Password & Login
                    </a>
                </div>
                <p style="text-align: center; color: #666; font-size: 14px;">This secure link allows you to log in instantly and set your permanent password.</p>
              `
            : `
                <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <h3>Login Credentials</h3>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Temporary Password:</strong> ${password}</p>
                </div>
                <p>Please login and change your password immediately.</p>
                <p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/" 
                       style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                       Login to Dashboard
                    </a>
                </p>
              `;

        const msg = {
            from: fromEmail,
            to: [email],
            subject: setupUrl ? `Welcome to ${organisationName} - Set Your Password` : `Welcome to ${organisationName} - Your Account Details`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to ${organisationName}!</h2>
                    <p>Hi ${ownerName || 'there'},</p>
                    <p>Your organisation "${organisationName}" has been created successfully.</p>
                    ${credentialsHtml}
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
    console.log(`Subject: ${setupUrl ? `Welcome to ${organisationName} - Set Your Password` : `Welcome to ${organisationName} - Your Account Details`}`);
    console.log('\nEmail Body:');
    console.log(`Dear ${ownerName || 'User'},\n`);
    console.log(`Your organisation "${organisationName}" has been created successfully!\n`);
    
    if (setupUrl) {
        console.log('Action: Set Password & Login');
        console.log(`Setup URL: ${setupUrl}\n`);
    } else {
        console.log('Login Credentials:');
        console.log(`Email: ${email}`);
        console.log(`Temporary Password: ${password}\n`);
        console.log('Please login and change your password immediately.');
        console.log(`Login URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in\n`);
    }
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
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/" 
                           style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                           Go to Dashboard
                        </a>
                    </p>
                </div>
            `,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(` Email sent to ${email} via Mailgun`);
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
    }).format(amount); // Amount is in smallest currency unit

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
    cc?: string;
}

/**
 * Generic function to send an email
 * @param params - Email parameters
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
    const { to, subject, html, from, replyTo, cc } = params;
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

        if (cc) {
            msg.cc = [cc];
        }

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Email sent to ${to} ${cc ? `(CC: ${cc})` : ''}`);
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
    if (cc) console.log(`CC: ${cc}`);
    console.log(`Subject: ${subject}`);
    if (replyTo) console.log(`Reply-To: ${replyTo}`);
    console.log('\nBody:');
    console.log(html);
    console.log('='.repeat(60));

    return true; // Return true for mock success
}

export interface WelcomeEmailParams {
    email: string;
    userName: string;
    organisationName?: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
    const { email, userName, organisationName } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg: any = {
            from: fromEmail,
            to: [email],
            subject: `Welcome to CampZeo!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to CampZeo!</h2>
                    <p>Hi ${userName},</p>
                    <p>We're thrilled to have you on board. CampZeo is your all-in-one platform to manage your business effectively.</p>
                    ${organisationName ? `<p>Your organisation <strong>${organisationName}</strong> has been set up successfully.</p>` : ''}
                    <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
                    <p>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/" 
                           style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                           Get Started
                        </a>
                    </p>
                </div>
            `,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Welcome email sent to ${email}`);
            return true;
        } catch (error: any) {
            console.error('Error sending welcome email via Mailgun:', error);
            return false;
        }
    }

    console.log('='.repeat(60));
    console.log('📧 MOCK EMAIL: Welcome Email');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: Welcome to CampZeo!`);
    console.log('\nBody:');
    console.log(`Hi ${userName},`);
    console.log(`Welcome to CampZeo! We're thrilled to have you.`);
    console.log('='.repeat(60));

    return true;
}

export interface NewDeviceSignInParams {
    email: string;
    userName: string;
    deviceInfo?: string;
    location?: string;
}

export async function sendNewDeviceSignInEmail(params: NewDeviceSignInParams): Promise<boolean> {
    const { email, userName, deviceInfo, location } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    const time = new Date().toLocaleString();

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg: any = {
            from: fromEmail,
            to: [email],
            subject: `New sign-in to your CampZeo account`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>New Sign-In Detected</h2>
                    <p>Hi ${userName},</p>
                    <p>Your CampZeo account was just signed in from a new device.</p>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Device:</strong> ${deviceInfo || 'Unknown Device'}</p>
                        <p><strong>Location:</strong> ${location || 'Unknown Location'}</p>
                        <p><strong>Time:</strong> ${time}</p>
                    </div>
                    <p>If this was you, you can safely ignore this email.</p>
                    <p>If this wasn't you, please secure your account immediately by resetting your password.</p>
                </div>
            `,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ New device sign-in email sent to ${email}`);
            return true;
        } catch (error: any) {
            console.error('Error sending new device sign-in email via Mailgun:', error);
            return false;
        }
    }

    console.log('='.repeat(60));
    console.log('📧 MOCK EMAIL: New Device Sign-In');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: New sign-in to your CampZeo account`);
    console.log('\nBody:');
    console.log(`Hi ${userName},`);
    console.log(`New sign-in from ${deviceInfo || 'Unknown Device'} at ${time}.`);
    console.log('='.repeat(60));

    return true;
}


export interface PlanExpiryEmailParams {
    email: string;
    orgName: string;
    planName: string;
    expiryDate: Date;
    daysRemaining: number;
    autoRenew?: boolean;
}


export async function sendPlanExpiryEmail(params: PlanExpiryEmailParams): Promise<boolean> {
    const { email, orgName, planName, expiryDate, daysRemaining, autoRenew } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campzeo.com';
    const renewalUrl = `${appUrl}/organisation/billing`;
    const formattedExpiry = new Date(expiryDate).toLocaleDateString();

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

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg: any = {
            from: fromEmail,
            to: [email],
            subject: subject,
            html: html,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Plan expiry email sent to ${email} via Mailgun`);
            return true;
        } catch (error: any) {
            console.error('Error sending plan expiry email via Mailgun:', error);
            return false;
        }
    }

    console.log('='.repeat(60));
    console.log('📧 MOCK EMAIL: Plan Expiry');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log('\nBody excerpt: Plan Expiring Soon...');
    console.log('='.repeat(60));

    return true;
}

export interface TwilioAccessStatusParams {
    email: string;
    organisationName: string;
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
    ownerName?: string;
}

/**
 * Send Twilio access request status notification email
 * @param params - Email parameters
 */
export async function sendTwilioAccessStatusEmail(params: TwilioAccessStatusParams): Promise<boolean> {
    const { email, organisationName, status, reason, ownerName } = params;
    const { apiKey, domain, fromEmail } = await getEmailConfig();

    const isApproved = status === 'APPROVED';
    const subject = `Twilio Access Request ${isApproved ? 'Approved' : 'Rejected'} - ${organisationName}`;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: ${isApproved ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${isApproved ? '#22c55e' : '#ef4444'};">
                <h2 style="margin-top: 0; color: ${isApproved ? '#166534' : '#991b1b'};">Twilio Access Request ${isApproved ? 'Approved' : 'Rejected'}</h2>
                <p>Dear ${ownerName || 'User'},</p>
                <p>Your request for Twilio access for the organisation <strong>${organisationName}</strong> has been <strong>${status.toLowerCase()}</strong> by the administrator.</p>
                
                ${reason ? `
                <div style="background-color: rgba(0,0,0,0.05); padding: 15px; border-radius: 4px; margin: 15px 0;">
                    <p style="margin: 0; font-weight: bold;">Note from administrator:</p>
                    <p style="margin: 5px 0 0 0;">${reason}</p>
                </div>
                ` : ''}

                <p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/organisation/settings" 
                       style="background-color: ${isApproved ? '#22c55e' : '#ef4444'}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                       View Settings
                    </a>
                </p>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 20px; text-align: center;">
                &copy; ${new Date().getFullYear()} CampZeo. All rights reserved.
            </p>
        </div>
    `;

    if (apiKey && domain && fromEmail) {
        const mailgun = new Mailgun(FormData);
        const mg = mailgun.client({ username: 'api', key: apiKey });

        const msg: any = {
            from: fromEmail,
            to: [email],
            subject: subject,
            html: html,
        };

        try {
            await mg.messages.create(domain, msg);
            console.log(`✅ Twilio access status email sent to ${email} (${status})`);
            return true;
        } catch (error: any) {
            console.error('Error sending Twilio access status email via Mailgun:', error);
            return false;
        }
    }

    // Mock implementation
    console.log('='.repeat(60));
    console.log(`📧 MOCK EMAIL: Twilio Access Request ${status}`);
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    if (reason) console.log(`Reason: ${reason}`);
    console.log('='.repeat(60));

    return true;
}
