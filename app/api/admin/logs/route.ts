import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to fetch audit logs", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        // Get pagination and filter parameters from query string
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');
        const skip = (page - 1) * pageSize;

        const keyword = searchParams.get('keyword') || '';
        const level = searchParams.get('level') || '';
        const dateFrom = searchParams.get('dateFrom') || '';
        const dateTo = searchParams.get('dateTo') || '';

        // Build where clause for filtering
        const where: any = {};

        // Keyword search in message and properties
        if (keyword) {
            where.OR = [
                { message: { contains: keyword, mode: 'insensitive' } },
                { properties: { contains: keyword, mode: 'insensitive' } }
            ];
        }

        // Filter by log level
        if (level) {
            where.level = level;
        }

        // Filter by date range
        if (dateFrom || dateTo) {
            where.timeStamp = {};
            if (dateFrom) {
                where.timeStamp.gte = new Date(dateFrom);
            }
            if (dateTo) {
                // Add one day to include the entire end date
                const endDate = new Date(dateTo);
                endDate.setDate(endDate.getDate() + 1);
                where.timeStamp.lt = endDate;
            }
        }

        // Get total count with filters
        const totalCount = await prisma.logEvents.count({ where });

        // Get paginated logs with filters
        const logs = await prisma.logEvents.findMany({
            where,
            orderBy: { timeStamp: 'desc' },
            skip: skip,
            take: pageSize,
        });

        return NextResponse.json({
            isSuccess: true,
            data: {
                logs,
                totalCount,
                page,
                pageSize,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });
    } catch (error: any) {
        await logError("Failed to fetch audit logs", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
