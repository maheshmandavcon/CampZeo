import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateImage } from '@/lib/pollinations';

import { withErrorHandling } from '@/lib/api-handler';

async function generateImageHandler(request: NextRequest) {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, style, model, width, height } = body;

    if (!prompt) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const result = await generateImage(prompt, style, { model, width, height });

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
}

export const POST = withErrorHandling(generateImageHandler, "POST /api/ai/generate-image");
