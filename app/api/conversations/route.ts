import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { fetchUnifiedConversations } from "@/lib/meta-messaging";
import { withErrorHandling } from "@/lib/api-handler";

async function getHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: {
            facebookPageId: true,
            facebookPageAccessToken: true,
            instagramUserId: true,
        },
    });

    if (!dbUser?.facebookPageId || !dbUser?.facebookPageAccessToken) {
        return NextResponse.json(
            { error: "Facebook Page not connected or missing access token" },
            { status: 400 }
        );
    }

    const conversations = await fetchUnifiedConversations(
        dbUser.facebookPageId,
        dbUser.facebookPageAccessToken,
        dbUser.instagramUserId || undefined
    );

    return NextResponse.json({
        conversations,
        pageId: dbUser.facebookPageId,
        instagramUserId: dbUser.instagramUserId,
        debug: {
            hasInstagramId: !!dbUser.instagramUserId,
            hasPageToken: !!dbUser.facebookPageAccessToken,
        }
    });
}

export const GET = withErrorHandling(getHandler, "GET /api/conversations", "getHandler");
