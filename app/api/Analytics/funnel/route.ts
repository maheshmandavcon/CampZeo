import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Get user's organisation
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { organisationId: true }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }
        const campaigns = await prisma.campaign.findMany({
            where: { organisationId: dbUser.organisationId },
            select: { id: true }
        });
        const campaignIds = campaigns.map(c => c.id);

        const campaignPosts = await prisma.campaignPost.findMany({
            where: { campaignId: { in: campaignIds } },
            select: { id: true }
        });
        const campaignPostIds = campaignPosts.map(p => p.id);

        // Step 2: Get all PostTransactions for these posts, filtered by date
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);

        const transactions = await prisma.postTransaction.findMany({
            where: {
                refId: { in: campaignPostIds },
                published: true,
                ...(startDate || endDate ? { publishedAt: dateFilter } : {})
            },
            select: { postId: true }
        });

        const postIds = transactions.map(t => t.postId);

        // Step 3: Aggregate Insights
        let totalReach = 0;
        let totalEngagement = 0; // Likes + Comments

        if (postIds.length > 0) {
            const insights = await prisma.postInsight.findMany({
                where: {
                    postId: { in: postIds }
                },
                select: {
                    reach: true,
                    impressions: true,
                    likes: true,
                    comments: true
                }
            });

            totalReach = insights.reduce((sum, i) => sum + (i.reach || i.impressions || 0), 0);
            totalEngagement = insights.reduce((sum, i) => sum + (i.likes || 0) + (i.comments || 0), 0);
        }

        // 3. New Contacts Acquired
        const contactsCount = await prisma.contact.count({
            where: {
                organisationId: dbUser.organisationId,
                ...(startDate || endDate ? { createdAt: dateFilter } : {})
            }
        });

        // 4. Construct Funnel Data
        // Recharts Funnel data format usually expects `value` and `name` (or any key)
        const funnelData = [
            {
                name: 'Reach (Campaigns)',
                value: totalReach,
                fill: '#8884d8'
            },
            {
                name: 'Engagement (Posts)',
                value: totalEngagement,
                fill: '#82ca9d'
            },
            {
                name: 'New Contacts',
                value: contactsCount,
                fill: '#ffc658'
            }
        ];

        return NextResponse.json({ funnel: funnelData });

    } catch (error: any) {
        console.error('Error fetching funnel data:', error);
        return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
    }
}
