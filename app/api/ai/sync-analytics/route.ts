import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFacebookPagePosts, getFacebookPostInsights } from '@/lib/facebook';

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get('x-api-key');

    // Basic API Key check
    if (process.env.N8N_API_KEY && apiKey !== process.env.N8N_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { organisationId } = body;

        if (!organisationId) {
            return NextResponse.json({ error: 'Missing organisationId' }, { status: 400 });
        }

        // Find a user with Facebook connected for this org
        const user = await prisma.user.findFirst({
            where: {
                organisationId: Number(organisationId),
                facebookAccessToken: { not: null },
                facebookPageId: { not: null }
            }
        });

        let facebookData = null;

        if (user && (user.facebookPageAccessToken || user.facebookAccessToken) && user.facebookPageId) {
            try {
                const fbToken = user.facebookPageAccessToken || user.facebookAccessToken;
                const credentials = {
                    accessToken: fbToken!,
                    pageId: user.facebookPageId
                };

                const posts = await getFacebookPagePosts(credentials);

                // Get insights for recent posts (top 5)
                const insights = await Promise.all(posts.slice(0, 5).map(async (post) => {
                    try {
                        const insight = await getFacebookPostInsights(post.id, fbToken!);
                        return { ...post, insights: insight };
                    } catch (e) {
                        return post;
                    }
                }));

                facebookData = insights;
            } catch (e) {
                console.error('Error fetching FB data', e);
            }
        }

        const result = {
            organisationId,
            timestamp: new Date().toISOString(),
            platforms: {
                facebook: facebookData
            }
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
