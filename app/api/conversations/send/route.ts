import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendMetaMessage, isWithin24HourWindow } from "@/lib/meta-messaging";
import { withErrorHandling } from "@/lib/api-handler";

async function postHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientId, message, lastMessageTime } = await request.json();

    if (!recipientId || !message) {
        return NextResponse.json(
            { error: "Recipient ID and message are required" },
            { status: 400 }
        );
    }

    // 24-hour window check
    if (lastMessageTime && !isWithin24HourWindow(lastMessageTime)) {
        return NextResponse.json(
            { error: "Cannot send message: Outside of 24-hour window policy" },
            { status: 403 }
        );
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

    try {
        const result = await sendMetaMessage(
            recipientId,
            message,
            dbUser.facebookPageAccessToken
        );
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const POST = withErrorHandling(postHandler, "POST /api/conversations/send", "postHandler");
