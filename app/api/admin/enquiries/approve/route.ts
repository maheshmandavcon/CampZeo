import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to approve enquiry", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { enquiryId } = await request.json();

        const updatedEnquiry = await prisma.enquiry.update({
            where: { id: enquiryId },
            data: { isConverted: true }
        });



        return NextResponse.json({ isSuccess: true, data: updatedEnquiry });
    } catch (error: any) {
        await logError("Failed to approve enquiry", { userId: "Unknown", error });
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
