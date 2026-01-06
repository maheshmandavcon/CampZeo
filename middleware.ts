import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

// Define which routes are protected
const isProtectedRoute = createRouteMatcher([
    "/dashboard(.*)",
    "/profile(.*)",
    "/organisation(.*)",
    "/admin(.*)",
]);

// Define organization routes that need special handling for impersonation
const isOrganisationRoute = createRouteMatcher([
    "/organisation(.*)",
]);

// Define API routes that can use X-API-Key authentication (for mobile apps)
const isApiRoute = createRouteMatcher([
    "/api/(.*)",
]);

// Public API routes that don't require any authentication
const isPublicApiRoute = createRouteMatcher([
    "/api/enquiries",
    "/api/webhooks/(.*)",
]);

/**
 * Validate the X-API-Key header for mobile app authentication
 * Returns true if the API key is valid
 */
function validateApiKey(request: NextRequest): boolean {
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = process.env.MOBILE_API_KEY;

    if (!apiKey || !validApiKey) {
        return false;
    }

    // Constant-time comparison to prevent timing attacks
    if (apiKey.length !== validApiKey.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < apiKey.length; i++) {
        result |= apiKey.charCodeAt(i) ^ validApiKey.charCodeAt(i);
    }

    return result === 0;
}

// Make the function handling the middleware async
export default clerkMiddleware(async (auth, req) => {
    const request = req as NextRequest;

    // Allow public API routes without any authentication
    if (isPublicApiRoute(request)) {
        return NextResponse.next();
    }

    // Check for X-API-Key authentication on API routes (for mobile apps)
    if (isApiRoute(request)) {
        const apiKey = request.headers.get('x-api-key');

        if (apiKey) {
            // Mobile app is trying to authenticate with API key
            if (validateApiKey(request)) {
                // Valid API key - allow the request
                // Note: The API route should still validate the user from the request body/params
                console.log('[Middleware] Valid X-API-Key - Mobile app authenticated');
                return NextResponse.next();
            } else {
                // Invalid API key
                console.log('[Middleware] Invalid X-API-Key provided');
                return NextResponse.json(
                    { error: 'Invalid API key' },
                    { status: 401 }
                );
            }
        }
        // No API key provided - fall through to Clerk auth
    }

    // If the request matches a protected route, protect it with Clerk
    if (isProtectedRoute(request)) {
        // Use auth.protect() directly as a method
        await auth.protect();

        // Check if this is an organization route and if admin is impersonating
        if (isOrganisationRoute(request)) {
            // Check for admin impersonation cookie
            const adminImpersonation = request.cookies.get('admin_impersonation');

            if (adminImpersonation?.value === 'true') {
                // Admin is impersonating - allow access to organization routes
                // The cookie will be cleared when the admin signs out or after expiry
                console.log('Admin impersonation detected - allowing organization access');
                return NextResponse.next();
            }
        }
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
