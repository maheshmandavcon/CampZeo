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
export function withErrorHandling(handler: ApiHandler, apiName: string, functionName: string = 'handler'): ApiHandler {
    return async (req: NextRequest, context: any) => {
        try {
            return await handler(req, context);
        } catch (error) {
            // Identifier for the failing component
            const errorLocation = `${apiName} [${functionName}]`;

            console.log(`[withErrorHandling] Caught error in ${errorLocation}:`, error instanceof Error ? error.message : error);

            // 1. Unified Logging and Alerting (Runs for ALL errors now)
            console.log(`[withErrorHandling] Proceeding with logging and alerts for ALL errors.`);

            const errorMessage = error instanceof Error ? error.message : String(error);
            const metadata = {
                url: req.url,
                method: req.method,
                functionName: functionName,
                query: Object.fromEntries(req.nextUrl.searchParams.entries()),
                params: context?.params,
                isApiError: error instanceof ApiError,
                isPublic: error instanceof ApiError ? error.isPublic : false
            };

            // Structured Log (Pino)
            try {
                logger.error({
                    msg: `Error in ${errorLocation}`,
                    err: error,
                    ...metadata
                });
            } catch (pinoErr) {
                console.error('[withErrorHandling] Logger failed:', pinoErr);
            }

            // Database Log (Audit)
            try {
                console.log(`[withErrorHandling] Attempting logError for ${errorLocation}`);
                await logError(`API Failure: ${errorLocation}`, { ...metadata, reason: errorMessage }, error instanceof Error ? error : new Error(errorMessage));
                console.log(`[withErrorHandling] logError completed`);
            } catch (dbLogErr) {
                console.error(`[withErrorHandling] logError failed:`, dbLogErr);
            }

            // Admin Alert (Email)
            try {
                console.log(`[withErrorHandling] Attempting notifyAdminOfError for ${errorLocation}`);
                await notifyAdminOfError(errorLocation, error, metadata);
                console.log(`[withErrorHandling] notifyAdminOfError completed`);
            } catch (alertErr) {
                console.error(`[withErrorHandling] notifyAdminOfError failed:`, alertErr);
            }

            // 2. Response Handling
            // If it's a known public ApiError, show the specific message to the user
            if (error instanceof ApiError && error.isPublic) {
                console.log(`[withErrorHandling] Returning Public ApiError to user (Status ${error.statusCode}).`);
                return NextResponse.json(
                    { error: error.message },
                    { status: error.statusCode }
                );
            }

            // Otherwise, return generic response
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
