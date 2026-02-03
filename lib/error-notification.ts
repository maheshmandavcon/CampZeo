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
    recipients: string[];
    logLevel: string;
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
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: '"System Alert" <no-reply@campzeo.com>',
        recipients: [] as string[],
        logLevel: 'ERROR', // INFO, WARN, ERROR
    };

    try {
        // Fetch strictly from DB
        const dbConfigs = await prisma.adminPlatformConfiguration.findMany({
            where: {
                platform: 'EMAIL', // Using EMAIL platform for SMTP config
                key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'ADMIN_EMAIL_RECIPIENTS', 'ADMIN_LOG_LEVEL', 'SMTP_SECURE'] }
            }
        });

        if (dbConfigs.length > 0) {
            const getValue = (key: string) => dbConfigs.find(c => c.key === key)?.value;

            if (getValue('SMTP_HOST')) config.host = getValue('SMTP_HOST')!;
            if (getValue('SMTP_PORT')) config.port = parseInt(getValue('SMTP_PORT')!);
            if (getValue('SMTP_SECURE')) config.secure = getValue('SMTP_SECURE') === 'true';
            if (getValue('SMTP_USER')) config.user = getValue('SMTP_USER')!;
            if (getValue('SMTP_PASS')) config.pass = getValue('SMTP_PASS')!;
            if (getValue('SMTP_FROM')) config.from = getValue('SMTP_FROM')!;

            const recipientsStr = getValue('ADMIN_EMAIL_RECIPIENTS');
            if (recipientsStr) {
                // Expecting comma-separated list
                config.recipients = recipientsStr.split(',').map(e => e.trim()).filter(e => e);
            }

            if (getValue('ADMIN_LOG_LEVEL')) config.logLevel = getValue('ADMIN_LOG_LEVEL')!;
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

    if (!config.host || config.recipients.length === 0) {
        console.warn('⚠️ SMTP or Admin Email not configured using env or DB. Skipping alert.');
        return;
    }

    // Check log level? For now assuming this function is only called for ERRORs.
    // If we want to support generic notifications later, we should check `config.logLevel`.

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

        // Send to all recipients
        for (const recipient of config.recipients) {
            try {
                await transporter.sendMail({
                    from: config.from,
                    to: recipient,
                    subject: subject,
                    html: html,
                });

                // Log success
                console.log(`✅ Admin alert sent to ${recipient}`);
                try {
                    await prisma.systemNotificationLog.create({
                        data: {
                            subject,
                            recipient,
                            status: 'SUCCESS',
                            metadata: { apiName, error: errorMessage }
                        }
                    });
                } catch (dbError) {
                    console.error(`⚠️ Failed to log successful email to database for ${recipient}:`, dbError);
                }
            } catch (sendError: any) {
                const detailedError = `Error Code: ${sendError.code || 'N/A'}, Message: ${sendError.message}`;
                console.error(`❌ Failed to send admin alert to ${recipient}:`, detailedError);
                // Log failure
                try {
                    await prisma.systemNotificationLog.create({
                        data: {
                            subject,
                            recipient,
                            status: 'FAILED',
                            error: detailedError,
                            metadata: {
                                apiName,
                                error: errorMessage,
                                smtpHost: config.host,
                                smtpPort: config.port,
                                smtpSecure: config.secure
                            }
                        }
                    });
                } catch (dbError) {
                    console.error(`⚠️ Failed to log failed email to database for ${recipient}:`, dbError);
                }
            }
        }

    } catch (setupError) {
        console.error('❌ Failed to setup/send admin alerts:', setupError);
    }
}

