import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getPinterestBoards, createPinterestBoard } from '@/lib/pinterest';


import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler() {

    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let targetUserId = userId;
    const impersonatedOrgId = await getImpersonatedOrganisationId();

    if (impersonatedOrgId) {
        const orgUser = await prisma.user.findFirst({
            where: { organisationId: impersonatedOrgId }
        });
        if (orgUser) {
            targetUserId = orgUser.clerkId;
        }
    }

    const user = await prisma.user.findUnique({
        where: { clerkId: targetUserId },
        select: { pinterestAccessToken: true }
    });

    if (!user || !user.pinterestAccessToken) {
        return NextResponse.json({ error: 'Pinterest not connected' }, { status: 400 });
    }

    const boards = await getPinterestBoards(user.pinterestAccessToken);

    return NextResponse.json({ boards });

}

export const GET = withErrorHandling(getHandler, "GET /api/socialmedia/pinterest/boards", "getHandler");

async function postHandler(req: Request) {

    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let targetUserId = userId;
    const impersonatedOrgId = await getImpersonatedOrganisationId();

    if (impersonatedOrgId) {
        const orgUser = await prisma.user.findFirst({
            where: { organisationId: impersonatedOrgId }
        });
        if (orgUser) {
            targetUserId = orgUser.clerkId;
        }
    }

    const user = await prisma.user.findUnique({
        where: { clerkId: targetUserId },
        select: { pinterestAccessToken: true, clerkId: true }
    });

    if (!user || !user.pinterestAccessToken) {
        return NextResponse.json({ error: 'Pinterest not connected' }, { status: 400 });
    }

    const body = await req.json();
    const { name, description, privacy } = body;

    if (!name) {
        return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
    }

    try {
        const board = await createPinterestBoard(
            user.pinterestAccessToken,
            name,
            description,
            privacy // 'PUBLIC' or 'SECRET'
        );
        return NextResponse.json({ board });
    } catch (error: any) {
        // If authentication fails, clear the token so frontend shows "Connect" again
        if (error.message && error.message.includes('Authentication failed')) {
            await prisma.user.update({
                where: { clerkId: user.clerkId },
                data: { pinterestAccessToken: null, pinterestAuthUrn: null }
            });
        }
        throw error; // Re-throw to be caught by outer catch
    }

}

export const POST = withErrorHandling(postHandler, "POST /api/socialmedia/pinterest/boards", "postHandler");
