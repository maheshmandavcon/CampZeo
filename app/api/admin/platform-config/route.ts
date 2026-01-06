import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to fetch platform config", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const configs = await prisma.adminPlatformConfiguration.findMany();
        return NextResponse.json({ isSuccess: true, data: configs });
    } catch (error: any) {
        await logError("Failed to fetch platform config", { userId: request.headers.get('x-user-id') || undefined }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let key: string | undefined;
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to update platform config", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        key = body.key;
        const { value, platform } = body;

        const existingConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key }
        });

        let config;
        if (existingConfig) {
            config = await prisma.adminPlatformConfiguration.update({
                where: { id: existingConfig.id },
                data: { value, platform }
            });
        } else {
            config = await prisma.adminPlatformConfiguration.create({
                data: { key, value, platform }
            });
        }

        await logInfo("Platform config updated", { key, platform, updatedBy: userId });
        return NextResponse.json({ isSuccess: true, data: config });
    } catch (error: any) {
        await logError("Failed to update platform config", { userId: request.headers.get('x-user-id') || undefined, key }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
