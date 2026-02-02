import { sendEmail } from './email';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.MAILGUN_FROM_EMAIL;

/**
 * Notifies the admin via email about an API error.
 * @param apiName - The name of the API or function where the error occurred.
 * @param error - The error object or message.
 * @param context - Additional context data (optional).
 */
export async function notifyAdminOfError(apiName: string, error: any, context?: any) {
    if (!ADMIN_EMAIL) {
        console.warn('ADMIN_EMAIL not configured, skipping admin notification email.');
        return;
    }

    try {
        const timestamp = new Date().toLocaleString();
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stackTrace = (error instanceof Error && error.stack) || 'No stack trace available';

        // simple parsing to find the line number
        const stackLines = stackTrace.split('\n');
        // The first line is usually the error message, the second is the first stack frame
        const locationLine = stackLines.length > 1 ? stackLines[1].trim() : 'Unknown location';

        const subject = `[API Error] ${apiName} - ${timestamp}`;

        const html = `
            <div style="font-family: monospace; padding: 20px; background-color: #fff1f2; color: #9f1239; border: 1px solid #fecdd3; border-radius: 8px;">
                <h2 style="margin-top: 0; color: #881337;">🚨 System Error Alert</h2>
                <div style="margin-bottom: 20px;">
                    <p><strong>API Name:</strong> ${apiName}</p>
                    <p><strong>Time:</strong> ${timestamp}</p>
                    <p><strong>Error Message:</strong> <span style="background-color: #ffe4e6; padding: 2px 5px; border-radius: 4px;">${errorMessage}</span></p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background-color: #fff; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <strong style="color: #475569;">📍 Location:</strong><br>
                    <div style="margin-top: 5px; color: #334155;">${locationLine}</div>
                </div>

                <div style="margin-top: 20px; padding: 15px; background-color: #1e293b; color: #f8fafc; border-radius: 6px; overflow-x: auto;">
                    <strong style="color: #94a3b8;">Create Stack Trace:</strong><br>
                    <pre style="margin-top: 10px; white-space: pre-wrap; font-size: 12px;">${stackTrace}</pre>
                </div>

                ${context ? `
                <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow-x: auto;">
                    <strong style="color: #475569;">📝 Additional Context:</strong><br>
                    <pre style="margin-top: 10px; font-size: 12px; color: #334155;">${JSON.stringify(context, null, 2)}</pre>
                </div>
                ` : ''}
            </div>
        `;

        await sendEmail({
            to: ADMIN_EMAIL,
            subject,
            html
        });

    } catch (notifyError) {
        console.error('Failed to send admin notification:', notifyError);
        console.error('Original error:', error);
    }
}
