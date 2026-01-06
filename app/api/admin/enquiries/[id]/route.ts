import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });

        if (!user) {
            return NextResponse.json({ isSuccess: false, message: 'User not found in database' }, { status: 403 });
        }

        if (user.role !== 'ADMIN_USER') {
            return NextResponse.json({ isSuccess: false, message: `Access denied. Your role is: ${user.role}. Admin access required.` }, { status: 403 });
        }

        const body = await request.json();
        const { id } = await params;
        const enquiryId = parseInt(id);

        const updatedEnquiry = await prisma.enquiry.update({
            where: { id: enquiryId },
            data: {
                isConverted: body.isConverted
            }
        });

        return NextResponse.json({ isSuccess: true, data: updatedEnquiry });
    } catch (error: any) {
        console.error('Error updating enquiry:', error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
