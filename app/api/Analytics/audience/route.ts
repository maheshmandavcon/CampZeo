
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { AudienceNormalizerService } from "@/lib/audience-normalizer";

import { withErrorHandling } from '@/lib/api-handler';

async function getAudienceHandler() {
    console.log('[Audience API] Request received');
    const user = await currentUser();

    if (!user) {
        console.error('[Audience API] No authenticated user found');
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('[Audience API] User authenticated:', user.id);
    let targetUserId = user.id;
    const impersonatedOrgId = await getImpersonatedOrganisationId();
    let orgId = -1;

    if (impersonatedOrgId) {
        console.log('[Audience API] Using impersonated org:', impersonatedOrgId);
        orgId = impersonatedOrgId;
    } else {
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: targetUserId },
        });

        if (!dbUser) {
            console.error('[Audience API] User not found in database:', targetUserId);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!dbUser.organisationId) {
            console.error('[Audience API] User has no organisation:', targetUserId);
            return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
        }

        orgId = dbUser.organisationId;
        console.log('[Audience API] Using org:', orgId);
    }

    // Fetch Unified audience data
    console.log('[Audience API] Fetching audience data for org:', orgId);
    const audienceData = await AudienceNormalizerService.getAggregatedAudience(orgId);

    console.log('[Audience API] Successfully fetched audience data');
    return NextResponse.json(audienceData);
}

export const GET = withErrorHandling(getAudienceHandler, "GET /api/Analytics/audience", "getAudienceHandler");
