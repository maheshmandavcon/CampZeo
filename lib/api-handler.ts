import { NextRequest, NextResponse } from 'next/server';
import { notifyAdminOfError } from './error-notification';

type ApiHandlerContext = { params: Record<string, string | string[]> };
type ApiHandler = (req: NextRequest, context: ApiHandlerContext) => Promise<Response>;

/**
 * Wraps an API route handler with error handling logic.
 * Catches any errors, notifies the admin, and returns a generic user-facing error message.
 * 
 * @param handler - The original API route handler
 * @param apiName - A descriptive name for the API endpoint (e.g., "GET /api/posts")
 * @returns A wrapped handler function
 */
export function withErrorHandling(handler: ApiHandler, apiName: string): ApiHandler {
    return async (req: NextRequest, context: ApiHandlerContext) => {
        try {
            return await handler(req, context);
        } catch (error) {
            console.error(`[withErrorHandling] Error in ${apiName}:`, error);

            // Notify Admin
            await notifyAdminOfError(apiName, error, {
                url: req.url,
                method: req.method,
                params: context?.params,
                // capturing query params safely
                searchParams: Object.fromEntries(req.nextUrl.searchParams.entries())
            });

            // Return generic error to user
            return NextResponse.json(
                { error: 'Something went wrong at our end. Please contact admin.' },
                { status: 500 }
            );
        }
    };
}
