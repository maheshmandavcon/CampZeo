import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

     const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "campzeo_direct_verify_2024";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Instagram Webhook Verified successfully!");
        return new Response(challenge, { status: 200 });
    }

    console.warn("❌ Instagram Webhook Verification failed: Token mismatch");
    return new Response("Forbidden", { status: 403 });
}


export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("🔵 Received Instagram Webhook:", JSON.stringify(body, null, 2));

        
        return NextResponse.json({ status: "ok" });
    } catch (e) {
        console.error("❌ Error processing Instagram Webhook:", e);
        return NextResponse.json({ error: "failed" }, { status: 500 });
    }
}
