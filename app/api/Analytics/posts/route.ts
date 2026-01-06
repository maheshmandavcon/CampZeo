import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getFacebookPagePosts, getFacebookPostInsights } from '@/lib/facebook';
import { getInstagramUserMedia, getInstagramPostInsights } from '@/lib/instagram';
import { getLinkedInUserPosts, getLinkedInPostInsights } from '@/lib/linkedin';
import { getYouTubeChannelVideos, getYouTubeVideoInsights } from '@/lib/youtube';
import { getPinterestUserPins, getPinterestPostInsights } from '@/lib/pinterest';
import { getMailgunAnalytics } from '@/lib/email';

export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const platform = searchParams.get('platform');
        const forceRefresh = searchParams.get('fresh') === 'true';

        // Pagination Params
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        // Filter Params
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!platform) {
            return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
        }

        // Get user's organisation and TOKENS
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: {
                organisationId: true,
                facebookAccessToken: true,
                facebookPageAccessToken: true,
                facebookPageId: true,
                instagramAccessToken: true,
                instagramUserId: true,
                linkedInAccessToken: true,
                youtubeAccessToken: true,
                youtubeAuthUrn: true,
                pinterestAccessToken: true,
                pinterestAuthUrn: true
            }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        // 1. Get all campaigns for the organisation
        const campaigns = await prisma.campaign.findMany({
            where: {
                organisationId: dbUser.organisationId,
                isDeleted: false,
            },
            select: { id: true }
        });

        const campaignIds = campaigns.map(c => c.id);

        if (campaignIds.length === 0) {
            return NextResponse.json({ posts: [], totalCount: 0, totalPages: 0, currentPage: page });
        }

        // 2. Get all campaign posts
        const campaignPosts = await prisma.campaignPost.findMany({
            where: {
                campaignId: { in: campaignIds }
            },
            select: { id: true }
        });

        const campaignPostIds = campaignPosts.map(p => p.id);

        if (campaignPostIds.length === 0) {
            return NextResponse.json({ posts: [], totalCount: 0, totalPages: 0, currentPage: page });
        }

        // 3. Construct Where Clause for Transactions
        const whereClause: any = {
            refId: { in: campaignPostIds },
            platform: platform.toUpperCase(),
            published: true,
            postId: { not: '' }
        };

        // Add Date Filters if provided
        if (startDate || endDate) {
            whereClause.publishedAt = {};
            if (startDate) whereClause.publishedAt.gte = new Date(startDate);
            if (endDate) whereClause.publishedAt.lte = new Date(endDate);
        }

        // 3.1 Get count for pagination
        const totalCount = await prisma.postTransaction.count({ where: whereClause });

        // 3.2 Get paginated transactions
        let transactions = await prisma.postTransaction.findMany({
            where: whereClause,
            orderBy: {
                publishedAt: 'desc'
            },
            skip: skip,
            take: limit
        });

        // 3.5 Fallback / Sync: If no transactions found OR force refresh requested, fetch from platform
        // NOTE: Syncing is typically done for the latest content. Paginating might mean sync only happens when on page 1.
        if ((transactions.length === 0 && page === 1) || forceRefresh) {
            console.log(`[Analytics] Syncing posts for ${platform} (Transactions: ${transactions.length}, Refresh: ${forceRefresh})`);

            try {
                const platformUpper = platform.toUpperCase();
                let platformPosts: any[] = [];
                if (platformUpper === 'FACEBOOK' && (dbUser.facebookPageAccessToken || dbUser.facebookAccessToken)) {
                    try {
                        console.log(`[Facebook Sync] Fetching page posts for ${dbUser.facebookPageId}`);
                        const fbPosts = await getFacebookPagePosts({
                            accessToken: (dbUser.facebookPageAccessToken || dbUser.facebookAccessToken)!,
                            pageId: dbUser.facebookPageId || ''
                        }, 50);
                        console.log(`[Facebook Sync] Found ${fbPosts.length} posts`);
                        platformPosts = fbPosts.map((p: any) => ({
                            id: -1,
                            refId: 0,
                            platform: 'FACEBOOK',
                            postId: p.id,
                            accountId: dbUser.facebookPageId || '',
                            message: p.message || '',
                            mediaUrls: p.full_picture || '',
                            postType: 'POST',
                            accessToken: '',
                            published: true,
                            publishedAt: p.created_time,
                            createdAt: p.created_time,
                            updatedAt: p.created_time
                        }));
                    } catch (e: any) {
                        console.error(`[Facebook Sync] Error:`, e.message);
                    }
                } else if (platformUpper === 'INSTAGRAM' && dbUser.instagramAccessToken && dbUser.instagramUserId) {
                    try {
                        const igMedia = await getInstagramUserMedia({
                            accessToken: dbUser.instagramAccessToken,
                            userId: dbUser.instagramUserId
                        }, 25);
                        platformPosts = igMedia.map((m: any) => ({
                            id: 0,
                            refId: 0,
                            platform: 'INSTAGRAM',
                            postId: m.id,
                            accountId: dbUser.instagramUserId || '',
                            message: m.caption || '',
                            mediaUrls: m.media_url,
                            postType: m.media_type,
                            accessToken: '',
                            published: true,
                            publishedAt: m.timestamp,
                            createdAt: m.timestamp,
                            updatedAt: m.timestamp
                        }));
                    } catch (e: any) {
                        console.error(`[Instagram Sync] Error:`, e.message);
                    }
                } else if (platformUpper === 'LINKEDIN' && dbUser.linkedInAccessToken) {
                    try {
                        // Need authorUrn from somewhere, assuming it's linked to the user or we can fetch it?
                        // Usually we store it in linkedInAuthUrn
                        const dbUserFull = await prisma.user.findUnique({ where: { clerkId: user.id } });
                        if (dbUserFull?.linkedInAuthUrn) {
                            const liPosts = await getLinkedInUserPosts({
                                accessToken: dbUser.linkedInAccessToken,
                                authorUrn: dbUserFull.linkedInAuthUrn
                            }, 10);
                            platformPosts = liPosts.map((p: any) => ({
                                id: 0,
                                refId: 0,
                                platform: 'LINKEDIN',
                                postId: p.id,
                                accountId: dbUserFull.linkedInAuthUrn || '',
                                message: p.text || '',
                                mediaUrls: p.media?.[0]?.originalUrl || '',
                                postType: 'POST',
                                accessToken: '',
                                published: true,
                                publishedAt: p.createdAt,
                                createdAt: p.createdAt,
                                updatedAt: p.createdAt
                            }));
                        }
                    } catch (e: any) {
                        console.error(`[LinkedIn Sync] Error:`, e.message);
                    }
                } else if (platformUpper === 'YOUTUBE' && dbUser.youtubeAccessToken) {
                    let ytVideos: any[] = [];
                    try {
                        console.log(`[YouTube Sync] Fetching channel videos with token...`);
                        ytVideos = await getYouTubeChannelVideos(dbUser.youtubeAccessToken, 50);
                        console.log(`[YouTube Sync] Found ${ytVideos.length} videos`);
                    } catch (e: any) {
                        if (e.message?.includes('401') && dbUser.youtubeAuthUrn) {
                            const { refreshUserTokens } = await import("@/lib/social-refresh");
                            const refresh = await refreshUserTokens(user.id);
                            if (refresh.success && refresh.results.youtube.refreshed) {
                                const updatedUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
                                if (updatedUser?.youtubeAccessToken) ytVideos = await getYouTubeChannelVideos(updatedUser.youtubeAccessToken, 10);
                            }
                        } else {
                            console.error(`[YouTube Sync] Error:`, e.message);
                        }
                    }
                    platformPosts = ytVideos.map((v: any) => ({
                        id: 0,
                        refId: 0,
                        platform: 'YOUTUBE',
                        postId: v.id,
                        accountId: '',
                        message: v.title,
                        mediaUrls: v.thumbnails?.high?.url || '',
                        postType: 'VIDEO',
                        accessToken: '',
                        published: true,
                        publishedAt: v.publishedAt,
                        createdAt: v.publishedAt,
                        updatedAt: v.publishedAt
                    }));
                } else if (platformUpper === 'PINTEREST' && dbUser.pinterestAccessToken) {
                    let pinPosts: any[] = [];
                    try {
                        pinPosts = await getPinterestUserPins(dbUser.pinterestAccessToken, 50);
                    } catch (e: any) {
                        if (e.message?.includes('401') && dbUser.pinterestAuthUrn) {
                            const { refreshUserTokens } = await import("@/lib/social-refresh");
                            const refresh = await refreshUserTokens(user.id);
                            if (refresh.success && refresh.results.pinterest.refreshed) {
                                const updatedUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
                                if (updatedUser?.pinterestAccessToken) pinPosts = await getPinterestUserPins(updatedUser.pinterestAccessToken, 50);
                            }
                        } else {
                            console.error(`[Pinterest Sync] Error:`, e.message);
                        }
                    }
                    platformPosts = pinPosts.map((p: any) => ({
                        id: 0,
                        refId: 0,
                        platform: 'PINTEREST',
                        postId: p.id,
                        accountId: '',
                        message: p.title || p.description || '',
                        mediaUrls: p.media?.images?.['600x']?.url || '',
                        postType: 'PIN',
                        accessToken: '',
                        published: true,
                        publishedAt: p.createdAt,
                        createdAt: p.createdAt,
                        updatedAt: p.createdAt
                    }));
                }


                // Merge with existing transactions and persist new ones
                if (platformPosts.length > 0) {
                    // Check against ALL existing post IDs for this platform and organisation, not just the paginated ones
                    const allExistingTransactions = await prisma.postTransaction.findMany({
                        where: {
                            refId: { in: campaignPostIds },
                            platform: platform.toUpperCase(),
                        },
                        select: { postId: true }
                    });

                    const existingPostIds = new Set(allExistingTransactions.map((t: any) => t.postId));
                    const newPosts = platformPosts.filter((p: any) => !existingPostIds.has(p.postId));

                    if (newPosts.length > 0) {
                        console.log(`[Analytics] Found ${newPosts.length} new external posts for ${platform}. Persisting to DB...`);

                        // Persist new posts to PostTransaction to give them real IDs and history
                        const createdTransactions = await Promise.all(newPosts.map(async (p: any) => {
                            try {
                                return await prisma.postTransaction.create({
                                    data: {
                                        refId: 0, // 0 indicates external/imported post
                                        platform: p.platform,
                                        postId: p.postId,
                                        accountId: p.accountId,
                                        message: p.message,
                                        mediaUrls: p.mediaUrls,
                                        postType: p.postType,
                                        accessToken: 'SYNCED',
                                        published: true,
                                        publishedAt: new Date(p.publishedAt),
                                        createdAt: new Date(p.createdAt),
                                        updatedAt: new Date(),
                                        insightsFetched: false
                                    }
                                });
                            } catch (err) {
                                console.error(`[Analytics] Failed to persist post ${p.postId}:`, err);
                                return null;
                            }
                        }));

                        // Re-fetch transactions for current page if we added new ones
                        const validCreated = createdTransactions.filter(t => t !== null);
                        if (validCreated.length > 0) {
                            transactions = await prisma.postTransaction.findMany({
                                where: whereClause,
                                orderBy: { publishedAt: 'desc' },
                                skip: skip,
                                take: limit
                            });
                        }
                    }
                }
            } catch (fallbackError) {
                console.error(`[Analytics] Platform sync failed:`, fallbackError);
            }
        }


        // 3.6 Fetch Subjects for these transactions
        // We need to fetch subjects from the CampaignPost table for internal posts (refId > 0)
        const refIds = transactions.map(t => t.refId).filter(id => id > 0);
        let subjectsMap = new Map<number, string | null>();

        if (refIds.length > 0) {
            const campaignPosts = await prisma.campaignPost.findMany({
                where: { id: { in: refIds } },
                select: { id: true, subject: true }
            });
            campaignPosts.forEach(cp => subjectsMap.set(cp.id, cp.subject));
        }

        // 4. Fetch insights for these transactions (and update if stale)
        const postsWithInsights = await Promise.all(transactions.map(async (tx) => {
            // Attach subject
            const subject = tx.refId > 0 ? subjectsMap.get(tx.refId) || null : null;
            const txWithSubject = { ...tx, subject };

            // Check if insights exist and are fresh (e.g., < 1 hour old)
            // Or if we should force refresh
            const dbInsight = await prisma.postInsight.findFirst({
                where: { postId: tx.postId }
            });

            const ONE_HOUR = 60 * 60 * 1000;
            const isStale = !dbInsight || (Date.now() - new Date(dbInsight.lastUpdated).getTime() > ONE_HOUR);

            // If not stale, return cached data
            if (!isStale && dbInsight && !forceRefresh) {
                return {
                    ...txWithSubject,
                    insight: dbInsight
                };
            }

            // If stale, fetch fresh data from Platform API
            console.log(`[Analytics] Refreshing insights for ${tx.platform} post ${tx.postId}`);

            // Explicitly type the result object
            let insights: {
                likes: number;
                comments: number;
                reach: number;
                impressions: number;
                engagementRate: number;
                isDeleted?: boolean;
            } = {
                likes: 0,
                comments: 0,
                reach: 0,
                impressions: 0,
                engagementRate: 0,
                isDeleted: false
            };

            try {
                // Determine which token to use and check if it exists
                let token = null;

                switch (tx.platform) {
                    case 'FACEBOOK':
                        token = dbUser.facebookPageAccessToken || dbUser.facebookAccessToken;
                        if (token) {
                            try {
                                console.log(`[Facebook Insights] Fetching live insights for post ${tx.postId}`);
                                insights = await getFacebookPostInsights(tx.postId, token);
                                console.log(`[Facebook Insights] Live data: ${insights.likes} likes, ${insights.reach} reach`);
                            } catch (fbErr: any) {
                                console.error(`[Facebook Insights] Error for ${tx.postId}:`, fbErr.message);
                                // If 401, we might need re-auth (Facebook doesn't have auto-refresh here yet)
                            }
                        } else {
                            console.warn('[Analytics] No Facebook access token found for user');
                        }
                        break;
                    case 'INSTAGRAM':
                        token = dbUser.instagramAccessToken;
                        if (token) {
                            const igInsights = await getInstagramPostInsights(tx.postId, token);
                            insights = { ...igInsights };
                        }
                        break;
                    case 'EMAIL':
                        // Fetch real analytics from Mailgun using the tag (tx.postId)
                        // Only fetch if forceRefresh is true or we want live data
                        if (tx.postId.startsWith('campaign-')) {
                            const emailStats = await getMailgunAnalytics(tx.postId);
                            insights = {
                                likes: 0,
                                comments: 0,
                                reach: emailStats.delivered, // Delivered count
                                impressions: emailStats.opened, // Opens
                                engagementRate: 0,
                                isDeleted: false
                            };
                        } else if (dbInsight) {
                            insights = { ...dbInsight, isDeleted: false };
                        }
                        break;
                    case 'SMS':
                    case 'WHATSAPP':
                        // These are internal logs, just return what's in DB (or Mock external API)
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
                    case 'LINKEDIN':
                        token = dbUser.linkedInAccessToken;
                        if (token) {
                            insights = await getLinkedInPostInsights(tx.postId, token);
                        } else {
                            console.warn('[Analytics] No LinkedIn access token found for user');
                        }
                        break;
                    case 'YOUTUBE':
                        token = dbUser.youtubeAccessToken;
                        if (token) {
                            try {
                                console.log(`[YouTube Insights] Fetching live insights for video ${tx.postId}`);
                                const videoInsights = await getYouTubeVideoInsights(tx.postId, token);
                                console.log(`[YouTube Insights] Live data: ${videoInsights.likes} likes, ${videoInsights.views || videoInsights.reach} views/reach`);
                                insights = { ...videoInsights };
                            } catch (e: any) {
                                if (e.message?.includes('401') && (dbUser as any).youtubeAuthUrn) {
                                    const { refreshUserTokens } = await import("@/lib/social-refresh");
                                    const refresh = await refreshUserTokens(user.id);
                                    if (refresh.success && refresh.results.youtube.refreshed) {
                                        const updatedUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
                                        if (updatedUser?.youtubeAccessToken) {
                                            const videoInsights = await getYouTubeVideoInsights(tx.postId, updatedUser.youtubeAccessToken);
                                            insights = { ...videoInsights };
                                        }
                                    }
                                }
                            }
                        } else {
                            console.warn('[Analytics] No YouTube access token found for user');
                        }
                        break;
                    case 'PINTEREST':
                        token = dbUser.pinterestAccessToken;
                        if (token) {
                            try {
                                const pinInsights = await getPinterestPostInsights(tx.postId, token);
                                insights = { ...pinInsights };
                            } catch (e: any) {
                                if ((e.message?.includes('401')) && (dbUser as any).pinterestAuthUrn) {
                                    const { refreshUserTokens } = await import("@/lib/social-refresh");
                                    const refresh = await refreshUserTokens(user.id);
                                    if (refresh.success && refresh.results.pinterest.refreshed) {
                                        const updatedUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
                                        if (updatedUser?.pinterestAccessToken) {
                                            const pinInsights = await getPinterestPostInsights(tx.postId, updatedUser.pinterestAccessToken);
                                            insights = { ...pinInsights };
                                        }
                                    }
                                }
                            }
                        } else {
                            console.warn('[Analytics] No Pinterest access token found for user');
                        }
                        break;
                }

                // Update or Create PostInsight in DB
                let isDeleted = insights.isDeleted ?? false;

                // [Smart Grace Period Fix] Handles eventual consistency (posts not immediately indexed).
                const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
                const isVeryRecent = tx.publishedAt && (Date.now() - new Date(tx.publishedAt).getTime() < TWENTY_FOUR_HOURS);

                if (isDeleted && isVeryRecent) {
                    console.log(`[Analytics] Post ${tx.postId} on ${tx.platform} returned 'deleted' but is < 24hr old. Preserving cached data.`);

                    // If we have cached data, return it instead of zeroing out
                    if (dbInsight) {
                        return {
                            ...txWithSubject,
                            insight: {
                                ...dbInsight,
                                isDeleted: false, // Don't show it as deleted yet
                                lastUpdated: new Date()
                            }
                        };
                    }
                    // If no cached data, just proceed with zeros but mark not deleted
                    isDeleted = false;
                }

                // [NEW] Preserve metrics if deleted
                // If the platform says it's deleted, we still want to keep the historical max values
                if (isDeleted && dbInsight) {
                    console.log(`[Analytics] Post ${tx.postId} on ${tx.platform} is DELETED. Preserving last known metrics.`);
                    insights.likes = dbInsight.likes;
                    insights.comments = dbInsight.comments;
                    insights.reach = dbInsight.reach;
                    insights.impressions = dbInsight.impressions;
                    insights.engagementRate = dbInsight.engagementRate;
                }

                if (dbInsight) {
                    const updatePromises: any[] = [
                        prisma.postInsight.update({
                            where: { id: dbInsight.id },
                            data: {
                                likes: insights.likes,
                                comments: insights.comments,
                                reach: insights.reach,
                                impressions: insights.impressions,
                                engagementRate: insights.engagementRate,
                                isDeleted: isDeleted,
                                lastUpdated: new Date()
                            }
                        })
                    ];

                    // Sync Metadata (message, mediaUrls) if forceRefresh is true or if it's the first time
                    if (forceRefresh) {
                        const freshMessage = (insights as any).message || (insights as any).caption || (insights as any).text || (insights as any).title || tx.message;
                        let freshMedia = tx.mediaUrls;

                        if (tx.platform === 'FACEBOOK' && (insights as any).full_picture) freshMedia = (insights as any).full_picture;
                        if (tx.platform === 'INSTAGRAM' && (insights as any).media_url) freshMedia = (insights as any).media_url;
                        if (tx.platform === 'YOUTUBE' && (insights as any).thumbnails?.high?.url) freshMedia = (insights as any).thumbnails.high.url;
                        if (tx.platform === 'PINTEREST' && (insights as any).media?.images?.['600x']?.url) freshMedia = (insights as any).media.images['600x'].url;

                        updatePromises.push(
                            prisma.postTransaction.update({
                                where: { id: tx.id },
                                data: { message: freshMessage, mediaUrls: freshMedia }
                            })
                        );

                        if (tx.refId !== 0) {
                            updatePromises.push(
                                prisma.campaignPost.update({
                                    where: { id: tx.refId },
                                    data: {
                                        message: freshMessage,
                                        mediaUrls: freshMedia ? [freshMedia] : [],
                                        isDeleted: isDeleted
                                    } as any
                                })
                            );
                        }

                        // Update local tx object for immediate return
                        tx.message = freshMessage;
                        tx.mediaUrls = freshMedia;
                    } else if (tx.refId !== 0) {
                        // Sync CampaignPost.isDeleted only if it's a real transaction
                        updatePromises.push(
                            prisma.campaignPost.updateMany({
                                where: { id: tx.refId },
                                data: { isDeleted: isDeleted } as any
                            })
                        );
                    }

                    await prisma.$transaction(updatePromises);
                } else {
                    const createPromises: any[] = [
                        prisma.postInsight.create({
                            data: {
                                postId: tx.postId,
                                likes: insights.likes,
                                comments: insights.comments,
                                reach: insights.reach,
                                impressions: insights.impressions,
                                engagementRate: insights.engagementRate,
                                isDeleted: isDeleted,
                                lastUpdated: new Date()
                            }
                        })
                    ];

                    // For new insights, also sync metadata if we have it
                    const freshMessage = (insights as any).message || (insights as any).caption || (insights as any).text || (insights as any).title || tx.message;
                    let freshMedia = tx.mediaUrls;

                    if (tx.platform === 'FACEBOOK' && (insights as any).full_picture) freshMedia = (insights as any).full_picture;
                    if (tx.platform === 'INSTAGRAM' && (insights as any).media_url) freshMedia = (insights as any).media_url;
                    if (tx.platform === 'YOUTUBE' && (insights as any).thumbnails?.high?.url) freshMedia = (insights as any).thumbnails.high.url;
                    if (tx.platform === 'PINTEREST' && (insights as any).media?.images?.['600x']?.url) freshMedia = (insights as any).media.images['600x'].url;

                    createPromises.push(
                        prisma.postTransaction.update({
                            where: { id: tx.id },
                            data: { message: freshMessage, mediaUrls: freshMedia }
                        })
                    );

                    if (tx.refId !== 0) {
                        createPromises.push(
                            prisma.campaignPost.update({
                                where: { id: tx.refId },
                                data: {
                                    message: freshMessage,
                                    mediaUrls: freshMedia ? [freshMedia] : [],
                                    isDeleted: isDeleted
                                } as any
                            })
                        );
                    }

                    // Update local tx object for immediate return
                    tx.message = freshMessage;
                    tx.mediaUrls = freshMedia;

                    await prisma.$transaction(createPromises);
                }


                // Return with fresh insights
                return {
                    ...txWithSubject,
                    message: tx.message,
                    mediaUrls: tx.mediaUrls,
                    insight: {
                        ...insights,
                        isDeleted: isDeleted,
                        lastUpdated: new Date()
                    }
                };

            } catch (err) {
                console.error(`[Analytics] Failed to update insights for ${tx.postId}:`, err);
                // Return cached (stale) or zeros
                return {
                    ...txWithSubject,
                    insight: dbInsight || {
                        likes: 0,
                        comments: 0,
                        reach: 0,
                        impressions: 0,
                        engagementRate: 0,
                        isDeleted: false,
                        lastUpdated: null
                    }
                };
            }
        }));

        return NextResponse.json({
            posts: postsWithInsights,
            totalCount: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        });

    } catch (error: any) {
        console.error('Error fetching analytics posts:', error);
        return NextResponse.json({
            error: 'Failed to fetch posts',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
