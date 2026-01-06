import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(req: Request) {
    console.log("POST /api/webhooks/twilio hit");

    try {
        const body = await req.text();
        const headersList = await headers();

        // Log the incoming webhook for debugging
        const headersObj: Record<string, string> = {};
        headersList.forEach((value, key) => {
            headersObj[key] = value;
        });
        console.log("Twilio Webhook Headers:", headersObj);
        console.log("Twilio Webhook Body:", body);

        // Parse the body (it's usually x-www-form-urlencoded)
        const params = new URLSearchParams(body);
        const messageSid = params.get('MessageSid');
        const messageStatus = params.get('MessageStatus');
        const to = params.get('To');
        const from = params.get('From');

        console.log(`Twilio Message Update: SID=${messageSid}, Status=${messageStatus}, To=${to}, From=${from}`);

        // TODO: Update message status in database
        // We need a table to track individual message statuses (e.g., CampaignPostContact or similar)
        // For now, we just acknowledge receipt.

        return new NextResponse('<Response></Response>', {
            headers: { 'Content-Type': 'text/xml' },
            status: 200
        });
    } catch (error) {
        console.error("Error processing Twilio webhook:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
