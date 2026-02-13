import { NextResponse } from 'next/server';
import { getFacebookAppId } from '@/lib/meta-ads';
import { currentUser } from '@clerk/nextjs/server';

export async function GET() {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const facebookAppId = await getFacebookAppId();

        return NextResponse.json({
            facebookAppId
        });
    } catch (error: any) {
        console.error('[Meta Ads Config API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}
