
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { currentUser } from '@clerk/nextjs/server';
import { SocialNormalizerService } from '@/lib/social-normalizer';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
    try {
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
        let analyticsContext;

        if (analyticsData) {
            console.log('[AI Chat] Using pre-fetched analytics data from cache');
            analyticsContext = analyticsData;
        } else {
            console.log('[AI Chat] No cached data provided, fetching from database...');
            const orgId = dbUser.organisationId;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // 1. Fetch Social Metric History (Granular time-series data)
            const socialMetrics = await prisma.socialMetricHistory.findMany({
                where: {
                    organisationId: orgId,
                    recordedAt: { gte: thirtyDaysAgo }
                },
                orderBy: { recordedAt: 'desc' },
                take: 200
            });

            // 2. Fetch Published Posts (PostTransaction)
            const postTransactions = await prisma.postTransaction.findMany({
                where: {
                    refId: orgId,
                    published: true
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            // 3. Fetch Campaign Posts for campaign-wise analysis
            const campaignPosts = await prisma.campaignPost.findMany({
                where: {
                    campaign: {
                        organisationId: orgId
                    },
                    isDeleted: false
                },
                include: {
                    campaign: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            // 4. Fetch Post Insights with complete details
            const allPostIds = [...postTransactions.map(p => p.postId), ...campaignPosts.map(p => p.id.toString())];
            const postInsights = await prisma.postInsight.findMany({
                where: {
                    postId: { in: allPostIds }
                }
            });

            // 5. Prepare RAW data arrays for AI (no aggregation - let AI analyze directly)

            // Map post insights with their corresponding post details
            const postsWithInsights = postTransactions.map(post => {
                const insight = postInsights.find(i => i.postId === post.postId);
                return {
                    postId: post.postId,
                    platform: post.platform,
                    message: post.message?.substring(0, 100), // Truncate for context size
                    publishedAt: post.publishedAt,
                    metrics: insight ? {
                        likes: insight.likes,
                        comments: insight.comments,
                        reach: insight.reach,
                        impressions: insight.impressions,
                        engagementRate: insight.engagementRate,
                        lastUpdated: insight.lastUpdated
                    } : null
                };
            });

            // Map campaign posts with insights
            const campaignPostsWithInsights = campaignPosts.map(post => {
                const insight = postInsights.find(i => i.postId === post.id.toString());
                return {
                    postId: post.id,
                    campaignName: post.campaign?.name || 'Uncategorized',
                    platform: post.type,
                    subject: post.subject,
                    scheduledTime: post.scheduledPostTime,
                    metrics: insight ? {
                        likes: insight.likes,
                        comments: insight.comments,
                        reach: insight.reach,
                        impressions: insight.impressions,
                        engagementRate: insight.engagementRate,
                        lastUpdated: insight.lastUpdated
                    } : null
                };
            });

            // Raw social metrics array (time-series data)
            const rawSocialMetrics = socialMetrics.map(m => ({
                platform: m.platform,
                metricName: m.metricName,
                value: m.value,
                recordedAt: m.recordedAt.toISOString().split('T')[0]
            }));

            // Prepare comprehensive RAW data context for AI
            analyticsContext = {
                // RAW ARRAYS - AI will analyze these directly
                allPosts: postsWithInsights,
                campaignPosts: campaignPostsWithInsights,
                socialMetricsTimeSeries: rawSocialMetrics,

                // Metadata
                dataInfo: {
                    totalPostsWithInsights: postsWithInsights.filter(p => p.metrics).length,
                    totalCampaignPosts: campaignPostsWithInsights.length,
                    totalSocialMetricRecords: rawSocialMetrics.length,
                    dateRange: {
                        from: thirtyDaysAgo.toISOString().split('T')[0],
                        to: new Date().toISOString().split('T')[0]
                    },
                    platformsAvailable: [...new Set([
                        ...postsWithInsights.map(p => p.platform),
                        ...rawSocialMetrics.map(m => m.platform)
                    ])]
                }
            };
        }

        // Prepare AI prompt
        const systemPrompt = `
You are an expert Social Media Analytics Assistant for CampZeo.
Your goal is to provide insightful, data-driven answers by analyzing RAW data arrays.

AVAILABLE RAW DATA ARRAYS:
${JSON.stringify(analyticsContext, null, 2)}

INSTRUCTIONS:
- You have access to COMPLETE raw data arrays, not pre-aggregated summaries
- For "Total Average Views": Calculate from the 'impressions' field in allPosts[].metrics
- For "Best Performing Platform": Analyze allPosts[] grouped by platform, compare total engagement
- For "Campaign Summary": Analyze campaignPosts[] grouped by campaignName
- For "Engagement Trends": Analyze socialMetricsTimeSeries[] over time
- Calculate averages, totals, and trends yourself from the raw data
- Be data-driven and provide specific numbers
- Format numbers clearly (e.g., "1.2k" for 1200)
- If data is missing, acknowledge it honestly

RESPONSE FORMAT:
Return JSON with:
- answer: Your main response text
- metrics: {value: number, unit: string} if applicable
- trend: "increasing"/"decreasing"/"stable" if applicable  
- recommendation: Actionable advice if applicable
`;

        // Generate AI response with structured JSON output
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        answer: { type: "string" },
                        metrics: {
                            type: "object",
                            properties: {
                                value: { type: "number" },
                                unit: { type: "string" }
                            }
                        },
                        trend: { type: "string" },
                        recommendation: { type: "string" }
                    },
                    required: ["answer"]
                }
            }
        });

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }],
                },
                {
                    role: "model",
                    parts: [{
                        text: JSON.stringify({
                            answer: "I've analyzed your social media analytics data. I can help you understand your performance across platforms, campaigns, and engagement trends. What would you like to know?",
                            trend: "ready",
                            recommendation: "Ask me about your metrics!"
                        })
                    }],
                },
            ],
        });

        const result = await chat.sendMessage(message);
        const response = result.response;
        const text = response.text();

        // Parse JSON response
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(text);
        } catch (e) {
            // Fallback if JSON parsing fails
            parsedResponse = { answer: text };
        }

        // Return the answer field as the message
        return NextResponse.json({ message: parsedResponse.answer || text });

    } catch (error: any) {
        console.error('AI Chat Error:', error);

        let errorMessage = "I'm having trouble analyzing your data right now. Please try again later.";

        // Handle specific Gemini API errors
        if (error.message?.includes("404") || error.message?.includes("not found")) {
            errorMessage = "Configuration Error: The AI model could not be accessed. Please ensure your 'GEMINI_API_KEY' is valid and the 'Google Generative AI API' is enabled in your Google Cloud Console.";
        } else if (error.message?.includes("403") || error.message?.includes("permission")) {
            errorMessage = "Permission Denied: Your API key does not have access to the AI model. Please check your Google AI Studio settings.";
        }

        return NextResponse.json({
            message: errorMessage
        }, { status: 500 });
    }
}
