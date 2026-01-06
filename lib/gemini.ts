import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// List of model names to try in order (prioritizing stable, free-tier friendly models)
const MODEL_FALLBACKS = [
    // Flash 1.5 - Best combination of speed, cost (free tier), and capability
    'gemini-1.5-flash',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-002',

    // Pro 1.5 - More capable
    'gemini-1.5-pro',
    'gemini-1.5-pro-001',
    'gemini-1.5-pro-002',

    // Legacy Pro
    'gemini-pro',

    // Models with 'models/' prefix (sometimes required)
    'models/gemini-1.5-flash',
    'models/gemini-1.5-flash-001',
    'models/gemini-1.5-flash-002',
    'models/gemini-1.5-pro',
    'models/gemini-1.5-pro-001',
    'models/gemini-1.5-pro-002',
    'models/gemini-pro',
];

/**
 * Try to get a working model by attempting multiple model names
 */
async function getWorkingModel() {
    // Validate API key format
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey.startsWith('AIza')) {
        throw new Error('Invalid Gemini API key format. API keys should start with "AIza". Please check your GEMINI_API_KEY in .env file.');
    }

    let lastError: any = null;

    for (const modelName of MODEL_FALLBACKS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            // Just return the model - we'll test it when actually generating content
            console.log(`🔄 Trying Gemini model: ${modelName}`);
            return { model, modelName };
        } catch (error: any) {
            lastError = error;
            console.log(`❌ Model ${modelName} initialization failed:`, error.message);
            // Continue to next model
        }
    }

    // If all models failed, provide detailed error message
    const errorMessage = `All Gemini models failed. 

Possible issues:
1. API Key: Make sure your GEMINI_API_KEY in .env is valid
2. Get a new key from: https://makersuite.google.com/app/apikey
3. Check internet connection
4. Verify API quota hasn't been exceeded

Last error: ${lastError?.message || 'Unknown error'}`;

    throw new Error(errorMessage);
}

/**
 * Generate text content using Gemini with automatic fallback
 */
