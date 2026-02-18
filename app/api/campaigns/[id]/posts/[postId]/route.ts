import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logWarning, logInfo } from '@/lib/audit-logger';
import { withErrorHandling } from '@/lib/api-handler';

// GET - Fetch a single post
async function getPostHandler(
    request: NextRequest,
    context: any
) {
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

    const { id, postId } = await context.params;
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
}

export const GET = withErrorHandling(getPostHandler, "GET /api/campaigns/[id]/posts/[postId]");

// PUT - Update a post
async function updatePostHandler(
    request: NextRequest,
    context: any
) {
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

    const { id, postId } = await context.params;
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

    if (type === 'LINKEDIN') {
        metadata = {
            ...metadata,
            linkedInUrn: body.linkedInUrn || metadata.linkedInUrn
        };
    }

    if (scheduledPostTime) {
        const scheduledDate = new Date(scheduledPostTime);
        if (scheduledDate < campaign.startDate || scheduledDate > campaign.endDate) {
            return NextResponse.json({
                error: `Scheduled time must be between ${campaign.startDate.toLocaleString()} and ${campaign.endDate.toLocaleString()} (Campaign Active Window)`
            }, { status: 400 });
        }
    }

    // Create audit trails for changes
    const auditRecords = [];
    if (subject !== undefined && subject !== existingPost.subject) {
        auditRecords.push({ postId: postIdNum, fieldChanged: 'subject', oldValue: existingPost.subject, newValue: subject, changedBy: user.id });
    }
    if (message !== undefined && message !== existingPost.message) {
        auditRecords.push({ postId: postIdNum, fieldChanged: 'message', oldValue: existingPost.message, newValue: message, changedBy: user.id });
    }
    if (type !== undefined && type !== existingPost.type) {
        auditRecords.push({ postId: postIdNum, fieldChanged: 'type', oldValue: existingPost.type, newValue: type, changedBy: user.id });
    }
    if (scheduledPostTime !== undefined) {
        const oldTime = existingPost.scheduledPostTime?.toISOString();
        const newTime = new Date(scheduledPostTime).toISOString();
        if (oldTime !== newTime) {
            auditRecords.push({ postId: postIdNum, fieldChanged: 'scheduledPostTime', oldValue: oldTime, newValue: newTime, changedBy: user.id });
        }
    }
    if (body.category !== undefined && body.category !== existingPost.category) {
        auditRecords.push({ postId: postIdNum, fieldChanged: 'category', oldValue: existingPost.category, newValue: body.category, changedBy: user.id });
    }
    if (body.status !== undefined && body.status !== existingPost.status) {
        auditRecords.push({ postId: postIdNum, fieldChanged: 'status', oldValue: existingPost.status, newValue: body.status, changedBy: user.id });
    }
    if (body.approvalStatus !== undefined && body.approvalStatus !== existingPost.approvalStatus) {
        auditRecords.push({ postId: postIdNum, fieldChanged: 'approvalStatus', oldValue: existingPost.approvalStatus, newValue: body.approvalStatus, changedBy: user.id });
    }

    // Update post
    const post = await prisma.campaignPost.update({
        where: { id: postIdNum },
        data: {
            subject: subject !== undefined ? subject : undefined,
            message: message !== undefined ? message : undefined,
            type: type !== undefined ? type : undefined,
            senderEmail: senderEmail !== undefined ? senderEmail : undefined,
            category: body.category !== undefined ? body.category : undefined,
            status: body.status !== undefined ? body.status : undefined,
            approvalStatus: body.approvalStatus !== undefined ? body.approvalStatus : undefined,
            scheduledPostTime: scheduledPostTime ? new Date(scheduledPostTime) : (scheduledPostTime === null ? null : undefined),
            videoUrl: videoUrl || (mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null),
            mediaUrls: mediaUrls || existingPost.mediaUrls || [],
            metadata: metadata,
        },
    });

    // Save audits
    if (auditRecords.length > 0) {
        await prisma.postAudit.createMany({
            data: auditRecords as any
        });
    }

    await logInfo("Campaign post updated", { postId: post.id, campaignId, updatedBy: user.id, fieldsChanged: auditRecords.length });
    return NextResponse.json({ post });
}

export const PUT = withErrorHandling(updatePostHandler, "PUT /api/campaigns/[id]/posts/[postId]");

// DELETE - Delete a post
async function deletePostHandler(
    request: NextRequest,
    context: any
) {
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

    const { id, postId } = await context.params;
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

    // Delete related PostAudit records first (no cascade delete in schema)
    await prisma.postAudit.deleteMany({
        where: { postId: postIdNum },
    });

    // Delete post
    await prisma.campaignPost.delete({
        where: { id: postIdNum },
    });

    await logInfo("Campaign post deleted", { postId: postIdNum, campaignId, deletedBy: user.id });
    return NextResponse.json({ message: 'Post deleted successfully' });
}

export const DELETE = withErrorHandling(deletePostHandler, "DELETE /api/campaigns/[id]/posts/[postId]");
