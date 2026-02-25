import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateImage as generatePollinationsImage } from '@/lib/pollinations';
import { generateImage as generateHordeImage } from '@/lib/ai-horde';
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

    console.log(`[GenerateImage] Attempting generation for: "${prompt}"`);

    // Try AI Horde first as it is currently more stable than Pollinations for many users
    // or if the prompt is complex. We'll try Horde because the user reported Pollinations failure.
    let result = await generateHordeImage(prompt, style);

    // If Horde fails, try Pollinations as a secondary
    if (!result.success) {
        console.log(`[GenerateImage] Horde failed (${result.error}), trying Pollinations...`);
        result = await generatePollinationsImage(prompt, style, { model, width, height });
    }

    if (!result.success) {
        return NextResponse.json(
            {
                error: result.error || 'Failed to generate image after multiple attempts',
                imagePrompt: result.imageData
            },
            { status: 200 } // Still 200 to show the useful prompt if available
        );
    }

    return NextResponse.json({
        success: true,
        imagePrompt: result.imageData, // This could be a URL or data URL
        imageUrl: result.imageData,
        provider: result.imageData?.startsWith('data:') ? 'horde' : 'pollinations',
        message: 'Image generated successfully',
    });
}

export const POST = withErrorHandling(generateImageHandler, "POST /api/ai/generate-image");
