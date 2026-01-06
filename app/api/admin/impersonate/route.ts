import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to impersonate user", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { targetUserId } = await request.json();

        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser || !targetUser.clerkId) {
            return NextResponse.json({ isSuccess: false, message: 'Target user not found' }, { status: 404 });
        }

        const client = await clerkClient();
        const signInToken = await client.signInTokens.createSignInToken({
            userId: targetUser.clerkId,
            expiresInSeconds: 300,
        });

        await logInfo("Admin impersonated user", { adminId: userId, targetUserId, targetUserClerkId: targetUser.clerkId });
        return NextResponse.json({ isSuccess: true, data: { url: signInToken.url } });
    } catch (error: any) {
        console.error('Impersonate error:', error);
        await logError("Failed to impersonate user", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
