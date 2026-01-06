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

        // Fetch all scheduled posts for the organisation
        const posts = await prisma.campaignPost.findMany({
            where: {
                campaign: {
                    organisationId: effectiveOrganisationId,
                    isDeleted: false
                },
                scheduledPostTime: {
                    not: null
                }
            },
            select: {
                id: true,
                subject: true,
                message: true,
                type: true,
                scheduledPostTime: true,
                mediaUrls: true,
                isPostSent: true,
                campaign: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                scheduledPostTime: 'asc'
            }
        });

        console.log(`Fetched ${posts.length} scheduled posts for organisation ${effectiveOrganisationId}`);

        return NextResponse.json({ posts, count: posts.length });
    } catch (error) {
        console.error('Error fetching scheduled posts:', error);
        return NextResponse.json({
            error: 'Failed to fetch scheduled posts',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
