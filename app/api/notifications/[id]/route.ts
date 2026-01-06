import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logInfo } from '@/lib/audit-logger';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const notificationId = parseInt(id);

        if (isNaN(notificationId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid notification ID' }, { status: 400 });
        }

        // Get user and their organization
        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { organisationId: true }
        });

        if (!user || !user.organisationId) {
            return NextResponse.json({ isSuccess: false, message: 'User not associated with an organization' }, { status: 403 });
        }

        // Verify notification belongs to user's organization
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
            select: { organisationId: true, isDelete: true }
        });

        if (!notification) {
            return NextResponse.json({ isSuccess: false, message: 'Notification not found' }, { status: 404 });
        }

        if (notification.organisationId !== user.organisationId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized to modify this notification' }, { status: 403 });
        }

        if (notification.isDelete) {
            return NextResponse.json({ isSuccess: false, message: 'Notification has been deleted' }, { status: 410 });
        }

        // Mark notification as read
        await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });

        await logInfo('Notification marked as read', { userId, notificationId });

        return NextResponse.json({
            isSuccess: true,
            message: 'Notification marked as read'
        });
    } catch (error: any) {
        await logError('Failed to mark notification as read', { userId: 'Unknown' }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const notificationId = parseInt(id);

        if (isNaN(notificationId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid notification ID' }, { status: 400 });
        }

        // Get user and their organization
        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { organisationId: true }
        });

        if (!user || !user.organisationId) {
            return NextResponse.json({ isSuccess: false, message: 'User not associated with an organization' }, { status: 403 });
        }

        // Verify notification belongs to user's organization
        const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
            select: { organisationId: true, isDelete: true }
        });

        if (!notification) {
            return NextResponse.json({ isSuccess: false, message: 'Notification not found' }, { status: 404 });
        }

        if (notification.organisationId !== user.organisationId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized to delete this notification' }, { status: 403 });
        }

        if (notification.isDelete) {
            return NextResponse.json({ isSuccess: false, message: 'Notification already deleted' }, { status: 410 });
        }

        // Soft delete notification
        await prisma.notification.update({
            where: { id: notificationId },
            data: { isDelete: true }
        });

        await logInfo('Notification deleted', { userId, notificationId });

        return NextResponse.json({
            isSuccess: true,
            message: 'Notification deleted successfully'
        });
    } catch (error: any) {
        await logError('Failed to delete notification', { userId: 'Unknown' }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
