import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler(request: NextRequest) {

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

    let targetUserId = userId;
    const impersonatedOrgId = await getImpersonatedOrganisationId();

    if (impersonatedOrgId) {
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

    const isDirect = platform === 'INSTAGRAM_DIRECT' || platform === 'INSTAGRAM_BASIC';
    const clientIdConfig = await prisma.adminPlatformConfiguration.findFirst({
        where: { key: isDirect ? 'INSTAGRAM_DIRECT_ID' : `${platform}_CLIENT_ID` }
    });

    const clientSecretConfig = await prisma.adminPlatformConfiguration.findFirst({
        where: { key: isDirect ? 'INSTAGRAM_DIRECT_SECRET' : `${platform}_CLIENT_SECRET` }
    });

    const redirectUriConfig = await prisma.adminPlatformConfiguration.findFirst({
        where: { key: isDirect ? 'INSTAGRAM_DIRECT_REDIRECT_URI' : `${platform}_REDIRECT_URI` }
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = redirectUriConfig?.value || `${appUrl}/auth-callback`;

    const clientId = clientIdConfig?.value || process.env.INSTAGRAM_DIRECT_ID;
    const clientSecret = clientSecretConfig?.value || process.env.INSTAGRAM_DIRECT_SECRET;

    if (!clientId) {
        return NextResponse.json({ error: `Configuration for ${platform} is missing (Client ID)` }, { status: 404 });
    }

    let authUrl = "";
    const state = `${platform}_${targetUserId}`; // Simple state to pass platform and user. In production, sign this.

    switch (platform) {
        case "FACEBOOK":
            // Permissions needed for Facebook Pages, Ads, Leads, etc.
            authUrl = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=pages_show_list,pages_read_engagement,pages_read_user_content,read_insights,pages_manage_posts,pages_manage_ads,ads_management,ads_read,leads_retrieval,business_management,pages_messaging,public_profile&auth_type=rerequest&display=popup&response_type=code`;
            break;
        case "INSTAGRAM":
            const instagramExtras = encodeURIComponent(JSON.stringify({ setup: { channel: "IG_OPTIMIZED_ONBOARDING" } }));
            authUrl = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,instagram_manage_insights,business_management,instagram_manage_messages,public_profile&auth_type=rerequest&display=popup&response_type=code&extras=${instagramExtras}`;
            break;
        case "INSTAGRAM_DIRECT":
        case "INSTAGRAM_BASIC":
            authUrl = `https://www.instagram.com/oauth/authorize/third_party/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=business_basic,business_content_publish,instagram_business_manage_insights,business_manage_comments,instagram_business_manage_messages&response_type=code&state=${state}&force_reauth=true`; break;

        case "LINKEDIN":
            authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=openid,profile,w_member_social,email,rw_organization_admin,r_organization_social,w_organization_social`;
            break;
        case "YOUTUBE":
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly &access_type=offline&prompt=consent`;
            break;
        case "PINTEREST":
            authUrl = `https://www.pinterest.com/oauth/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=boards:read,boards:write,pins:read,pins:write,user_accounts:read,ads:read`;
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
        hasClientId: !!clientIdConfig?.value,
        state,
    });

    await logInfo("OAuth URL generated", { userId, platform, impersonated: !!impersonatedOrgId });
    return NextResponse.json({ url: authUrl });

}

export const GET = withErrorHandling(getHandler, "GET /api/socialmedia/auth-url");
