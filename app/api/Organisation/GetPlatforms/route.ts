import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler() {

        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's organization
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { organisationId: true, role: true }
        });

        let effectiveOrganisationId = dbUser?.organisationId;

        // Check for admin impersonation
        if (dbUser?.role === 'ADMIN_USER') {
            const impersonatedId = await getImpersonatedOrganisationId();
            if (impersonatedId) {
                effectiveOrganisationId = impersonatedId;
            }
        }

        if (!effectiveOrganisationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 });
        }

        // Get organization platforms
        const orgPlatforms = await prisma.organisationPlatform.findMany({
            where: {
                organisationId: effectiveOrganisationId
            },
            select: {
                platform: true
            }
        });

        // Extract platform types
        const platforms = orgPlatforms.map((op: { platform: string }) => op.platform);

        const allPlatforms = ['EMAIL', ...platforms];

        // Remove duplicates
        const uniquePlatforms = [...new Set(allPlatforms)];

        return NextResponse.json({
            success: true,
            platforms: uniquePlatforms,
            organisationId: effectiveOrganisationId
        });

    
}

export const GET = withErrorHandling(getHandler, "GET /api/Organisation/GetPlatforms");
