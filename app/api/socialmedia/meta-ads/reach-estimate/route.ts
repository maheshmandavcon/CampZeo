
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getReachEstimate } from '@/lib/meta-ads';

export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const adAccountId = searchParams.get('adAccountId');
        const budget = parseInt(searchParams.get('budget') || '0');
        const days = parseInt(searchParams.get('days') || '0');
        const objective = searchParams.get('objective') as any;

        if (!adAccountId || !budget || !days || !objective) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { facebookAccessToken: true }
        });

        if (!dbUser?.facebookAccessToken) {
            return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 });
        }

        const estimate = await getReachEstimate({
            adAccountId,
            accessToken: dbUser.facebookAccessToken,
            budget,
            days,
            objective
        });

        return NextResponse.json({ estimate });
    } catch (error: any) {
        console.error('[Meta Ads Reach API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch reach estimate' }, { status: 500 });
    }
}
