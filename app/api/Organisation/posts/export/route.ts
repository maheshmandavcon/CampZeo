import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import * as XLSX from 'xlsx';
import { withErrorHandling } from '@/lib/api-handler';

async function exportHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    let effectiveOrganisationId = dbUser?.organisationId;

    if (dbUser?.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            effectiveOrganisationId = impersonatedId;
        }
    }

    if (!effectiveOrganisationId) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    const organisation = await prisma.organisation.findUnique({
        where: { id: effectiveOrganisationId },
        select: { name: true }
    });

    const orgName = organisation?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Organisation';

    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv'; // csv or xlsx

    const where: any = {
        campaign: {
            organisationId: effectiveOrganisationId,
            isDeleted: false
        }
    };

    if (platform && platform !== 'all') {
        where.type = platform;
    }

    if (startDate || endDate) {
        where.scheduledPostTime = {};
        if (startDate) {
            where.scheduledPostTime.gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            where.scheduledPostTime.lte = end;
        }
    }

    const posts = await prisma.campaignPost.findMany({
        where,
        include: {
            campaign: {
                select: {
                    name: true
                }
            }
        },
        orderBy: {
            scheduledPostTime: 'desc'
        }
    });

    // Fetch PostTransactions for all posts to determine publish status
    const postIds = posts.map(p => p.id);
    const postTransactions = await prisma.postTransaction.findMany({
        where: {
            refId: { in: postIds }
        },
        select: {
            refId: true,
            published: true,
            publishedAt: true,
            postId: true
        }
    });

    // Create a map for quick lookup
    const transactionMap = new Map(
        postTransactions.map(t => [t.refId, t])
    );

    // Fetch PostInsights for engagement metrics
    const platformPostIds = postTransactions.map(t => t.postId).filter(Boolean);
    const postInsights = await prisma.postInsight.findMany({
        where: {
            postId: { in: platformPostIds },
            isDeleted: false
        },
        select: {
            postId: true,
            likes: true,
            comments: true,
            reach: true,
            impressions: true,
            saves: true,
            shares: true,
            videoViews: true,
            engagementRate: true
        }
    });

    // Create insights map for quick lookup
    const insightsMap = new Map(
        postInsights.map(i => [i.postId, i])
    );

    // Helper function to derive post status
    const derivePostStatus = (post: any): string => {
        const transaction = transactionMap.get(post.id);

        // If PostTransaction exists with published=true, it's PUBLISHED
        if (transaction?.published && transaction.postId) {
            return 'PUBLISHED';
        }

        // If scheduled for future, it's SCHEDULED
        if (post.scheduledPostTime && new Date(post.scheduledPostTime) > new Date()) {
            return 'SCHEDULED';
        }

        // Otherwise, it's DRAFT
        return 'PENDING';
    };

    // Helper function to format engagement data
    const formatEngagement = (post: any): string => {
        const transaction = transactionMap.get(post.id);
        if (!transaction?.postId) return '';

        const insights = insightsMap.get(transaction.postId);
        if (!insights) return '';

        return `${insights.engagementRate.toFixed(2)}%`;
    };

    // Helper to get granular insights
    const getInsightMetric = (post: any, metric: string): number => {
        const transaction = transactionMap.get(post.id);
        if (!transaction?.postId) return 0;
        const insights = insightsMap.get(transaction.postId);
        if (!insights) return 0;
        return (insights as any)[metric] || 0;
    };

    // Calculate Summary Data
    const summaryData: Record<string, { posts: number, reach: number, engagement: number, successful: number, failed: number }> = {};

    posts.forEach(post => {
        const platform = post.type;
        if (!summaryData[platform]) {
            summaryData[platform] = { posts: 0, reach: 0, engagement: 0, successful: 0, failed: 0 };
        }
        summaryData[platform].posts++;

        const status = derivePostStatus(post);
        if (status === 'PUBLISHED') summaryData[platform].successful++;
        if (post.failureReason) summaryData[platform].failed++;

        summaryData[platform].reach += getInsightMetric(post, 'reach');
    });

    // Prepare 3 datasets

    // 1. Summary Rows
    const summaryRows = Object.entries(summaryData).map(([platform, data]) => ({
        'Platform': platform,
        'Total Posts': data.posts,
        'Successful Posts': data.successful,
        'Failed Posts': data.failed,
        'Total Reach': data.reach,
    }));

    // 2. Posts Data (Content focus)
    const postsRows = posts.map(post => ({
        'Campaign': post.campaign?.name || 'N/A',
        'Platform': post.type,
        'Subject': post.subject || '',
        'Message': post.message || '',
        'Scheduled Date': post.scheduledPostTime ? post.scheduledPostTime.toLocaleString() : 'N/A',
        'Published Date': post.publishedDate ? post.publishedDate.toLocaleString() : 'N/A',
        'Status': derivePostStatus(post),
        'Live Link': post.liveLink || (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 ? post.mediaUrls.join(', ') : ''),
        'Failure Reason': post.failureReason || 'N/A'
    }));

    // 3. Analytics Data (Metrics focus)
    const analyticsRows = posts.map(post => ({
        'Campaign': post.campaign?.name || 'N/A',
        'Platform': post.type,
        'Subject': post.subject || '',
        'Published Date': post.publishedDate ? post.publishedDate.toLocaleString() : 'N/A',
        'Likes': getInsightMetric(post, 'likes'),
        'Comments': getInsightMetric(post, 'comments'),
        'Reach': getInsightMetric(post, 'reach'),
        'Impressions': getInsightMetric(post, 'impressions'),
        'Shares': getInsightMetric(post, 'shares'),
        'Saves': getInsightMetric(post, 'saves'),
        'Video Views': getInsightMetric(post, 'videoViews'),
        'Engagement Rate': formatEngagement(post),
    }));


    let buffer;
    let contentType;
    let fileName;
    const platformName = platform === 'all' || !platform ? 'All_Platforms' : platform;
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
        // For CSV, we return a ZIP file containing 3 CSVs
        const AdmZip = require('adm-zip');
        const zip = new AdmZip();

        // Helper to generate CSV string
        const toCSV = (data: any[]) => {
            const ws = XLSX.utils.json_to_sheet(data);
            return XLSX.utils.sheet_to_csv(ws);
        };

        zip.addFile(`Summary.csv`, Buffer.from(toCSV(summaryRows), 'utf8'));
        zip.addFile(`Posts_Data.csv`, Buffer.from(toCSV(postsRows), 'utf8'));
        zip.addFile(`Analytics_Data.csv`, Buffer.from(toCSV(analyticsRows), 'utf8'));

        buffer = zip.toBuffer();
        contentType = 'application/zip';
        fileName = `posts_export_${orgName}_${platformName}_${dateStr}.zip`;

    } else {
        // For Excel, we create 3 sheets
        const wb = XLSX.utils.book_new();

        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        const wsPosts = XLSX.utils.json_to_sheet(postsRows);
        XLSX.utils.book_append_sheet(wb, wsPosts, 'Posts Data');

        const wsAnalytics = XLSX.utils.json_to_sheet(analyticsRows);
        XLSX.utils.book_append_sheet(wb, wsAnalytics, 'Analytics Data');

        buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = `posts_export_${orgName}_${platformName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = `posts_export_${orgName}_${platformName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    // Handle Preview Request
    if (searchParams.get('preview') === 'true') {
        return NextResponse.json({
            summary: summaryRows,
            posts: postsRows,
            analytics: analyticsRows
        });
    }

    return new Response(buffer, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${fileName}"`
        }
    });
}

export const GET = withErrorHandling(exportHandler, 'GET /api/Organisation/posts/export');
