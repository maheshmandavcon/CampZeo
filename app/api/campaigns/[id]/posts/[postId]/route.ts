import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET - Fetch a single post
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; postId: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to fetch campaign post", { action: "fetch-campaign-post" });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database to check organisation
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { organisationId: true, role: true }
        });

        let effectiveOrganisationId = dbUser?.organisationId;

        // Check for admin impersonation
        if (dbUser?.role === 'ADMIN_USER') {
            const impersonatedId = await getImpersonatedOrganisationId();
            if (impersonatedId) {
                effectiveOrganisationId = impersonatedId;
            }
        }

        if (!effectiveOrganisationId) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        const { id, postId } = await params;
        const campaignId = parseInt(id);
        const postIdNum = parseInt(postId);

        // Verify campaign belongs to organisation
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Fetch post
        const post = await prisma.campaignPost.findFirst({
            where: {
                id: postIdNum,
                campaignId,
            },
        });

        if (!post) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        return NextResponse.json({ post });
    } catch (error: any) {
        console.error('Error fetching post:', error);
        await logError("Failed to fetch campaign post", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
    }
}

// PUT - Update a post
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; postId: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to update campaign post", { action: "update-campaign-post" });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database to check organisation
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { organisationId: true, role: true }
        });

        let effectiveOrganisationId = dbUser?.organisationId;

        // Check for admin impersonation
        if (dbUser?.role === 'ADMIN_USER') {
            const impersonatedId = await getImpersonatedOrganisationId();
            if (impersonatedId) {
                effectiveOrganisationId = impersonatedId;
            }
        }

        if (!effectiveOrganisationId) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        const { id, postId } = await params;
        const campaignId = parseInt(id);
        const postIdNum = parseInt(postId);

        // Verify campaign belongs to organisation
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Check if post exists
        const existingPost = await prisma.campaignPost.findFirst({
            where: {
                id: postIdNum,
                campaignId,
            },
        });

        if (!existingPost) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        // Don't allow editing sent posts
        if (existingPost.isPostSent) {
            return NextResponse.json({ error: 'Cannot edit a sent post' }, { status: 400 });
        }

        const body = await request.json();
        const {
            subject,
            message,
            type,
            scheduledPostTime,
            senderEmail,
            videoUrl,
            mediaUrls,
            metadata: incomingMetadata,
            pinterestBoardId,
            pinterestLink
        } = body;

        // Construct metadata
        let metadata: any = incomingMetadata || existingPost.metadata || {};

        if (type === 'PINTEREST') {
            metadata = {
                ...metadata,
                boardId: pinterestBoardId || metadata.boardId,
                link: pinterestLink || metadata.link
            };
        }

        // Update post
        const post = await prisma.campaignPost.update({
            where: { id: postIdNum },
            data: {
                subject,
                message,
                type,
                senderEmail,
                scheduledPostTime: scheduledPostTime ? new Date(scheduledPostTime) : null,
                videoUrl: videoUrl || (mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null),
                mediaUrls: mediaUrls || existingPost.mediaUrls || [],
                metadata: metadata,
            },
        });

        await logInfo("Campaign post updated", { postId: post.id, campaignId, updatedBy: user.id });
        return NextResponse.json({ post });
    } catch (error: any) {
        console.error('Error updating post:', error);
        await logError("Failed to update campaign post", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
    }
}

// DELETE - Delete a post
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; postId: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to delete campaign post", { action: "delete-campaign-post" });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database to check organisation
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { organisationId: true, role: true }
        });

        let effectiveOrganisationId = dbUser?.organisationId;

        // Check for admin impersonation
        if (dbUser?.role === 'ADMIN_USER') {
            const impersonatedId = await getImpersonatedOrganisationId();
            if (impersonatedId) {
                effectiveOrganisationId = impersonatedId;
            }
        }

        if (!effectiveOrganisationId) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        const { id, postId } = await params;
        const campaignId = parseInt(id);
        const postIdNum = parseInt(postId);

        // Verify campaign belongs to organisation
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Check if post exists
        const existingPost = await prisma.campaignPost.findFirst({
            where: {
                id: postIdNum,
                campaignId,
            },
        });

        if (!existingPost) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        // Don't allow deleting sent posts
        if (existingPost.isPostSent) {
            return NextResponse.json({ error: 'Cannot delete a sent post' }, { status: 400 });
        }

        // Delete post
        await prisma.campaignPost.delete({
            where: { id: postIdNum },
        });

        await logInfo("Campaign post deleted", { postId: postIdNum, campaignId, deletedBy: user.id });
        return NextResponse.json({ message: 'Post deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting post:', error);
        await logError("Failed to delete campaign post", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
    }
}
