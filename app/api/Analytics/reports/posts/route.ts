import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

export async function GET(req: NextRequest) {
    try {
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
        const limit = parseInt(searchParams.get('limit') || '5');
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
                ...(campaignId && campaignId !== 'all' ? { campaignId: parseInt(campaignId) } : { campaign: { organisationId: orgId } })
            },
            select: { id: true }
        }).then(posts => posts.map(p => p.id));

        // 3. Fetch paginated transactions for these posts
        const transactions = await prisma.postTransaction.findMany({
            where: {
                published: true,
                ...(platform && platform !== 'all' ? { platform } : {}),
                refId: { in: activeCampaignPostIds }
            },
            orderBy: { publishedAt: 'desc' },
            take: limit,
            skip: skip
        });

        // Get total count for pagination
        const totalCount = await prisma.postTransaction.count({
            where: {
                published: true,
                ...(platform && platform !== 'all' ? { platform } : {}),
                refId: { in: activeCampaignPostIds }
            }
        });

        // 4. Fetch related details for the current page
        const platformPostIds = transactions.map(t => t.postId);
        const transactionRefIds = transactions.map(t => t.refId);

        const [insights, detailedCampaignPosts] = await Promise.all([
            prisma.postInsight.findMany({
                where: { postId: { in: platformPostIds }, isDeleted: false }
            }),
            prisma.campaignPost.findMany({
                where: { id: { in: transactionRefIds } },
                include: { campaign: true }
            })
        ]);

        // 5. Fetch Aggregate Stats (Always for the filtered context, not just current page)
        // For performance in reporting, we might want to aggregate all insights linked to the organization's posts
        const allTransactionsForStats = await prisma.postTransaction.findMany({
            where: {
                published: true,
                ...(platform && platform !== 'all' ? { platform } : {}),
                refId: { in: activeCampaignPostIds }
            },
            select: { postId: true }
        });
        const allPlatformPostIds = allTransactionsForStats.map(t => t.postId);

        const aggregateInsights = await prisma.postInsight.aggregate({
            where: {
                postId: { in: allPlatformPostIds },
                isDeleted: false
            },
            _sum: {
                likes: true,
                comments: true,
                reach: true,
                impressions: true,
                saves: true,
                shares: true,
                videoViews: true
            }
        });

        const totalStats = {
            likes: aggregateInsights._sum.likes || 0,
            comments: aggregateInsights._sum.comments || 0,
            reach: aggregateInsights._sum.reach || 0,
            impressions: aggregateInsights._sum.impressions || 0,
            saves: aggregateInsights._sum.saves || 0,
            shares: aggregateInsights._sum.shares || 0,
            videoViews: aggregateInsights._sum.videoViews || 0
        };

        // 6. Map data for frontend
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
                likes: insight?.likes || 0,
                comments: insight?.comments || 0,
                reach: insight?.reach || 0,
                impressions: insight?.impressions || 0,
                saves: insight?.saves || 0,
                shares: insight?.shares || 0,
                videoViews: insight?.videoViews || 0,
                engagementRate: insight?.engagementRate || 0,
                publishedAt: t.publishedAt
            };
        });

        // 7. Fetch Engagement Trends (Daily, last 14 days)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const trendData = await prisma.socialMetricHistory.groupBy({
            by: ['recordedAt'],
            where: {
                organisationId: orgId,
                metricName: 'engagement_count',
                postId: { in: allPlatformPostIds }, // ONLY posts sent from our platform
                ...(platform && platform !== 'all' ? { platform: platform as any } : {}),
                recordedAt: { gte: fourteenDaysAgo }
            },
            _sum: { value: true },
            orderBy: { recordedAt: 'asc' }
        });

        const trends = trendData.map(t => ({
            date: t.recordedAt.toISOString().split('T')[0],
            engagement: t._sum?.value || 0
        }));

        // 8. Get Last Sync Timestamp
        const lastSyncRecord = await prisma.postInsight.findFirst({
            where: { isDeleted: false },
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

    } catch (error) {
        console.error("[API] Reports Posts Analytics error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
