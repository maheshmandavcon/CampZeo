import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';

export async function GET(request: NextRequest) {
    try {
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

        const searchParams = request.nextUrl.searchParams;
        const platform = searchParams.get('platform');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

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
                // Set to end of day 23:59:59.999 to include posts on that day
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                where.scheduledPostTime.lte = end;
            }
        }

        // Fetch all matching posts to perform manual aggregation
        // This bypasses Prisma groupBy validation issues and allows for more flexible logic
        const posts = await prisma.campaignPost.findMany({
            where: where,
            select: {
                id: true,
                category: true,
                type: true,
                status: true,
                isPostSent: true,
                scheduledPostTime: true
            }
        });

        const now = new Date();
        const categoryCounts: Record<string, number> = {};
        const platformCounts: Record<string, number> = {};

        const stats = {
            upcoming: 0,
            past: 0,
            drafts: 0
        };

        posts.forEach(post => {
            // Category aggregation
            const category = post.category || 'Uncategorized';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;

            // Platform aggregation
            const type = post.type || 'UNKNOWN';
            platformCounts[type] = (platformCounts[type] || 0) + 1;

            // Status stats
            if (post.status === 'DRAFT') {
                stats.drafts++;
            }

            if (post.isPostSent || (post.scheduledPostTime && post.scheduledPostTime <= now)) {
                stats.past++;
            } else if (post.scheduledPostTime && post.scheduledPostTime > now) {
                stats.upcoming++;
            }
        });

        const categoryMix = Object.entries(categoryCounts).map(([category, count]) => ({
            category,
            count
        }));

        const platformMix = Object.entries(platformCounts).map(([platform, count]) => ({
            platform,
            count
        }));

        return NextResponse.json({
            insights: {
                totalPosts: posts.length,
                categoryMix,
                platformMix,
                stats
            }
        });
    } catch (error) {
        console.error('Error fetching post insights:', error);
        return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }
}
