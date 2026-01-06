import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { refreshUserTokens } from "@/lib/social-refresh";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { prisma } from "@/lib/prisma";

export async function POST() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let targetUserId = userId;
        const impersonatedOrgId = await getImpersonatedOrganisationId();

        if (impersonatedOrgId) {
            const orgUser = await prisma.user.findFirst({
                where: { organisationId: impersonatedOrgId }
            });
            if (orgUser) {
                targetUserId = orgUser.clerkId;
            }
        }

        console.log(`[API] Manual token refresh requested for user: ${targetUserId}`);
        const result = await refreshUserTokens(targetUserId);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error in refresh API:", error);
        return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
    }
}
