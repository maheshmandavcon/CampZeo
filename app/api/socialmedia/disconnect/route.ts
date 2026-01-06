import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
    try {
        const { userId: currentUserId } = await auth();
        if (!currentUserId) {
            await logWarning("Unauthorized access attempt to disconnect platform", { action: "disconnect-platform" });
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
        const { platform } = body;

        if (!platform) {
            return NextResponse.json({ error: "Platform is required" }, { status: 400 });
        }

        const updateData: any = {};
        if (platform === "FACEBOOK") {
            updateData.facebookAccessToken = null;
            updateData.facebookPageAccessToken = null;
            updateData.facebookPageId = null;
            updateData.facebookUserId = null;
        } else if (platform === "INSTAGRAM") {
            updateData.instagramAccessToken = null;
            updateData.instagramUserId = null;
        } else if (platform === "LINKEDIN") {
            updateData.linkedInAccessToken = null;
            updateData.linkedInAuthUrn = null;
        } else if (platform === "YOUTUBE") {
            updateData.youtubeAccessToken = null;
            updateData.youtubeAuthUrn = null;
        } else if (platform === "PINTEREST") {
            updateData.pinterestAccessToken = null;
            updateData.pinterestAuthUrn = null;
        }

        await prisma.user.update({
            where: { clerkId: targetUserId },
            data: updateData
        });

        await logInfo("Social media platform disconnected", { userId: targetUserId, platform });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error disconnecting platform:", error);
        await logError("Failed to disconnect platform", { userId: "Unknown" }, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
