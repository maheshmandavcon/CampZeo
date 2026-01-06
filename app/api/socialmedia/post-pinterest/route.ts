import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { postToPinterest, createPinterestBoard } from '@/lib/pinterest';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
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

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: targetUserId },
        });

        if (!dbUser) {
            return NextResponse.json({ isSuccess: false, message: 'User not found' }, { status: 404 });
        }

        if (!dbUser.pinterestAccessToken) {
            return NextResponse.json({ isSuccess: false, message: 'Pinterest account not connected. Please connect your account in Settings.' }, { status: 400 });
        }

        const body = await req.json();
        const { title, description, mediaUrl, boardId, newBoardName } = body;

        let targetBoardId = boardId;

        // Validation
        if (!title || !description || !mediaUrl) {
            return NextResponse.json({ isSuccess: false, message: 'Title, description, and media are required' }, { status: 400 });
        }

        if (!boardId && !newBoardName) {
            return NextResponse.json({ isSuccess: false, message: 'Please select a board or provide a name for a new board' }, { status: 400 });
        }

        // Create new board if requested
        if (newBoardName) {
            try {
                // Default privacy to PUBLIC as requested implicitly by standard posting flow
                const newBoard = await createPinterestBoard(dbUser.pinterestAccessToken, newBoardName, undefined, 'PUBLIC');
                targetBoardId = newBoard.id;
            } catch (error) {
                console.error("Failed to create new board:", error);
                return NextResponse.json({ isSuccess: false, message: 'Failed to create new board. Please try selecting an existing one.' }, { status: 500 });
            }
        }

        // Post to Pinterest
        const result = await postToPinterest(
            { accessToken: dbUser.pinterestAccessToken },
            title,
            description,
            mediaUrl,
            { boardId: targetBoardId }
        );

        return NextResponse.json({ isSuccess: true, data: result });

    } catch (error: any) {
        console.error('Error posting to Pinterest:', error);

        let errorMessage = error.message || 'Failed to post to Pinterest';
        if (errorMessage.includes("scope")) {
            errorMessage = "Insufficient permissions. Please reconnect your Pinterest account with all required permissions.";
        }

        return NextResponse.json({ isSuccess: false, message: errorMessage }, { status: 500 });
    }
}
