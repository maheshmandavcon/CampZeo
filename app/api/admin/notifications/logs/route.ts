import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server'; // or auth()
import { logWarning, logError } from '@/lib/audit-logger';
import { withErrorHandling } from '@/lib/api-handler';

async function getNotificationLogs(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { role: true }
    });

    if (dbUser?.role !== 'ADMIN_USER') {
        await logWarning("Forbidden access to notification logs", { userId: user.id });
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
        prisma.systemNotificationLog.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.systemNotificationLog.count(),
    ]);

    return NextResponse.json({
        logs,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    });
}

export const GET = withErrorHandling(getNotificationLogs, "GET /api/admin/notifications/logs");
