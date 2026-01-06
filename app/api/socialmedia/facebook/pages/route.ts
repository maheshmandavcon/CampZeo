import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getFacebookPages } from '@/lib/facebook';

export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { facebookAccessToken: true }
        });

        if (!dbUser?.facebookAccessToken) {
            return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 });
        }

        const pages = await getFacebookPages(dbUser.facebookAccessToken);
        return NextResponse.json({ pages });
    } catch (error: any) {
        console.error('[Facebook Pages API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }
}
