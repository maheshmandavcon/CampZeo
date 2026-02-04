
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getAdAccounts } from '@/lib/meta-ads';

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

        const accounts = await getAdAccounts(dbUser.facebookAccessToken);

        return NextResponse.json({
            accounts
        });
    } catch (error: any) {
        console.error('[Meta Ads API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch ad accounts' }, { status: 500 });
    }
}
