import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logInfo } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Get user and their organization
        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { organisationId: true }
        });

        if (!user || !user.organisationId) {
            return NextResponse.json({ isSuccess: false, message: 'User not associated with an organization' }, { status: 403 });
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const filter = searchParams.get('filter') || 'all'; // 'all' | 'unread'

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {
            organisationId: user.organisationId,
            isDelete: false
        };

        if (filter === 'unread') {
            where.isRead = false;
        }

        // Fetch notifications with pagination
        const [notifications, totalCount, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    message: true,
                    type: true,
                    platform: true,
                    category: true,
                    isRead: true,
                    isSuccess: true,
                    createdAt: true,
                    referenceId: true,
                    campaignId: true
                }
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({
                where: {
                    organisationId: user.organisationId,
                    isDelete: false,
                    isRead: false
                }
            })
        ]);

        return NextResponse.json({
            isSuccess: true,
            data: {
                notifications,
                totalCount,
                unreadCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error: any) {
        await logError('Failed to fetch notifications', { userId: 'Unknown' }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Get user and their organization
        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { organisationId: true }
        });

        if (!user || !user.organisationId) {
            return NextResponse.json({ isSuccess: false, message: 'User not associated with an organization' }, { status: 403 });
        }

        // Mark all notifications as read for this organization
        const result = await prisma.notification.updateMany({
            where: {
                organisationId: user.organisationId,
                isDelete: false,
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        await logInfo('Marked all notifications as read', { userId, organisationId: user.organisationId, count: result.count });

        return NextResponse.json({
            isSuccess: true,
            message: 'All notifications marked as read',
            count: result.count
        });
    } catch (error: any) {
        await logError('Failed to mark all notifications as read', { userId: 'Unknown' }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
