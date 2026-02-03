import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling } from '@/lib/api-handler';

async function postHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // In Next.js 15, params is a Promise
    const { id } = await params;

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== 'ADMIN_USER') {
        return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
    }

    const targetUser = await prisma.user.findFirst({
        where: {
            organisationId: parseInt(id),
        },
    });

    if (!targetUser || !targetUser.clerkId) {
        return NextResponse.json({ isSuccess: false, message: 'No user found for this organisation to impersonate' }, { status: 404 });
    }

    const client = await clerkClient();
    const signInToken = await client.signInTokens.createSignInToken({
        userId: targetUser.clerkId,
        expiresInSeconds: 300,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/organisation`;

    const url = new URL(signInToken.url);
    url.searchParams.append('redirect_url', redirectUrl);

    return NextResponse.json({ isSuccess: true, data: { signInUrl: url.toString() } });
}

export const POST = withErrorHandling(postHandler, "POST /api/admin/organisations/:id/impersonate");
