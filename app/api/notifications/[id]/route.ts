import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logInfo } from '@/lib/audit-logger';
import { withErrorHandling } from '@/lib/api-handler';

async function patchHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
}

async function deleteHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
}

export const PATCH = withErrorHandling(patchHandler, "PATCH /api/notifications/:id");
export const DELETE = withErrorHandling(deleteHandler, "DELETE /api/notifications/:id");
