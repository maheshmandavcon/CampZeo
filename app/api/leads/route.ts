import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { logError, logInfo } from "@/lib/audit-logger";

// GET /api/leads - Fetch all leads for the organization
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get organisation ID
        const impersonatedId = await getImpersonatedOrganisationId();
        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { organisationId: true }
        });

        const orgId = impersonatedId || user?.organisationId;
        if (!orgId) return NextResponse.json({ error: "No organisation found" }, { status: 404 });

        const leads = await prisma.lead.findMany({
            where: { organisationId: orgId },
            include: {
                campaign: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ leads });
    } catch (error) {
        await logError("Error fetching leads", { error: error instanceof Error ? error.message : "Unknown error" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
