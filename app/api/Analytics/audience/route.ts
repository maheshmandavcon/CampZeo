
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { AudienceNormalizerService } from "@/lib/audience-normalizer";

export async function GET() {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let targetUserId = user.id;
        const impersonatedOrgId = await getImpersonatedOrganisationId();
        let orgId = -1;

        if (impersonatedOrgId) {
            orgId = impersonatedOrgId;
        } else {
            const dbUser = await prisma.user.findUnique({
                where: { clerkId: targetUserId },
            });
            if (!dbUser || !dbUser.organisationId) {
                return NextResponse.json({ error: "User or Organisation not found" }, { status: 404 });
            }
            orgId = dbUser.organisationId;
        }

        // Fetch Unified audience data
        // Note: This might be slow if fetching fresh from all APIs.
        // In production we should cache this result in AudienceInsight table.
        // We will do direct fetch first as per requirement to "pull Deep Data".

        const audienceData = await AudienceNormalizerService.getAggregatedAudience(orgId);

        return NextResponse.json(audienceData);

    } catch (error) {
        console.error("Error fetching audience analytics:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
