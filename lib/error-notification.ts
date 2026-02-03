import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

// Cache structure for SMTP config to reduce DB hits
let smtpConfigCache: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    to: string;
    lastFetched: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch SMTP Configuration
 * Prioritizes Database Configuration > Environment Variables
 */
async function getSmtpConfig() {
    const now = Date.now();
    if (smtpConfigCache && (now - smtpConfigCache.lastFetched < CACHE_TTL)) {
        return smtpConfigCache;
    }

    let config = {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || '"System Alert" <no-reply@campzeo.com>',
        to: process.env.ADMIN_EMAIL || '',
    };

    try {
        // Fetch from DB to override env vars if present
        const dbConfigs = await prisma.adminPlatformConfiguration.findMany({
            where: {
                platform: 'EMAIL', // Using EMAIL platform for SMTP config
                key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'ADMIN_EMAIL_RECIPIENT'] }
            }
        });

        if (dbConfigs.length > 0) {
            const getValue = (key: string) => dbConfigs.find(c => c.key === key)?.value;

            if (getValue('SMTP_HOST')) config.host = getValue('SMTP_HOST')!;
            if (getValue('SMTP_PORT')) config.port = parseInt(getValue('SMTP_PORT')!);
            if (getValue('SMTP_USER')) config.user = getValue('SMTP_USER')!;
            if (getValue('SMTP_PASS')) config.pass = getValue('SMTP_PASS')!;
            if (getValue('SMTP_FROM')) config.from = getValue('SMTP_FROM')!;
            if (getValue('ADMIN_EMAIL_RECIPIENT')) config.to = getValue('ADMIN_EMAIL_RECIPIENT')!;
        }

        // Cache valid config
        if (config.host && config.user) {
            smtpConfigCache = { ...config, lastFetched: now };
        }
    } catch (error) {
        console.error("Failed to fetch SMTP config from DB:", error);
    }

    return config;
}

/**
 * Notifies the admin via email about an API error.
 * Uses Nodemailer for direct SMTP transport.
 */
export async function notifyAdminOfError(apiName: string, error: any, context?: any) {
    const config = await getSmtpConfig();

    if (!config.host || !config.to) {
        console.warn('⚠️ SMTP or Admin Email not configured using env or DB. Skipping alert.');
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure, // true for 465, false for other ports
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });

        const timestamp = new Date().toLocaleString();
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stackTrace = (error instanceof Error && error.stack) || 'No stack trace available';

        const subject = `🚨 [System Failure] ${apiName} - ${timestamp}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #dc2626; padding: 20px; color: white;">
                    <h1 style="margin: 0; font-size: 20px;">System Error Alert</h1>
                    <p style="margin: 5px 0 0; opacity: 0.9;">${apiName}</p>
                </div>
                
                <div style="padding: 20px; background-color: #fff;">
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #4b5563; margin-top: 0;">Error Details</h3>
                        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px;">
                            <p style="margin: 0; font-weight: bold; color: #b91c1c;">${errorMessage}</p>
                            <p style="margin: 5px 0 0; font-size: 13px; color: #991b1b;">Time: ${timestamp}</p>
                        </div>
                    </div>

                    ${context ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #4b5563;">Request Context</h3>
                        <pre style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; border: 1px solid #e5e7eb;">${JSON.stringify(context, null, 2)}</pre>
                    </div>
                    ` : ''}

                    <div>
                        <h3 style="color: #4b5563;">Stack Trace</h3>
                        <pre style="background-color: #1e293b; color: #f8fafc; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; line-height: 1.5;">${stackTrace}</pre>
                    </div>
                </div>

                <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                    System Alert • Campzeo
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: config.from,
            to: config.to,
            subject: subject,
            html: html,
        });

        console.log(`✅ Admin alert sent to ${config.to}`);

    } catch (sendError) {
        console.error('❌ Failed to send admin alert email:', sendError);
    }
}
