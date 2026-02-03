import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

import { withErrorHandling } from '@/lib/api-handler';
async function putHandler(request: NextRequest) {

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
    
}

export const PUT = withErrorHandling(putHandler, "PUT /api/user/linkedin-page");
