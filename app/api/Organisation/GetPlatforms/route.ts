import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

export async function GET() {
    try {
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

        // Always include EMAIL, SMS, WHATSAPP as they're admin-configured
        const allPlatforms = ['EMAIL', 'SMS', 'WHATSAPP', ...platforms];

        // Remove duplicates
        const uniquePlatforms = [...new Set(allPlatforms)];

        return NextResponse.json({
            success: true,
            platforms: uniquePlatforms
        });

    } catch (error) {
        console.error("Error fetching organization platforms:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch platforms",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
