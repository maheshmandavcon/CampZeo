import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to send notification", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { message, organisationIds } = await request.json();

        if (!message || !message.trim()) {
            return NextResponse.json({ isSuccess: false, message: 'Message is required' }, { status: 400 });
        }

        let targetOrganisations: number[] = [];

        // If organisationIds is provided and not empty, use it; otherwise broadcast to all
        if (organisationIds && Array.isArray(organisationIds) && organisationIds.length > 0) {
            targetOrganisations = organisationIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        } else {
            // Get all organization IDs
            const allOrgs = await prisma.organisation.findMany({
                where: { isDeleted: false, isApproved: true },
                select: { id: true }
            });
            targetOrganisations = allOrgs.map(org => org.id);
        }

        if (targetOrganisations.length === 0) {
            return NextResponse.json({ isSuccess: false, message: 'No valid organizations to broadcast to' }, { status: 400 });
        }

        // Create notifications for each organization
        const notifications = targetOrganisations.map(orgId => ({
            message,
            type: 'SYSTEM_BROADCAST',
            isRead: false,
            organisationId: orgId
        }));

        const result = await prisma.notification.createMany({
            data: notifications
        });

        await logInfo("System broadcast sent", {
            message,
            sentBy: userId,
            organisationCount: targetOrganisations.length,
            organisationIds: targetOrganisations
        });

        return NextResponse.json({
            isSuccess: true,
            message: `Notification sent to ${targetOrganisations.length} organization(s)`,
            count: result.count
        });
    } catch (error: any) {
        await logError("Failed to send notification", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
