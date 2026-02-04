import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler(request: NextRequest) {

        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to fetch job settings", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const settings = await prisma.jobSetting.findMany();
        return NextResponse.json({ isSuccess: true, data: settings });
    
}

export const GET = withErrorHandling(getHandler, "GET /api/admin/job-settings");

async function postHandler(request: NextRequest) {

        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to update job settings", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { jobId, cronExpression, isEnabled } = await request.json();

        const existing = await prisma.jobSetting.findFirst({
            where: { jobId }
        });

        let setting;
        if (existing) {
            setting = await prisma.jobSetting.update({
                where: { id: existing.id },
                data: { cronExpression, isEnabled }
            });
        } else {
            setting = await prisma.jobSetting.create({
                data: { jobId, cronExpression, isEnabled }
            });
        }

        await logInfo("Job setting updated", { jobId, cronExpression, isEnabled, updatedBy: userId });
        return NextResponse.json({ isSuccess: true, data: setting });
    
}

export const POST = withErrorHandling(postHandler, "POST /api/admin/job-settings");
