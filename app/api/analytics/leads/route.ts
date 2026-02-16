import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { getFacebookLeads, getFacebookAds, FacebookLead, FacebookAd } from "@/lib/facebook";
import { withErrorHandling } from "@/lib/api-handler";

async function getHandler(req: NextRequest) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let orgId = -1;
    const impersonatedOrgId = await getImpersonatedOrganisationId();

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    orgId = (dbUser.role === 'ADMIN_USER' && impersonatedOrgId) ? impersonatedOrgId : dbUser.organisationId;

    const { searchParams } = new URL(req.url);
    const boostedPostId = searchParams.get('boosted_post_id');
    const init = searchParams.get('init') === 'true';

    // Get FB credentials
    // We try to get the Page token first, then User token
    const fbToken = dbUser.facebookPageAccessToken || dbUser.facebookAccessToken;
    const fbPageId = dbUser.facebookPageId;

    if (!fbToken) {
        return NextResponse.json({ error: "Facebook not connected" }, { status: 400 });
    }

    let boostedPosts: FacebookAd[] = [];
    if (init && fbPageId) {
        boostedPosts = await getFacebookAds(fbPageId, fbToken);
    }

    let leads: FacebookLead[] = [];
    if (boostedPostId) {
        leads = await getFacebookLeads(boostedPostId, fbToken);
    }

    return NextResponse.json({
        success: true,
        leads,
        boostedPosts: boostedPosts.filter(ad => ad.status === 'ACTIVE' || ad.status === 'PAUSED')
    });
}

export const GET = withErrorHandling(getHandler, "GET /api/analytics/leads");
