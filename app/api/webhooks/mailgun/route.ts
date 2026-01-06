import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
    console.log("POST /api/webhooks/mailgun hit");

    try {
        const formData = await req.formData();
        const timestamp = formData.get('timestamp') as string;
        const token = formData.get('token') as string;
        const signature = formData.get('signature') as string;

        // Verify Mailgun signature
        const signingKey = process.env.MAILGUN_SIGNING_KEY; // You need to add this to your .env
        if (signingKey) {
            const value = timestamp + token;
            const hash = crypto.createHmac('sha256', signingKey)
                .update(value)
                .digest('hex');

            if (hash !== signature) {
                console.error("Invalid Mailgun signature");
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        } else {
            console.warn("MAILGUN_SIGNING_KEY not set, skipping signature verification");
        }

        const event = formData.get('event');
        const recipient = formData.get('recipient');
        const messageId = formData.get('Message-Id'); // Note: Mailgun sends 'Message-Id' or 'message-id' depending on event

        console.log(`Mailgun Event: ${event}, Recipient: ${recipient}, MessageId: ${messageId}`);

        // TODO: Update email status in database

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error processing Mailgun webhook:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
