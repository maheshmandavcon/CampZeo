import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { fetchConversationMessages } from "@/lib/meta-messaging";
import { withErrorHandling } from "@/lib/api-handler";

async function getHandler(
    request: NextRequest,
    context: { params: Promise<{ conversationId: string }> }
) {
    const { conversationId } = await context.params;
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: {
            facebookPageAccessToken: true,
        },
    });

    if (!dbUser?.facebookPageAccessToken) {
        return NextResponse.json(
            { error: "Facebook Page access token missing" },
            { status: 400 }
        );
    }

    const { searchParams } = new URL(request.url);
    const after = searchParams.get("after") || undefined;

    const result = await fetchConversationMessages(
        conversationId,
        dbUser.facebookPageAccessToken,
        after
    );

    return NextResponse.json(result);
}

export const GET = withErrorHandling(getHandler, "GET /api/conversations/[conversationId]/messages", "getHandler");
