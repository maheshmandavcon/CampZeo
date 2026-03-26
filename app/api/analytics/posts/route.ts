import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { withErrorHandling } from '@/lib/api-handler';

async function getPostsHandler(req: NextRequest) {
    const user = await currentUser(); 
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let orgId = -1;
    const impersonatedOrgId = await getImpersonatedOrganisationId();

    if (impersonatedOrgId) {
        orgId = impersonatedOrgId;
    } else {
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
        });
        if (!dbUser || !dbUser.organisationId) {
            return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
        }
        orgId = dbUser.organisationId;
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const platform = searchParams.get('platform');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const skip = (page - 1) * limit;

    // 1. Fetch campaigns for filter dropdown
    const campaigns = await prisma.campaign.findMany({
        where: { organisationId: orgId, isDeleted: false },
        select: { id: true, name: true }
    });

    // 2. Optimized Fetching: Fetch campaign post IDs for the organization
    const activeCampaignPostIds = await prisma.campaignPost.findMany({
        where: {
            isDeleted: false,
            ...(campaignId ? { campaignId: parseInt(campaignId) } : { campaign: { organisationId: orgId } })
        },
        select: { id: true }
    }).then(posts => posts.map(p => p.id));

    // Get total count for pagination
    const totalCount = await prisma.postTransaction.count({
        where: {
            published: true,
            ...(platform ? { platform } : {}),
            refId: { in: activeCampaignPostIds }
        }
    });

    // Fetch transactions for these posts with pagination
    const transactions = await prisma.postTransaction.findMany({
        where: {
            published: true,
            ...(platform ? { platform } : {}),
            refId: { in: activeCampaignPostIds }
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit
    });

    // 3. Fetch related details
    const platformPostIds = transactions.map(t => t.postId);
    const transactionRefIds = transactions.map(t => t.refId);

    const [insights, detailedCampaignPosts] = await Promise.all([
        prisma.postInsight.findMany({
            where: {
                postId: { in: platformPostIds }
                // Removed isDeleted: false to show historical data for deleted posts
            }
        }),
        prisma.campaignPost.findMany({
            where: { id: { in: transactionRefIds } },
            include: { campaign: true }
        })
    ]);

    // Aggregation - Total stats should probably be calculated based on all insights if we want a global view, 
    // but here it seems it's used for the current view. 
    // We'll keep it as is (based on current page) or consider if it should be global.
    // Actually, let's calculate global stats separately to be more useful.
    const allInsights = await prisma.postInsight.findMany({
        where: {
            postId: { in: platformPostIds }
        }
    });

    const totalStats = allInsights.reduce((acc, curr) => {
        acc.likes += curr.likes;
        acc.comments += curr.comments;
        acc.reach += curr.reach;
        acc.impressions += curr.impressions;
        acc.watchTime += curr.watchTime || 0;
        acc.averageViewDuration += curr.averageViewDuration || 0;
        return acc;
    }, { likes: 0, comments: 0, reach: 0, impressions: 0, watchTime: 0, averageViewDuration: 0 });

    // Map insights back to posts for the table
    const posts = transactions.map(t => {
        const insight = insights.find(i => i.postId === t.postId);
        const campaignPost = detailedCampaignPosts.find(cp => cp.id === t.refId);
        return {
            id: t.id,
            postId: t.postId,
            platform: t.platform,
            message: t.message,
            subject: campaignPost?.subject || '',
            postType: t.postType,
            mediaUrls: t.mediaUrls,
            campaignName: campaignPost?.campaign?.name || 'No Campaign',
            insight: {
                likes: insight?.likes || 0,
                comments: insight?.comments || 0,
                reach: insight?.reach || 0,
                impressions: insight?.impressions || 0,
                watchTime: insight?.watchTime || 0,
                averageViewDuration: insight?.averageViewDuration || 0,
                engagementRate: insight?.engagementRate || 0,
                isDeleted: insight?.isDeleted || false,
                lastUpdated: insight?.updatedAt?.toISOString() || null
            },
            publishedAt: t.publishedAt
        };
    });

    // 4. Fetch Engagement Trends (Daily)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const trendData = await prisma.socialMetricHistory.groupBy({
        by: ['recordedAt'],
        where: {
            organisationId: orgId,
            metricName: 'engagement_count',
            ...(platform ? { platform: platform as any } : {}),
            recordedAt: { gte: fourteenDaysAgo }
        },
        _sum: {
            value: true
        },
        orderBy: {
            recordedAt: 'asc'
        }
    });

    // Format trends for Recharts
    const trends = trendData.map(t => ({
        date: t.recordedAt.toISOString().split('T')[0],
        engagement: t._sum?.value || 0
    }));

    // 5. Get Last Sync Timestamp
    const lastSyncRecord = await prisma.postInsight.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
    });

    return NextResponse.json({
        campaigns,
        totalStats,
        posts,
        trends,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        lastSync: lastSyncRecord?.updatedAt || new Date()
    });
}
export const GET = withErrorHandling(getPostsHandler, 'GET /api/analytics/posts');
