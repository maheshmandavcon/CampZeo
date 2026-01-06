
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

        const posts = await prisma.campaignPost.findMany({
            where: {
                campaign: {
                    organisationId: effectiveOrganisationId
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
                campaign: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                scheduledPostTime: 'asc'
            }
        });

        return NextResponse.json({ posts });
    } catch (error) {
        console.error('Error fetching scheduled posts:', error);
        return NextResponse.json({ error: 'Failed to fetch scheduled posts' }, { status: 500 });
    }
}
