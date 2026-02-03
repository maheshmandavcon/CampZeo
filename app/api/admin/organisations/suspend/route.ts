import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

import { withErrorHandling } from '@/lib/api-handler';
async function postHandler(request: NextRequest) {

        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to bulk suspend organisations", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { organisationId, action } = await request.json();

        const status = action === 'SUSPEND' ? 'CANCELED' : 'ACTIVE';

        const updatedOrganisation = await prisma.organisation.update({
            where: { id: parseInt(organisationId) },
            data: { isDeleted: action === 'SUSPEND' }
        });

        await prisma.logEvents.create({
            data: {
                message: `Organisation ${updatedOrganisation.name} ${action.toLowerCase()}ed by ${user.email}`,
                level: 'Info',
                timeStamp: new Date(),
                properties: JSON.stringify({
                    action: `${action}_ORGANISATION`,
                    organisationId: updatedOrganisation.id,
                    userId: user.id,
                })
            }
        });

        await logInfo("Bulk organisation status update", { organisationId, action, updatedBy: userId });
        return NextResponse.json({ isSuccess: true, data: updatedOrganisation, message: `Organisation ${action.toLowerCase()}ed successfully` });
    
}

export const POST = withErrorHandling(postHandler, "POST /api/admin/organisations/suspend");
