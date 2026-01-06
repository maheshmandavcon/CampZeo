import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust import based on your project structure

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message } = body;

        // 0. Build the request context 
        // We need to identify the user (and their organisation) to pass to N8N
        // In a real app, you might get this from session/cookies.
        // For this demo, we might need to assume a hardcoded org or fetch from header if sent.
        // However, the cleanest way in a Next.js app server component is usually:
        // const user = await currentUser(); (Clerk) or similar.

        // Let's assume we can get the logged in user using Clerk or your auth provider
        const { currentUser } = await import('@clerk/nextjs/server');
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { organisationId: true }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        // 1. Prepare payload for N8N
        const n8nPayload = {
            organisationId: dbUser.organisationId,
            message: message
        };

        // 2. Call N8N Webhook
        // The URL should be in your environment variables. 
        // Ideally: process.env.N8N_CHAT_WEBHOOK_URL
        // Fallback for this example if env not set yet.
        const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL;

        if (!webhookUrl) {
            // For development/demo purposes if variable is missing, warn or fail.
            console.error("Missing N8N_CHAT_WEBHOOK_URL env variable");
            return NextResponse.json({
                message: "Error: AI Service not configured (Missing Webhook URL)."
            }, { status: 503 });
        }

        const n8nResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(n8nPayload)
        });

        if (!n8nResponse.ok) {
            throw new Error(`N8N responded with ${n8nResponse.status}`);
        }

        const data = await n8nResponse.json();

        // 3. Return the AI's response to the frontend
        return NextResponse.json({ message: data.message || "I processed your request." });

    } catch (error) {
        console.error('AI Chat Error:', error);
        return NextResponse.json({
            message: "Sorry, I encountered an error connecting to the brain."
        }, { status: 500 });
    }
}
