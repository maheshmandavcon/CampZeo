import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logError, logWarning } from '@/lib/audit-logger';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler(request: NextRequest) {

        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to export campaigns", { action: "export-campaigns" });
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

        const campaigns = await prisma.campaign.findMany({
            where: {
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
            select: {
                id: true,
                name: true,
                description: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                _count: {
                    select: {
                        posts: true,
                        contacts: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc'
            },
        });

        const headers = [
            'Campaign Name',
            'Description',
            'Start Date',
            'End Date',
            'Status',
            'Created At',
            'Post Count',
            'Contact Count'
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

        const getStatus = (start: Date, end: Date) => {
            const now = new Date();
            if (now < start) return 'Scheduled';
            if (now > end) return 'Completed';
            return 'Active';
        };

        const rows = campaigns.map(campaign => {
            return [
                campaign.name,
                campaign.description || '',
                campaign.startDate.toISOString().split('T')[0],
                campaign.endDate.toISOString().split('T')[0],
                getStatus(campaign.startDate, campaign.endDate),
                campaign.createdAt.toISOString().split('T')[0],
                campaign._count.posts,
                campaign._count.contacts
            ].map(escapeCsvField).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="campaigns-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });

    
}

export const GET = withErrorHandling(getHandler, "GET /api/campaigns/export");
