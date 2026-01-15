import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { SocialNormalizerService } from '@/lib/social-normalizer';

export async function GET(request: NextRequest) {
    try {
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

        // Sync fresh metrics from all connected platforms
        console.log('[Sync All] Syncing fresh metrics from all platforms...');
        await SocialNormalizerService.syncUserMetrics(user.id);
        console.log('[Sync All] Sync complete. Fetching updated data...');

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

        // 2. Fetch Published Posts
        const postTransactions = await prisma.postTransaction.findMany({
            where: {
                refId: orgId,
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

    } catch (error: any) {
        console.error('[Sync All] Error:', error);
        return NextResponse.json({
            error: 'Failed to sync analytics',
            message: error.message
        }, { status: 500 });
    }
}
