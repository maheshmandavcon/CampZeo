import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateContent, refineContent } from '@/lib/pollinations';

export async function POST(request: NextRequest) {
    try {
        // Check authentication (Allow Clerk or Mobile API Key)
        let userId = null;
        const { userId: clerkUserId } = await auth();
        userId = clerkUserId;

        if (!userId) {
            const apiKey = request.headers.get('x-api-key');
            const validApiKey = process.env.MOBILE_API_KEY;
            if (apiKey && validApiKey && apiKey === validApiKey) {
                userId = 'mobile-app-user';
            }
        }

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, context, mode } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        let result;

        // Handle different modes
        if (mode === 'refine' && context?.existingContent) {
            result = await refineContent(
                context.existingContent,
                prompt,
                context.platform
            );
        } else {
            result = await generateContent(prompt, context);
        }

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to generate content' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            content: result.content,
            subject: result.subject,
            variations: result.variations,
        });
    } catch (error: any) {
        console.error('Generate content API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
