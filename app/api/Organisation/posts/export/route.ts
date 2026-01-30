import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import * as XLSX from 'xlsx';

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

        const rows = posts.map(post => ({
            'Campaign': post.campaign?.name || 'N/A',
            'Platform': post.type,
            'Category': post.category || 'N/A',
            'Subject': post.subject || '',
            'Message': post.message || '',
            'Scheduled Date': post.scheduledPostTime ? post.scheduledPostTime.toLocaleString() : 'N/A',
            'Published Date': post.publishedDate ? post.publishedDate.toLocaleString() : 'N/A',
            'Status': post.status,
            'Approval Status': post.approvalStatus,
            'Live Link': post.liveLink || '',
            'Engagement': post.engagement ? JSON.stringify(post.engagement) : ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Posts');

        let buffer;
        let contentType;
        let fileName;

        if (format === 'xlsx') {
            buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileName = `posts_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        } else {
            buffer = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
            contentType = 'text/csv';
            fileName = `posts_export_${new Date().toISOString().split('T')[0]}.csv`;
        }

        return new Response(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`
            }
        });

    } catch (error) {
        console.error('Error exporting posts:', error);
        return NextResponse.json({ error: 'Failed to export posts' }, { status: 500 });
    }
}
