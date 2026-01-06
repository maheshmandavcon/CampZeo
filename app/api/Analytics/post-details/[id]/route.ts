import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getFacebookPostInsights } from '@/lib/facebook';
import { getInstagramPostInsights } from '@/lib/instagram';
import { getLinkedInPostInsights } from '@/lib/linkedin';
import { getYouTubeVideoInsights } from '@/lib/youtube';
import { getPinterestPostInsights } from '@/lib/pinterest';
import { getMailgunAnalytics } from '@/lib/email';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id }
        });

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
        }

        const { id } = await params;

        // Check if ID is a transaction ID or a platform postId
        const transactionId = parseInt(id);
        const searchParams = request.nextUrl.searchParams;
        const platform = searchParams.get('platform');
        const platformPostId = searchParams.get('postId');

        let transaction: any = null;

        if (!isNaN(transactionId) && transactionId > 0) {
            transaction = await prisma.postTransaction.findUnique({
                where: { id: transactionId }
            });
        }

        // Fallback: Lookup by platform and postId
        if (!transaction && platform && platformPostId) {
            console.log(`[Analytics Details] Post not found in DB or virtual. Simulating transaction for ${platform} post ${platformPostId}`);
            transaction = {
                id: -1,
                refId: 0,
                platform: platform.toUpperCase(),
                postId: platformPostId,
                publishedAt: new Date(),
                published: true,
                message: '',
                mediaUrls: ''
            };
        }

        if (!transaction) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        // Attach subject if it's a real transaction
        let subject = null;
        if (transaction.id !== -1 && transaction.refId !== 0) {
            const cp = await prisma.campaignPost.findUnique({
                where: { id: transaction.refId },
                select: { subject: true }
            });
            subject = cp?.subject || null;
        }
        transaction.subject = subject;

        // Verify ownership (only if it's a real transaction)
        if (transaction.id !== -1) {
            const campaignPost = await prisma.campaignPost.findUnique({
                where: { id: transaction.refId },
                include: { campaign: true }
            });

            if (!campaignPost || !campaignPost.campaign || campaignPost.campaign.organisationId !== dbUser.organisationId) {
                return NextResponse.json({ error: 'Post not found or unauthorized' }, { status: 404 });
            }
        }

        // Fetch db insight
        const dbInsight = await prisma.postInsight.findFirst({
            where: { postId: transaction.postId }
        });

        const forceRefresh = searchParams.get('fresh') === 'true';

        // Check freshness
        const ONE_HOUR = 60 * 60 * 1000;
        const isStale = !dbInsight || (Date.now() - new Date(dbInsight.lastUpdated).getTime() > ONE_HOUR);

        let finalInsight = dbInsight ? {
            likes: dbInsight.likes,
            comments: dbInsight.comments,
            reach: dbInsight.reach,
            impressions: dbInsight.impressions,
            engagementRate: dbInsight.engagementRate,
            lastUpdated: dbInsight.lastUpdated,
            isDeleted: (dbInsight as any).isDeleted ?? false
        } : {
            likes: 0,
            comments: 0,
            reach: 0,
            impressions: 0,
            engagementRate: 0,
            lastUpdated: null,
            isDeleted: false
        };

        if (isStale || forceRefresh) {
            console.log(`[Analytics Details] Refreshing insights for ${transaction.platform} post ${transaction.postId}`);

            let insights: any = {
                likes: 0,
                comments: 0,
                reach: 0,
                impressions: 0,
                engagementRate: 0,
                isDeleted: false
            };

            try {
                let token = null;

                switch (transaction.platform) {
                    case 'FACEBOOK':
                        token = dbUser.facebookPageAccessToken || dbUser.facebookAccessToken;
                        if (token) {
                            console.log(`[Facebook Details Sync] Fetching live insights for post ${transaction.postId}`);
                            insights = await getFacebookPostInsights(transaction.postId, token);
                            console.log(`[Facebook Details Sync] Live data: ${insights.likes} likes, ${insights.reach} reach`);
                        }
                        break;
                    case 'INSTAGRAM':
                        token = dbUser.instagramAccessToken;
                        if (token) {
                            insights = await getInstagramPostInsights(transaction.postId, token);
                        }
                        break;
                    case 'LINKEDIN':
                        token = dbUser.linkedInAccessToken;
                        if (token) {
                            insights = await getLinkedInPostInsights(transaction.postId, token);
                        }
                        break;
                    case 'YOUTUBE':
                        token = dbUser.youtubeAccessToken;
                        if (token) {
                            try {
                                console.log(`[YouTube Details Sync] Fetching live insights for video ${transaction.postId}`);
                                insights = await getYouTubeVideoInsights(transaction.postId, token);
                                console.log(`[YouTube Details Sync] Live data: ${insights.likes} likes, ${(insights as any).views || insights.reach} views/reach`);
                            } catch (e: any) {
                                if (e.message?.includes('401') && dbUser.youtubeAuthUrn) {
                                    const { refreshUserTokens } = await import("@/lib/social-refresh");
                                    const refresh = await refreshUserTokens(dbUser.clerkId);
                                    if (refresh.success && refresh.results.youtube.refreshed) {
                                        const updatedUser = await prisma.user.findUnique({ where: { clerkId: dbUser.clerkId } });
                                        if (updatedUser?.youtubeAccessToken) insights = await getYouTubeVideoInsights(transaction.postId, updatedUser.youtubeAccessToken);
                                    }
                                } else throw e;
                            }
                        }
                        break;
                    case 'EMAIL':
                        if (transaction.postId.startsWith('campaign-')) {
                            const emailStats = await getMailgunAnalytics(transaction.postId);
                            insights = {
                                likes: 0,
                                comments: 0,
                                reach: emailStats.delivered,
                                impressions: emailStats.opened,
                                engagementRate: 0,
                                isDeleted: false
                            };
                        } else if (dbInsight) {
                            insights = { ...dbInsight, isDeleted: false };
                        }
                        break;
                    case 'SMS':
                    case 'WHATSAPP':
                        // Typically constant data for these as they are one-off sends
                        if (dbInsight) {
                            insights = {
                                likes: dbInsight.likes,
                                comments: dbInsight.comments,
                                reach: dbInsight.reach,
                                impressions: dbInsight.impressions,
                                engagementRate: dbInsight.engagementRate,
                                isDeleted: false
                            };
                        }
                        break;
                    case 'PINTEREST':
                        token = dbUser.pinterestAccessToken;
                        if (token) {
                            try {
                                insights = await getPinterestPostInsights(transaction.postId, token);
                                if (insights.isDeleted && !transaction.publishedAt) { // Handle potential 401 hidden as 404/deleted if token is bad
                                    throw new Error('401');
                                }
                            } catch (e: any) {
                                if ((e.message?.includes('401') || insights?.isDeleted) && dbUser.pinterestAuthUrn) {
                                    const { refreshUserTokens } = await import("@/lib/social-refresh");
                                    const refresh = await refreshUserTokens(dbUser.clerkId);
                                    if (refresh.success && refresh.results.pinterest.refreshed) {
                                        const updatedUser = await prisma.user.findUnique({ where: { clerkId: dbUser.clerkId } });
                                        if (updatedUser?.pinterestAccessToken) insights = await getPinterestPostInsights(transaction.postId, updatedUser.pinterestAccessToken);
                                    }
                                } else throw e;
                            }
                        }
                        break;
                }

                let isDeleted = insights.isDeleted ?? false;
                const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
                const isVeryRecent = transaction.publishedAt && (Date.now() - new Date(transaction.publishedAt).getTime() < TWENTY_FOUR_HOURS);

                if (isDeleted && isVeryRecent) {
                    if (dbInsight) {
                        insights = {
                            ...insights,
                            likes: dbInsight.likes,
                            comments: dbInsight.comments,
                            reach: dbInsight.reach,
                            impressions: dbInsight.impressions,
                            engagementRate: dbInsight.engagementRate,
                            isDeleted: false
                        };
                        isDeleted = false;
                    } else {
                        isDeleted = false;
                    }
                }

                // Update insights in DB
                if (dbInsight) {
                    await prisma.postInsight.update({
                        where: { id: dbInsight.id },
                        data: {
                            likes: insights.likes,
                            comments: insights.comments,
                            reach: insights.reach,
                            impressions: insights.impressions,
                            engagementRate: insights.engagementRate,
                            isDeleted: isDeleted,
                            lastUpdated: new Date()
                        } as any
                    });
                } else {
                    await prisma.postInsight.create({
                        data: {
                            postId: transaction.postId,
                            likes: insights.likes,
                            comments: insights.comments,
                            reach: insights.reach,
                            impressions: insights.impressions,
                            engagementRate: insights.engagementRate,
                            isDeleted: isDeleted,
                            lastUpdated: new Date()
                        } as any
                    });
                }

                // Sync Metadata (message, mediaUrls)
                if (forceRefresh || !dbInsight) {

                    const freshMessage = insights.message || insights.caption || insights.text || insights.title || transaction.message;
                    let freshMedia = transaction.mediaUrls;

                    if (transaction.platform === 'FACEBOOK' && insights.full_picture) freshMedia = insights.full_picture;
                    if (transaction.platform === 'INSTAGRAM' && insights.media_url) freshMedia = insights.media_url;
                    if (transaction.platform === 'YOUTUBE' && insights.thumbnails?.high?.url) freshMedia = insights.thumbnails.high.url;
                    if (transaction.platform === 'PINTEREST' && insights.media?.images?.['600x']?.url) freshMedia = insights.media.images['600x'].url;

                    if (transaction.id !== -1) {
                        await prisma.postTransaction.update({
                            where: { id: transaction.id },
                            data: { message: freshMessage, mediaUrls: freshMedia }
                        });
                    }

                    if (transaction.refId !== 0) {
                        await prisma.campaignPost.update({
                            where: { id: transaction.refId },
                            data: {
                                message: freshMessage,
                                mediaUrls: freshMedia ? [freshMedia] : [],
                                isDeleted: isDeleted
                            } as any
                        });
                    }

                    transaction.message = freshMessage;
                    transaction.mediaUrls = freshMedia;
                } else if (transaction.refId !== 0) {
                    // Even if not force refresh, update isDeleted if it changed
                    await prisma.campaignPost.update({
                        where: { id: transaction.refId },
                        data: { isDeleted: isDeleted } as any
                    });
                }

                finalInsight = {
                    ...insights,
                    isDeleted: isDeleted,
                    lastUpdated: new Date()
                };

            } catch (err) {
                console.error(`[Analytics Details] Failed to refresh insights:`, err);
            }
        }

        const today = new Date();
        const publishedDate = transaction.publishedAt ? new Date(transaction.publishedAt) : new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Calculate days since publication, max 30 to keep it readable, min 7
        const msDiff = today.getTime() - publishedDate.getTime();
        const daysDiff = Math.max(7, Math.min(30, Math.ceil(msDiff / (1000 * 60 * 60 * 24))));

        const historicalData = Array.from({ length: daysDiff }).map((_, i) => {
            const d = new Date(publishedDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            // Linear growth simulation with fallback for missing reach
            const progress = (i + 1) / daysDiff;

            // If reach is 0 but we have likes/comments, simulate a baseline reach (e.g. 50x interactions)
            const interactions = finalInsight.likes + finalInsight.comments;
            const effectiveReach = (finalInsight.reach === 0 && interactions > 0)
                ? interactions * 50
                : finalInsight.reach;

            const effectiveImpressions = (finalInsight.impressions === 0 && interactions > 0)
                ? interactions * 75
                : finalInsight.impressions;

            const fakeLikes = Math.round(finalInsight.likes * (0.1 + 0.9 * progress));
            const fakeComments = Math.round(finalInsight.comments * (0.1 + 0.9 * progress));
            const fakeReach = Math.round(effectiveReach * (0.1 + 0.9 * progress));
            const fakeImpressions = Math.round(effectiveImpressions * (0.1 + 0.9 * progress));
            const fakeER = finalInsight.engagementRate > 0
                ? finalInsight.engagementRate * (0.5 + 0.5 * progress)
                : (effectiveReach > 0 ? (fakeLikes + fakeComments) / effectiveReach * 100 : 0);

            return {
                date: dateStr,
                likes: i === daysDiff - 1 ? finalInsight.likes : fakeLikes,
                comments: i === daysDiff - 1 ? finalInsight.comments : fakeComments,
                reach: i === daysDiff - 1 ? effectiveReach : fakeReach,
                impressions: i === daysDiff - 1 ? effectiveImpressions : fakeImpressions,
                engagementRate: i === daysDiff - 1 ? (finalInsight.engagementRate || fakeER) : fakeER
            };
        });

        return NextResponse.json({
            post: {
                ...transaction,
                message: transaction.message, // Ensure updated
                mediaUrls: transaction.mediaUrls,
                subject: transaction.subject,
                insight: finalInsight
            },
            historicalData,
            demographics: null
        });

    } catch (error: any) {
        console.error('[Analytics] Error fetching post details:', error);
        return NextResponse.json({
            error: 'Failed to fetch post details',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
