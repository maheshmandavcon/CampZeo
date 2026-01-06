
/**
 * Pollinations.ai API Client
 * Free, no-key generative AI for text and images.
 */

/**
 * Generate text content using Pollinations.ai
 */
export async function generateContent(
    prompt: string,
    context?: {
        platform?: string;
        existingContent?: string;
        tone?: string;
    }
): Promise<{ success: boolean; content?: string; subject?: string; variations?: any[]; error?: string }> {
    try {
        let enhancedPrompt = prompt;
        const systemInstruction = "You are a helpful AI assistant for a marketing platform. Keep responses concise and professional.";

        if (context) {
            const contextParts: string[] = [];
            if (context.platform) contextParts.push(`Platform: ${context.platform}`);
            if (context.tone) contextParts.push(`Tone: ${context.tone}`);
            if (context.existingContent) contextParts.push(`Existing content: "${context.existingContent}"`);

            if (contextParts.length > 0) {
                enhancedPrompt = `${contextParts.join('\n')}\n\nUser request: ${prompt}`;

                // If asking for a post with a platform, request JSON format with multiple options
                if (context.platform && context.platform !== 'SMS') {
                    enhancedPrompt += `\n\nIMPORTANT: Provide 3 distinct variations of the content. Respond ONLY with a valid JSON object.
                    Rules:
                    1. 'subject' is the title/headline.
                    2. 'content' is the message body ONLY.
                    3. Do NOT repeat the 'subject' inside the 'content'.
                    4. 'content' should be ready to post.
                    
                    Format:\n{\n  "variations": [\n    {\n      "subject": "Catchy Title 1",\n      "content": "Message body 1 (which does NOT start with Catchy Title 1)"\n    },\n    {\n      "subject": "Catchy Title 2",\n      "content": "Message body 2 (which does NOT start with Catchy Title 2)"\n    }\n  ]\n}`;
                }
            }
        }

        // Pollinations text API
        // Using GET request with encoded prompt
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(systemInstruction + '\n\n' + enhancedPrompt)}?model=openai`);

        if (!response.ok) {
            throw new Error('Pollinations API request failed');
        }

        const text = await response.text();

        let content = text;
        let subject = undefined;
        let variations: any[] | undefined = undefined;

        // Try to parse JSON response
        try {
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                const json = JSON.parse(cleanText);

                if (json.variations && Array.isArray(json.variations)) {
                    variations = json.variations;
                    // Default to first variation for backward compat
                    content = json.variations[0].content;
                    subject = json.variations[0].subject;
                } else {
                    content = json.content;
                    subject = json.subject;
                }
            }
        } catch (e) {
            console.log('Response was not JSON, using raw text');
        }

        return {
            success: true,
            content,
            subject,
            variations
        };

    } catch (error: any) {
        console.error('Pollinations API error:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate content'
        };
    }
}

/**
 * Generate image using Pollinations.ai
 * Returns the image URL directly (no generation wait time needed as it streams)
 */
export async function generateImage(
    prompt: string,
    style?: string
): Promise<{ success: boolean; imageData?: string; error?: string }> {
    try {
        const enhancedPrompt = style ? `${prompt} ${style} style` : prompt;
        // Construct the URL. Pollinations generates image on the fly.
        // We add a random seed to ensure new images on same prompt if needed
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?nologo=true&seed=${seed}`;

        return {
            success: true,
            imageData: imageUrl
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
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
): Promise<{ success: boolean; content?: string; subject?: string; variations?: any[]; error?: string }> {
    const prompt = `Original content: "${content}"\n\nInstruction: ${instruction}\n\nPlease rewrite the content following the instruction.`;
    return generateContent(prompt, { platform, existingContent: content });
}
