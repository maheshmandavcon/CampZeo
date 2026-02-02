
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logError, logWarning } from '@/lib/audit-logger';
import { PlatformType } from '@/lib/generated/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to export campaign posts", { action: "export-campaign-posts" });
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

        const { id } = await params;
        const campaignId = parseInt(id);

        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const platform = searchParams.get('platform');

        const where: any = {
            campaignId,
            isAttachedToCampaign: true,
        };

        // Filter by platform if provided and not 'all'
        if (platform && platform !== 'all') {
            // Validate platform against PlatformType enum
            const isValidPlatform = Object.values(PlatformType).includes(platform as PlatformType);
            if (isValidPlatform) {
                where.type = platform as PlatformType;
            }
        }

        const posts = await prisma.campaignPost.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
        });

        const headers = [
            'Subject',
            'Message',
            'Platform',
            'Status',
            'Scheduled Time',
            'Created At',
            'Sender Email'
        ];

        const escapeCsvField = (field: any) => {
            if (field === null || field === undefined) {
                return '';
            }
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
        };

        const getStatus = (post: any) => {
            if (post.isPostSent) return 'Sent';
            if (post.scheduledPostTime && new Date(post.scheduledPostTime) > new Date()) return 'Scheduled';
            return 'Pending';
        };

        const rows = posts.map(post => {
            return [
                post.subject || '',
                post.message || '',
                post.type,
                getStatus(post),
                post.scheduledPostTime ? post.scheduledPostTime.toISOString() : '',
                post.createdAt.toISOString(),
                post.senderEmail || ''
            ].map(escapeCsvField).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="campaign-${campaignId}-posts-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });

    } catch (error: any) {
        console.error('Error exporting campaign posts:', error);
        await logError("Failed to export campaign posts", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to export posts' }, { status: 500 });
    }
}
