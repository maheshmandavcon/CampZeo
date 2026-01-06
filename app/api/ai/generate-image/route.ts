import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateImage } from '@/lib/pollinations';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, style } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const result = await generateImage(prompt, style);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.error || 'Failed to generate image',
                    imagePrompt: result.imageData // Return the enhanced prompt even on "error"
                },
                { status: 200 } // Return 200 since we're providing useful data
            );
        }

        return NextResponse.json({
            success: true,
            imagePrompt: result.imageData,
            message: 'Image prompt generated. You can use this with image generation services like DALL-E or Midjourney.',
        });
    } catch (error: any) {
        console.error('Generate image API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
