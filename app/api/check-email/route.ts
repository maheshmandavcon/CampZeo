import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/api-handler';

async function postHandler(req: Request) {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
        return NextResponse.json({ isSuccess: false, message: 'Email is required' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const existingOrg = await prisma.organisation.findFirst({
        where: {
            email: { equals: trimmedEmail, mode: 'insensitive' },
            isDeleted: false,
        },
        select: { id: true, name: true },
    });

    if (existingOrg) {
        return NextResponse.json({
            isSuccess: true,
            exists: true,
            message: `An organisation with this email already exists. Only one active organisation can be associated with an email at a time.`,
        });
    }

    const existingUser = await prisma.user.findFirst({
        where: {
            email: { equals: trimmedEmail, mode: 'insensitive' },
            organisation: {
                isDeleted: false,
                isApproved: true,
            },
        },
        select: { id: true },
    });

    if (existingUser) {
        return NextResponse.json({
            isSuccess: true,
            exists: true,
            message: `An account with this email is already associated with an active organisation.`,
        });
    }

    return NextResponse.json({
        isSuccess: true,
        exists: false,
        message: null,
    });
}

export const POST = withErrorHandling(postHandler, "POST /api/check-email");
