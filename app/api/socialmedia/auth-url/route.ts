import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            await logWarning("Unauthorized access attempt to generate auth URL", { action: "generate-auth-url" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const platform = searchParams.get("platform");

        if (!platform) {
            return NextResponse.json({ error: "Platform is required" }, { status: 400 });
        }

        // Determine target user ID (Handling Impersonation)
        let targetUserId = userId;
        const impersonatedOrgId = await getImpersonatedOrganisationId();

        if (impersonatedOrgId) {
            // If impersonating, find the primary user for the organisation
            // We select the first user found for this organisation
            const orgUser = await prisma.user.findFirst({
                where: { organisationId: impersonatedOrgId }
            });

            if (orgUser) {
                targetUserId = orgUser.clerkId;
                console.log("🔵 Generating OAuth URL for Impersonated User:", targetUserId);
            } else {
                console.warn("⚠️ Impersonating organisation but no user found within it.");
            }
        }

        // Get config from DB
        const clientIdConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key: `${platform}_CLIENT_ID` }
        });

        const redirectUriConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key: `${platform}_REDIRECT_URI` }
        });

        // Fallback or default redirect URI if not set
        const redirectUri = redirectUriConfig?.value || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth-callback`;

        if (!clientIdConfig?.value) {
            return NextResponse.json({ error: `Configuration for ${platform} is missing (Client ID)` }, { status: 404 });
        }

        let authUrl = "";
        const state = `${platform}_${targetUserId}`; // Simple state to pass platform and user. In production, sign this.

        switch (platform) {
            case "FACEBOOK":
            case "INSTAGRAM": // Instagram Graph API uses Facebook Login
                // Permissions needed:
                // - pages_show_list: To see user's Facebook Pages
                // - pages_read_engagement: To read page insights
                // - pages_read_user_content: To read page feed/posts
                // - read_insights: For detailed metrics (reach, impressions)
                // - pages_manage_posts: To post content to pages
                // - instagram_basic: Basic Instagram account info
                // - instagram_content_publish: To publish to Instagram
                // - instagram_manage_insights: For Instagram analytics
                // - business_management: For Instagram Business Account access
                authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientIdConfig.value}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=pages_show_list,pages_read_engagement,pages_read_user_content,read_insights,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights,business_management`;
                break;
            case "INSTAGRAM_DIRECT":
                // Direct Instagram app authentication (not via Facebook)
                authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientIdConfig.value}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user_profile,user_media&response_type=code&state=${state}`;
                break;

            case "LINKEDIN":
                authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientIdConfig.value}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=w_member_social,r_basicprofile,w_organization_social,r_organization_social,rw_organization_admin`;
                break;
            case "YOUTUBE":
                authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientIdConfig.value}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube&access_type=offline&prompt=consent`;
                break;
            case "PINTEREST":
                authUrl = `https://www.pinterest.com/oauth/?client_id=${clientIdConfig.value}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=boards:read,boards:write,pins:read,pins:write,user_accounts:read,ads:read`;
                // For Sandbox usage, it often stays the same, but the tokens work against sandbox API. 
                // However, double check if a specific sandbox auth URL is needed. 
                // Pinterest docs say: "https://www.pinterest.com/oauth/" works for both, 
                // but you use the app ID from sandbox.
                break;
            default:
                return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
        }

        console.log("🔵 OAuth URL Generated:", {
            platform,
            userId: userId.substring(0, 10) + "...",
            redirectUri,
            hasClientId: !!clientIdConfig.value,
            state,
        });

        await logInfo("OAuth URL generated", { userId, platform, impersonated: !!impersonatedOrgId });
        return NextResponse.json({ url: authUrl });
    } catch (error: any) {
        console.error("Error generating auth URL:", error);
        await logError("Failed to generate auth URL", { userId: "Unknown" }, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
