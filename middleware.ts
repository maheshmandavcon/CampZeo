import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

// Define which routes are protected
const isProtectedRoute = createRouteMatcher([
    "/dashboard(.*)",
    "/profile(.*)",
    "/organisation(.*)",
    "/admin(.*)",
    "/contacts(.*)",
]);

// Define organization routes that need special handling for impersonation
const isOrganisationRoute = createRouteMatcher([
    "/organisation(.*)",
    "/contacts(.*)",
]);

// Define API routes that can use X-API-Key authentication (for mobile apps)
const isApiRoute = createRouteMatcher([
    "/api/(.*)",
]);

// Public API routes that don't require any authentication
const isPublicApiRoute = createRouteMatcher([
    "/api/enquiries",
    "/api/webhooks/(.*)",
    "/api/upload/google-drive/view(.*)",
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

// Define routes that should completely bypass Clerk (to avoid extra headers)
const isBypassRoute = createRouteMatcher([
    "/api/upload/google-drive/view(.*)",
]);

/**
 * Main middleware function
 * We handle bypass routes first to ensure they don't get stamped with Clerk headers
 */
export default async function middleware(req: NextRequest, event: any) {
    if (isBypassRoute(req)) {
        return NextResponse.next();
    }

    // Wrap the rest of the logic in clerkMiddleware
    return clerkMiddleware(async (auth, req) => {
        const request = req as NextRequest;
        const { pathname } = request.nextUrl;

        // 1. EXPLICITLY ALLOW SEO FILES
        if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
            return NextResponse.next();
        }

        // Allow public API routes
        if (isPublicApiRoute(request)) {
            return NextResponse.next();
        }

        // 2. API Key Authentication (Mobile)
        if (isApiRoute(request)) {
            const apiKey = request.headers.get('x-api-key');
            if (apiKey && validateApiKey(request)) {
                return NextResponse.next();
            }
        }

        // 3. Clerk Protected Routes
        if (isProtectedRoute(request)) {
            await auth.protect();

            if (isOrganisationRoute(request)) {
                const adminImpersonation = request.cookies.get('admin_impersonation');
                if (adminImpersonation?.value) {
                    return NextResponse.next();
                }
            }
        }
    })(req, event);
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
