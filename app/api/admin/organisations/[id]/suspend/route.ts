import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        // In Next.js 15, params is a Promise
        const { id } = await params;
        const organisationId = parseInt(id);

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to suspend/recover organisation", { userId, organisationId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        if (isNaN(organisationId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid organisation ID' }, { status: 400 });
        }

        // Get current organisation
        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
        });

        if (!organisation) {
            return NextResponse.json({ isSuccess: false, message: 'Organisation not found' }, { status: 404 });
        }

        // Determine action based on current status
        const isSuspended = organisation.isDeleted;

        let updatedOrganisation;
        let message;

        if (isSuspended) {
            // RECOVER: Set isDeleted: false, isApproved: true
            updatedOrganisation = await prisma.organisation.update({
                where: { id: organisationId },
                data: {
                    isDeleted: false,
                    isApproved: true
                },
            });
            message = `Organisation ${organisation.name} has been recovered`;
        } else {
            // SUSPEND: Set isDeleted: true, isApproved: false
            updatedOrganisation = await prisma.organisation.update({
                where: { id: organisationId },
                data: {
                    isDeleted: true,
                    isApproved: false
                },
            });
            message = `Organisation ${organisation.name} has been suspended`;
        }

        await logInfo("Organisation status updated", { organisationId, updatedBy: userId, message });
        return NextResponse.json({
            isSuccess: true,
            message,
            data: updatedOrganisation
        });
    } catch (error: any) {
        console.error('Suspend/Recover error:', error);
        await logError("Failed to update organisation status", { userId: "Unknown" }, error);
        return NextResponse.json({
            isSuccess: false,
            message: error.message || 'Failed to update organisation status'
        }, { status: 500 });
    }
}
