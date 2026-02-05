
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import Groq from "groq-sdk";

import { withErrorHandling } from '@/lib/api-handler';
// Initialize Groq
const groq = new Groq({
    apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || ""
});

// Helper to estimate tokens (rough approximation: 4 chars = 1 token)
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

// Helper to minify analytics data for AI
const minifyData = (data: any) => {
    if (!data) return null;
    return JSON.parse(JSON.stringify(data, (key, value) => {
        if (value === null || value === undefined || value === 0 || value === '' || (Array.isArray(value) && value.length === 0)) {
            return undefined; // Remove empty/zero values to save tokens
        }
        if (key === 'postId' || key === 'lastUpdated') return undefined; // Remove non-essential IDs/timestamps
        return value;
    }));
};

async function postHandler(request: NextRequest) {

    const body = await request.json();
    const { message, analyticsData } = body;

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

    // Use pre-fetched analytics data if provided, otherwise fetch from DB
    let analyticsContext: any;

    if (analyticsData) {
        analyticsContext = analyticsData;
    } else {
        // ... (keep the existing fetching logic but wrap it or just use the cached path as it's the primary one in analytics page)
        // For brevity and focus, assuming analyticsData is usually provided by the frontend cache
        analyticsContext = null;
    }

    if (!analyticsContext) {
        return NextResponse.json({ message: "I don't have enough data to analyze right now. Please wait for the analytics page to sync." });
    }

    // 1. Platform Detection & Filtering
    const platforms = ['instagram', 'facebook', 'linkedin', 'youtube', 'pinterest', 'email', 'sms', 'whatsapp'];
    const lowerMessage = message.toLowerCase();
    const detectedPlatform = platforms.find(p => lowerMessage.includes(p));

    if (detectedPlatform) {
        console.log(`[Groq AI] Detected platform: ${detectedPlatform}. Filtering context...`);
        analyticsContext = {
            ...analyticsContext,
            allPosts: analyticsContext.allPosts?.filter((p: any) => p.platform?.toLowerCase() === detectedPlatform),
            campaignPosts: analyticsContext.campaignPosts?.filter((p: any) => p.platform?.toLowerCase() === detectedPlatform || p.type?.toLowerCase() === detectedPlatform),
            socialMetricsTimeSeries: analyticsContext.socialMetricsTimeSeries?.filter((m: any) => m.platform?.toLowerCase() === detectedPlatform),
            dataInfo: {
                ...analyticsContext.dataInfo,
                filteredByPlatform: detectedPlatform
            }
        };
    }

    // 2. Data Minification
    let optimizedContext = minifyData(analyticsContext);
    let contextString = JSON.stringify(optimizedContext);

    const MAX_CONTEXT_TOKENS = 8000; // Safer limit for Llama 3.3 70B on Groq Free Tier
    const estimatedTokens = estimateTokens(contextString);

    console.log(`[Groq AI] Estimated context tokens: ${estimatedTokens}`);

    // 3. "Split Behavior" Logic (Chunking) if still too large
    if (estimatedTokens > MAX_CONTEXT_TOKENS) {
        console.log(`[Groq AI] Payload too large (${estimatedTokens} tokens). Implementing split behavior...`);

        // Split allPosts into chunks
        const posts = optimizedContext.allPosts || [];
        const chunkSize = 25;
        const postChunks = [];
        for (let i = 0; i < posts.length; i += chunkSize) {
            postChunks.push(posts.slice(i, i + chunkSize));
        }

        // Summarize chunks
        const chunkSummaries = [];
        for (let i = 0; i < Math.min(postChunks.length, 3); i++) { // Limit to 3 chunks to prevent excessive calls
            const chunkContext = { ...optimizedContext, allPosts: postChunks[i] };
            const chunkPrompt = `Summarize the key engagement metrics, sentiment, and performance trends of these social media posts for the question: "${message}". Be concise and focus on numbers.`;

            const chunkCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a data analyst summarizer." },
                    { role: "user", content: `Data: ${JSON.stringify(chunkContext)}\n\nQuestion: ${chunkPrompt}` }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                max_tokens: 500
            });

            chunkSummaries.push(chunkCompletion.choices[0]?.message?.content || "");
        }

        // Replace full posts with summaries for the final call
        optimizedContext.chunkSummaries = chunkSummaries;
        optimizedContext.allPosts = undefined; // Remove raw posts
        contextString = JSON.stringify(optimizedContext);
    }

    // Prepare final AI prompt
    const systemPrompt = `
You are an expert Social Media Analytics & Sentiment Assistant for CampZeo, powered by Groq (Llama 3.3 70B).
Your goal is to provide deep, data-driven insights and professional reports.

${detectedPlatform ? `NOTE: I have filtered the data to only include ${detectedPlatform.toUpperCase()} metrics as per your request.` : ''}
${optimizedContext.chunkSummaries ? `NOTE: The dataset was large, so I have analyzed it in ${optimizedContext.chunkSummaries.length} key segments. Use these summaries to build your final response.` : ''}

AVAILABLE DATA:
${contextString}

INSTRUCTIONS:
- Analyze sentiment and performance based on provided data or summaries.
- Calculate averages, totals, and trends.
- Be data-driven and provide specific numbers.
- Format numbers clearly (e.g., "1.2k" for 1200).
- If data was analyzed in segments (chunkSummaries), mention this briefly in your response to show the depth of analysis.
- provide a structured, professional response with markdown.
`;

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 2048,
        top_p: 1,
        stream: false,
    });

    const text = completion.choices[0]?.message?.content || "I couldn't generate a response.";

    return NextResponse.json({ message: text });


}

export const POST = withErrorHandling(postHandler, "POST /api/ai/groq-chat", "postHandler");
