import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getFacebookPagePosts } from "@/lib/facebook";
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Handle Impersonation
        const impersonatedOrgId = await getImpersonatedOrganisationId();
        let dbUser;

        if (impersonatedOrgId) {
            dbUser = await prisma.user.findFirst({
                where: { organisationId: impersonatedOrgId }
            });
        } else {
            dbUser = await prisma.user.findUnique({
                where: { clerkId: userId }
            });
        }

        if (!dbUser || !dbUser.facebookAccessToken || !dbUser.facebookPageId) {
            return NextResponse.json({ error: "Facebook not connected" }, { status: 400 });
        }

        const posts = await getFacebookPagePosts({
            accessToken: dbUser.facebookAccessToken,
            pageId: dbUser.facebookPageId
        });

        return NextResponse.json({ posts });
    } catch (error: any) {
        console.error("Error fetching Facebook posts:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch posts" }, { status: 500 });
    }
}
