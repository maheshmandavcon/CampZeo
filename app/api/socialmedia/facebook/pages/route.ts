import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getFacebookPages } from '@/lib/facebook';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler(request: NextRequest) {

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

}

export const GET = withErrorHandling(getHandler, "GET /api/socialmedia/facebook/pages", "getHandler");
