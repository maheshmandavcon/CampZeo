import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { AudienceNormalizerService } from "@/lib/audience-normalizer";

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler(req: NextRequest) {

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
        const accountId = searchParams.get('accountId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '5');
        const sortBy = searchParams.get('sortBy') || 'publishedAt'; // 'publishedAt', 'likes', 'reach', 'engagement'
        const sortOrder = searchParams.get('sortOrder') || 'desc';   // 'asc', 'desc'

        // 1. Fetch campaigns for filter dropdown (including deleted ones)
        const campaigns = await prisma.campaign.findMany({
            where: { organisationId: orgId },
            select: { id: true, name: true, isDeleted: true }
        });

        // 2. Fetch ALL potential transactions first (Filtered by Campaign/Platform) used for stats & list
        // We do this to allow accurate sorting by Engagement which lives in a different table

        // Get Campaign Post IDs first (Filter by Campaign)
        const campaignPostQuery = {
            where: {
                ...(campaignId && campaignId !== 'all' ? { campaignId: parseInt(campaignId) } : { campaign: { organisationId: orgId } })
            },
            select: { id: true, campaignId: true } // Need campaignId for mapping later
        };
        const matchingCampaignPosts = await prisma.campaignPost.findMany(campaignPostQuery);
        const refIds = matchingCampaignPosts.map(p => p.id);

        // Get Transactions (Filter by Platform) using the refIds
        const allTransactions = await prisma.postTransaction.findMany({
            where: {
                published: true,
                ...(platform && platform !== 'all' ? { platform } : {}),
                ...(accountId && accountId !== 'all' ? { accountId } : {}),
                refId: { in: refIds }
            },
            select: {
                id: true,
                postId: true,
                refId: true,
                publishedAt: true,
                platform: true,
                message: true,
                postType: true,
                mediaUrls: true
            }
        });

        // 3. Fetch Insights for ALL these transactions
        const allPostIds = allTransactions.map(t => t.postId);
        const allInsights = await prisma.postInsight.findMany({
            where: { postId: { in: allPostIds } }
        });

        // 4. Combine Data in Memory
        let combinedData = allTransactions.map(t => {
            const insight = allInsights.find(i => i.postId === t.postId);
            const cp = matchingCampaignPosts.find(c => c.id === t.refId);
            const campaign = campaigns.find(c => c.id === cp?.campaignId);

            return {
                id: t.id,
                postId: t.postId,
                platform: t.platform,
                message: t.message,
                subject: '', // Not in transaction schema, assuming handled by UI or joined if needed
                postType: t.postType,
                mediaUrls: t.mediaUrls,
                campaignName: campaign?.name || 'No Campaign',
                campaignId: cp?.campaignId,
                likes: insight?.likes || 0,
                comments: insight?.comments || 0,
                reach: insight?.reach || 0,
                impressions: insight?.impressions || 0,
                saves: insight?.saves || 0,
                shares: insight?.shares || 0,
                videoViews: insight?.videoViews || 0,
                engagementRate: insight?.engagementRate || 0,
                publishedAt: t.publishedAt,
                isDeleted: campaign?.isDeleted || insight?.isDeleted || false,
                engagement: (insight?.likes || 0) + (insight?.comments || 0)
            };
        });

        // 5. SORTING Logic
        combinedData.sort((a, b) => {
            let valA: any = a[sortBy as keyof typeof a];
            let valB: any = b[sortBy as keyof typeof b];

            if (sortBy === 'publishedAt') {
                valA = new Date(a.publishedAt || 0).getTime();
                valB = new Date(b.publishedAt || 0).getTime();
            }

            if (sortOrder === 'asc') {
                return valA > valB ? 1 : -1;
            } else {
                return valA < valB ? 1 : -1;
            }
        });

        // 6. Pagination
        const totalCount = combinedData.length;
        const paginatedData = combinedData.slice((page - 1) * limit, page * limit);


        // 7. Calculate Aggregates (Total Stats) based on the FULL Filtered List
        const totalStats = {
            likes: combinedData.reduce((sum, p) => sum + p.likes, 0),
            comments: combinedData.reduce((sum, p) => sum + p.comments, 0),
            reach: combinedData.reduce((sum, p) => sum + p.reach, 0),
            impressions: combinedData.reduce((sum, p) => sum + p.impressions, 0),
            saves: combinedData.reduce((sum, p) => sum + p.saves, 0),
            shares: combinedData.reduce((sum, p) => sum + p.shares, 0),
            videoViews: combinedData.reduce((sum, p) => sum + p.videoViews, 0)
        };

        // 8. Calculate Campaign Breakdown Stats
        // Re-using the logic, but mapped to campaigns
        const metricsByCampaign = campaigns.map(c => {
            const campaignPosts = combinedData.filter(p => p.campaignId === c.id);
            return {
                id: c.id,
                name: c.name,
                likes: campaignPosts.reduce((sum, p) => sum + p.likes, 0),
                comments: campaignPosts.reduce((sum, p) => sum + p.comments, 0),
                reach: campaignPosts.reduce((sum, p) => sum + p.reach, 0),
                impressions: campaignPosts.reduce((sum, p) => sum + p.impressions, 0),
                engagement: campaignPosts.reduce((sum, p) => sum + p.engagement, 0),
                isDeleted: c.isDeleted
            };
        });

        // Add Unassigned if needed
        const unassignedPosts = combinedData.filter(p => !p.campaignId);
        if (unassignedPosts.length > 0) {
            metricsByCampaign.push({
                id: 0,
                name: 'Unassigned',
                likes: unassignedPosts.reduce((sum, p) => sum + p.likes, 0),
                comments: unassignedPosts.reduce((sum, p) => sum + p.comments, 0),
                reach: unassignedPosts.reduce((sum, p) => sum + p.reach, 0),
                impressions: unassignedPosts.reduce((sum, p) => sum + p.impressions, 0),
                engagement: unassignedPosts.reduce((sum, p) => sum + p.engagement, 0),
                isDeleted: false
            });
        }


        // 9. Trend Data (Keep existing logic, it's efficient enough for 14 days)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const trendData = await prisma.socialMetricHistory.groupBy({
            by: ['recordedAt'],
            where: {
                organisationId: orgId,
                metricName: 'engagement_count',
                postId: { in: allPostIds }, // Use all IDs from the filter
                recordedAt: { gte: fourteenDaysAgo }
            },
            _sum: { value: true },
            orderBy: { recordedAt: 'asc' }
        });

        const trends = trendData.map(t => ({
            date: t.recordedAt.toISOString().split('T')[0],
            engagement: t._sum?.value || 0
        }));

        // 10. Last Sync
        const lastSyncRecord = await prisma.postInsight.findFirst({
            where: { isDeleted: false },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        // 11. Calculate filtered heatmap
        const activityHeatmap = AudienceNormalizerService.calculateRealHeatmap(
            allTransactions.map(t => ({ postId: t.postId, publishedAt: t.publishedAt })),
            allInsights
        );

        return NextResponse.json({
            campaigns,
            campaignMetrics: metricsByCampaign,
            totalStats,
            posts: paginatedData,
            trends,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            lastSync: lastSyncRecord?.updatedAt || new Date(),
            activityHeatmap
        });

    
}

export const GET = withErrorHandling(getHandler, "GET /api/Analytics/reports/posts");
