import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

export async function PUT(request: NextRequest) {
    try {
        const { userId: currentUserId } = await auth();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let targetUserId = currentUserId;
        const impersonatedOrgId = await getImpersonatedOrganisationId();

        if (impersonatedOrgId) {
            const orgUser = await prisma.user.findFirst({
                where: { organisationId: impersonatedOrgId }
            });
            if (orgUser) {
                targetUserId = orgUser.clerkId;
            }
        }

        const body = await request.json();
        const { urn } = body;

        if (!urn) {
            return NextResponse.json({ error: "URN is required" }, { status: 400 });
        }

        await prisma.user.update({
            where: { clerkId: targetUserId },
            data: { linkedInAuthUrn: urn }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating LinkedIn page:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
