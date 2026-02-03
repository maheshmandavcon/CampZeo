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

/**
 * Custom error class for API-related errors that should be shown to the user.
 */
export class ApiError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public isPublic: boolean = true
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

type ApiHandler = (req: NextRequest, context: any) => Promise<Response>;

/**
 * Wraps an API route handler with centralized error handling logic.
 */
export function withErrorHandling(handler: ApiHandler, apiName: string): ApiHandler {
    return async (req: NextRequest, context: any) => {
        try {
            return await handler(req, context);
        } catch (error) {
            // Handle known API errors that are safe to show to the user
            if (error instanceof ApiError && error.isPublic) {
                return NextResponse.json(
                    { error: error.message },
                    { status: error.statusCode }
                );
            }

            // 1. Structured Log (Pino)
            logger.error({
                msg: `Unexpected Error in ${apiName}`,
                err: error,
                url: req.url,
                method: req.method
            });

            const errorMessage = error instanceof Error ? error.message : String(error);
            const metadata = {
                url: req.url,
                method: req.method,
                query: Object.fromEntries(req.nextUrl.searchParams.entries()),
                params: context?.params
            };

            // 2. Database Log (Audit)
            try {
                await logError(`API Failure: ${apiName}`, { ...metadata, reason: errorMessage }, error instanceof Error ? error : new Error(errorMessage));
            } catch (dbLogErr) {
                console.error('Failed to write to audit log:', dbLogErr);
            }

            // 3. Admin Alert (Email)
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
