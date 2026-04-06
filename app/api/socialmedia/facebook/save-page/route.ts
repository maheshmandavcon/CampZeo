import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { withErrorHandling } from '@/lib/api-handler';

async function postHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pageId, pageAccessToken } = await request.json();

    if (!pageId || !pageAccessToken) {
        return NextResponse.json({ error: 'Page ID and Access Token are required' }, { status: 400 });
    }

    await prisma.user.update({
        where: { clerkId: user.id },
        data: {
            facebookPageId: pageId,
            facebookPageAccessToken: pageAccessToken,
        }
    });

    return NextResponse.json({ success: true });
}

export const POST = withErrorHandling(postHandler, "POST /api/socialmedia/facebook/save-page");
