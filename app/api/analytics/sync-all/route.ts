import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { SocialNormalizerService } from '@/lib/social-normalizer';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler(request: NextRequest) {

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

        const orgId = dbUser.organisationId;
        const skipSync = request.nextUrl.searchParams.get('skipSync') === 'true';
        const forceSync = request.nextUrl.searchParams.get('force') === 'true';

        // Check for last sync time to avoid redundant heavy calls
        let shouldSync = true;
        const lastSyncRecord = await prisma.notification.findFirst({
            where: {
                organisationId: orgId,
                category: 'ANALYTICS_SYNC',
                isSuccess: true
            },
            orderBy: { createdAt: 'desc' }
        });

        if (lastSyncRecord && !forceSync) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (lastSyncRecord.createdAt > fiveMinutesAgo) {
                console.log('[Sync All] Last sync was less than 5 minutes ago. Skipping to keep things fast.');
                shouldSync = false;
            }
        }

        // Sync fresh metrics from all connected platforms
        if ((!skipSync && shouldSync) || forceSync) {
            console.log(`[Sync All] Syncing fresh metrics (force: ${forceSync})...`);
            // We await it here because the following queries depend on the updated data
            await SocialNormalizerService.syncUserMetrics(user.id);

            // Record successful sync
            await prisma.notification.create({
                data: {
                    organisationId: orgId,
                    message: 'Analytics data synchronized successfully',
                    type: 'SYSTEM',
                    platform: 'SYSTEM',
                    category: 'ANALYTICS_SYNC',
                    isSuccess: true
                }
            });
            console.log('[Sync All] Sync complete.');
        } else {
            console.log('[Sync All] Using existing database data.');
        }

        // Fetch comprehensive analytics data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 1. Fetch Social Metric History
        const socialMetrics = await prisma.socialMetricHistory.findMany({
            where: {
                organisationId: orgId,
                recordedAt: { gte: thirtyDaysAgo }
            },
            orderBy: { recordedAt: 'desc' },
            take: 200
        });

        // 2. Fetch Published Posts - Corrected to filter by CampaignPost IDs belonging to the Org
        const orgCampaignPostIds = await prisma.campaignPost.findMany({
            where: { campaign: { organisationId: orgId } },
            select: { id: true }
        }).then(posts => posts.map(p => p.id));

        const postTransactions = await prisma.postTransaction.findMany({
            where: {
                refId: { in: orgCampaignPostIds },
                published: true
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // 3. Fetch Campaign Posts
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

        // 4. Fetch Post Insights
        const allPostIds = [...postTransactions.map(p => p.postId), ...campaignPosts.map(p => p.id.toString())];
        const postInsights = await prisma.postInsight.findMany({
            where: {
                postId: { in: allPostIds }
            }
        });

        // 5. Prepare RAW data arrays
        const postsWithInsights = postTransactions.map(post => {
            const insight = postInsights.find(i => i.postId === post.postId);
            return {
                postId: post.postId,
                platform: post.platform,
                message: post.message?.substring(0, 100),
                publishedAt: post.publishedAt,
                metrics: insight ? {
                    likes: insight.likes,
                    comments: insight.comments,
                    reach: insight.reach,
                    impressions: insight.impressions,
                    engagementRate: insight.engagementRate,
                    isDeleted: insight.isDeleted,
                    lastUpdated: insight.lastUpdated
                } : null
            };
        });

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
                    isDeleted: insight.isDeleted,
                    lastUpdated: insight.lastUpdated
                } : null
            };
        });

        const rawSocialMetrics = socialMetrics.map(m => ({
            platform: m.platform,
            metricName: m.metricName,
            value: m.value,
            recordedAt: m.recordedAt.toISOString().split('T')[0]
        }));

        // Prepare analytics context
        const analyticsContext = {
            allPosts: postsWithInsights,
            campaignPosts: campaignPostsWithInsights,
            socialMetricsTimeSeries: rawSocialMetrics,
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

        return NextResponse.json({
            success: true,
            analytics: analyticsContext,
            syncedAt: new Date().toISOString()
        });

    
}

export const GET = withErrorHandling(getHandler, "GET /api/analytics/sync-all");
