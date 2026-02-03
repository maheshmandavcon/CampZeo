import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { logError } from './audit-logger';
import { notifyAdminOfError } from './error-notification';

type ApiHandlerContext = { params: Promise<Record<string, string | string[]>> }; // Updated context type for Next.js 15+ if needed, or keep generic Record
// Actually Next.js 15 context params is a Promise. We should handle that safely.
// For now, let's keep it flexible or check if we need to await it. 
// Standard Next.js 13/14 Type: { params: Record... }
// Current file has: type ApiHandlerContext = { params: Record<string, string | string[]> };
// Let's stick to the existing type signature but be robust.

type ApiHandler = (req: NextRequest, context: any) => Promise<Response>;

/**
 * Wraps an API route handler with centralized error handling logic.
 * 
 * Features:
 * 1. Structured Logging (Pino) -> Console/Stdout
 * 2. Database Logging (Audit Log) -> Prisma
 * 3. Admin Alerting (SMTP) -> Email
 * 4. Safe User Response -> JSON 500
 * 
 * @param handler - The original API route handler
 * @param apiName - Descriptive name (e.g., "GET /api/posts")
 */
export function withErrorHandling(handler: ApiHandler, apiName: string): ApiHandler {
    return async (req: NextRequest, context: any) => {
        try {
            return await handler(req, context);
        } catch (error) {
            // 1. Structured Log (Pino)
            logger.error({
                msg: `Error in ${apiName}`,
                err: error,
                url: req.url,
                method: req.method
            });

            const errorMessage = error instanceof Error ? error.message : String(error);
            const metadata = {
                url: req.url,
                method: req.method,
                // Safe capture of params and query
                query: Object.fromEntries(req.nextUrl.searchParams.entries()),
                // Context params might be resolved or not, just try to capture safe JSON
                params: context?.params
            };

            // 2. Database Log (Audit)
            // Fire and forget to not block response? No, usually safer to await to ensure persistence.
            try {
                await logError(`API Failure: ${apiName}`, { ...metadata, reason: errorMessage }, error instanceof Error ? error : new Error(errorMessage));
            } catch (dbLogErr) {
                console.error('Failed to write to audit log:', dbLogErr);
            }

            // 3. Admin Alert (Email)
            // Fire and forget to avoid delaying response significantly? 
            // Better to await to ensure alerting? Or utilize execution context like waitUntil locally?
            // For now, we await it but catch errors so we still return response.
            await notifyAdminOfError(apiName, error, metadata);

            // 4. Generic Response
            return NextResponse.json(
                {
                    error: 'Internal Server Error',
                    message: 'Something went wrong on our end. The team has been notified.'
                },
                { status: 500 }
            );
        }
    };
}
