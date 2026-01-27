import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFacebookPostInsights } from '@/lib/facebook';
import { getInstagramPostInsights } from '@/lib/instagram';
import { getLinkedInPostInsights } from '@/lib/linkedin';
import { getYouTubeVideoInsights } from '@/lib/youtube';
import { getPinterestPostInsights } from '@/lib/pinterest';

export async function GET(request: NextRequest) {
    try {
        // Authenticate the request (e.g., via a secret token in headers for cron)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // For now, allow manual triggers in dev if no secret is set
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 1. Find posts published more than 24h ago that haven't been synced recently
        // Or posts that were just published and need their first sync
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const postsToSync = await prisma.campaignPost.findMany({
            where: {
                isPostSent: true,
                publishedDate: {
                    not: null,
                    lte: last24h // At least 24h old
                },
                isDeleted: false
            },
            include: {
                campaign: {
                    include: {
                        organisation: {
                            include: {
                                users: {
                                    where: {
                                        role: 'ADMIN_USER' // Try to get an admin's tokens
                                    },
                                    take: 1
                                }
                            }
                        }
                    }
                }
            },
            take: 20 // Process in batches
        });

        const results = [];

        for (const post of postsToSync) {
            const adminUser = post.campaign?.organisation.users[0];
            if (!adminUser) continue;

            let insights: any = null;
            const postId = post.metadata && (post.metadata as any).platformPostId; // Assuming we store this

            if (!postId) continue;

            try {
                switch (post.type) {
                    case 'FACEBOOK':
                        if (adminUser.facebookPageAccessToken) {
                            insights = await getFacebookPostInsights(postId, adminUser.facebookPageAccessToken);
                        }
                        break;
                    case 'INSTAGRAM':
                        if (adminUser.instagramAccessToken) {
                            insights = await getInstagramPostInsights(postId, adminUser.instagramAccessToken);
                        }
                        break;
                    case 'LINKEDIN':
                        if (adminUser.linkedInAccessToken) {
                            insights = await getLinkedInPostInsights(postId, adminUser.linkedInAccessToken);
                        }
                        break;
                    case 'YOUTUBE':
                        if (adminUser.youtubeAccessToken) {
                            insights = await getYouTubeVideoInsights(postId, adminUser.youtubeAccessToken);
                        }
                        break;
                    case 'PINTEREST':
                        if (adminUser.pinterestAccessToken) {
                            insights = await getPinterestPostInsights(postId, adminUser.pinterestAccessToken);
                        }
                        break;
                }

                if (insights) {
                    await prisma.campaignPost.update({
                        where: { id: post.id },
                        data: {
                            engagement: insights,
                            updatedAt: new Date()
                        }
                    });
                    results.push({ id: post.id, success: true });
                }
            } catch (err) {
                console.error(`Failed to sync engagement for post ${post.id}:`, err);
                results.push({ id: post.id, success: false, error: (err as Error).message });
            }
        }

        return NextResponse.json({
            message: `Processed ${postsToSync.length} posts`,
            results
        });

    } catch (error) {
        console.error('Engagement sync error:', error);
        return NextResponse.json({ error: 'Failed to sync engagement' }, { status: 500 });
    }
}
