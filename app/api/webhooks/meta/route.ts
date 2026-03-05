import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logInfo, logError } from "@/lib/audit-logger";

// GET handler for Webhook verification
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    // Get verify token from admin config
    const verifyTokenConfig = await prisma.adminPlatformConfiguration.findFirst({
        where: { key: 'META_WEBHOOK_VERIFY_TOKEN' }
    });

    const VERIFY_TOKEN = verifyTokenConfig?.value || process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return new NextResponse(challenge, { status: 200 });
    } else {
        return new NextResponse("Forbidden", { status: 403 });
    }
}

// POST handler for Webhook notifications
export async function POST(request: NextRequest) {
    const body = await request.json();

    if (body.object === "page") {
        body.entry.forEach(async (entry: any) => {
            const webhook_event = entry.messaging[0];
            console.log("Received Webhook Event:", webhook_event);

            const sender_id = webhook_event.sender.id;
            const message_text = webhook_event.message?.text;

            if (message_text) {
                // Here we would push data to front-end using SignalR/WebSockets
                // Since they are not set up, we log and potentially store in DB if needed.
                // For this implementation, we'll assume the client polls or we use a simple mechanism.
                // Ideally: await pushToFrontend(sender_id, message_text);

                await logInfo("Meta Webhook Message Received", {
                    sender_id,
                    message_text: message_text.substring(0, 50) + "..."
                });
            }
        });

        return new NextResponse("EVENT_RECEIVED", { status: 200 });
    } else {
        return new NextResponse("Not Found", { status: 404 });
    }
}
