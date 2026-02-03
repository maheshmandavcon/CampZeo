import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning } from '@/lib/audit-logger';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler(request: NextRequest) {

        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });

        console.log('Admin Enquiries Access Check:', {
            userExists: !!user,
            userRole: user?.role,
            hasOrganisation: !!user?.organisationId,
            organisationId: user?.organisationId
        });

        if (!user) {
            return NextResponse.json({ isSuccess: false, message: 'User not found in database' }, { status: 403 });
        }

        if (user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to list enquiries", { userId, role: user.role });
            return NextResponse.json({ isSuccess: false, message: `Access denied. Your role is: ${user.role}. Admin access required.` }, { status: 403 });
        }

        const enquiries = await prisma.enquiry.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ isSuccess: true, data: enquiries });
    
}

export const GET = withErrorHandling(getHandler, "GET /api/admin/enquiries");