export async function generateContent(
    prompt: string,
    context?: {
        platform?: string;
        existingContent?: string;
        tone?: string;
    }
): Promise<{ success: boolean; content?: string; subject?: string; error?: string }> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return {
                success: false,
                error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.',
            };
        }

        // Build enhanced prompt with context
        let enhancedPrompt = prompt;

        if (context) {
            const contextParts: string[] = [];

            if (context.platform) {
                const platformGuidelines: Record<string, string> = {
                    EMAIL: 'professional email format with subject line',
                    SMS: 'concise message under 160 characters',
                    WHATSAPP: 'casual and friendly tone with emojis',
                    FACEBOOK: 'engaging and conversational, 1-2 paragraphs',
                    INSTAGRAM: 'short, catchy with relevant hashtags and emojis',
                    LINKEDIN: 'professional and informative, business-focused',
                    YOUTUBE: 'compelling video description with keywords',
                    PINTEREST: 'descriptive and inspiring, focus on visuals',
                };

                const guideline = platformGuidelines[context.platform];
                if (guideline) {
                    contextParts.push(`Platform: ${context.platform} - Write in ${guideline}`);
                }
            }

            if (context.tone) {
                contextParts.push(`Tone: ${context.tone}`);
            }

            if (context.existingContent) {
                contextParts.push(`Existing content to improve/modify: "${context.existingContent}"`);
            }

            if (contextParts.length > 0) {
                enhancedPrompt = `${contextParts.join('\n')}\n\nUser request: ${prompt}\n\nGenerate the content.`;

                // If asking for a post with a platform, request JSON format
                if (context.platform && context.platform !== 'SMS') {
                    enhancedPrompt += `\n\nIMPORTANT: Respond ONLY with a valid JSON object in the following format:\n{\n  "subject": "The engaging title or subject line",\n  "content": "The main message body"\n}`;
                } else {
                    enhancedPrompt += `\n\nGenerate the content:`;
                }
            }
        }

        // Try each model until one works
        for (const modelName of MODEL_FALLBACKS) {
            try {
                console.log(`🔄 Trying model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                // Generate content
                const result = await model.generateContent(enhancedPrompt);
                const response = await result.response;
                const text = response.text();

                console.log(`✅ Successfully generated content with: ${modelName}`);

                let content = text;
                let subject = undefined;

                // Try to parse JSON response
                try {
                    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                        const json = JSON.parse(cleanText);
                        content = json.content;
                        subject = json.subject;
                    }
                } catch (e) {
                    console.log('Response was not JSON, using raw text');
                }

                return {
                    success: true,
                    content: content,
                    subject: subject
                };
            } catch (error: any) {
                // Check if it's a quota error (429) or rate limit
                if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                    console.log(`⚠️ Model ${modelName} quota exceeded, trying next model...`);
                    continue; // Try next model
                }

                // Check if it's a 404 (model not found)
                if (error.message?.includes('404') || error.message?.includes('not found')) {
                    console.log(`❌ Model ${modelName} not found, trying next model...`);
                    continue; // Try next model
                }

                // For other errors, log and try next model
                console.log(`❌ Model ${modelName} failed: ${error.message}`);
                continue;
            }
        }

        // If all models failed
        return {
            success: false,
            error: 'All Gemini models failed or exceeded quota. Please try again later or check your API quota at https://ai.dev/usage',
        };
    } catch (error: any) {
        console.error('Gemini API error:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate content',
        };
    }
}

/**
 * Generate an image using Gemini (via Imagen)
 * Note: This uses text-to-image generation
 */
export async function generateImage(
    prompt: string,
    style?: string
): Promise<{ success: boolean; imageData?: string; error?: string }> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return {
                success: false,
                error: 'Gemini API key not configured',
            };
        }

        const enhancedPrompt = `Create a detailed, professional image generation prompt for: ${prompt}${style ? ` in ${style} style` : ''}. 
    
    Format the response as a single, detailed prompt that can be used with image generation AI services like DALL-E or Midjourney. Include:
    - Subject and composition
    - Lighting and atmosphere
    - Color palette
    - Style and artistic direction
    - Quality indicators (high resolution, professional, etc.)
    
    Respond with ONLY the image prompt, no explanations.`;

        // Try each model until one works
        for (const modelName of MODEL_FALLBACKS) {
            try {
                console.log(`🔄 Trying model for image prompt: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

                const result = await model.generateContent(enhancedPrompt);
                const response = await result.response;
                const imagePrompt = response.text();

                console.log(`✅ Successfully generated image prompt with: ${modelName}`);
                return {
                    success: true,
                    imageData: imagePrompt,
                    error: 'Image generation requires additional setup. Here is an optimized prompt you can use with image generation services.',
                };
            } catch (error: any) {
                // Check if it's a quota error (429) or rate limit
                if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                    console.log(`⚠️ Model ${modelName} quota exceeded, trying next model...`);
                    continue;
                }

                // Check if it's a 404 (model not found)
                if (error.message?.includes('404') || error.message?.includes('not found')) {
                    console.log(`❌ Model ${modelName} not found, trying next model...`);
                    continue;
                }

                console.log(`❌ Model ${modelName} failed: ${error.message}`);
                continue;
            }
        }

        // If all models failed
        return {
            success: false,
            error: 'All Gemini models failed or exceeded quota. Please try again later.',
        };
    } catch (error: any) {
        console.error('Gemini image generation error:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate image',
        };
    }
}

/**
 * Refine existing content
 */
export async function refineContent(
    content: string,
    instruction: string,
    platform?: string
): Promise<{ success: boolean; content?: string; subject?: string; error?: string }> {
    const prompt = `${instruction}\n\nOriginal content: "${content}"`;
    return generateContent(prompt, { platform, existingContent: content });
}
