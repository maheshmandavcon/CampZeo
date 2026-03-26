import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { SocialNormalizerService } from "@/lib/social-normalizer";
import { withErrorHandling } from "@/lib/api-handler";

async function getHandler( 
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    let orgId = -1;
    const impersonatedOrgId = await getImpersonatedOrganisationId();

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    if (dbUser.role === 'ADMIN_USER' && impersonatedOrgId) {
        orgId = impersonatedOrgId;
    } else {
        orgId = dbUser.organisationId;
    }

    // Fetch the transaction to verify ownership and get details
    const postTransaction = await prisma.postTransaction.findUnique({
        where: { id: transactionId }
    });

    if (!postTransaction) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const campaignPost = await prisma.campaignPost.findUnique({
        where: { id: postTransaction.refId },
        include: {
            campaign: true
        }
    });

    if (!campaignPost) {
        return NextResponse.json({ error: "Campaign post not found" }, { status: 404 });
    }

    // Verify organization ownership
    if (campaignPost.campaign?.organisationId !== orgId) {
        return NextResponse.json({ error: "Unauthorized access to this post" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get('fresh') === 'true';
    const platform = searchParams.get('platform') || postTransaction.platform;
    const postId = searchParams.get('postId') || postTransaction.postId;

    if (fresh) {
        console.log(`[API] Fresh sync requested for post ${transactionId} (${platform}/${postId})`);
        await SocialNormalizerService.syncSinglePost(orgId, dbUser, {
            id: transactionId,
            postId: postId as string,
            platform: platform as string
        });
    }

    // Fetch refreshed insight and transaction
    const [updatedTransaction, updatedCampaignPost, insight] = await Promise.all([
        prisma.postTransaction.findUnique({
            where: { id: transactionId }
        }),
        prisma.campaignPost.findUnique({
            where: { id: postTransaction.refId },
            include: { campaign: true }
        }),
        prisma.postInsight.findFirst({
            where: { postId: postId as string, platform: platform as any }
        })
    ]);

    if (!updatedTransaction || !updatedCampaignPost) {
        return NextResponse.json({ error: "Post lost during sync" }, { status: 404 });
    }

    const formattedPost = {
        id: updatedTransaction.id,
        postId: updatedTransaction.postId,
        platform: updatedTransaction.platform,
        message: updatedTransaction.message,
        subject: updatedCampaignPost.subject || '',
        postType: updatedTransaction.postType,
        mediaUrls: updatedTransaction.mediaUrls,
        campaignName: updatedCampaignPost.campaign?.name || 'No Campaign',
        insight: {
            likes: insight?.likes || 0,
            comments: insight?.comments || 0,
            reach: insight?.reach || 0,
            impressions: insight?.impressions || 0,
            watchTime: insight?.watchTime || 0,
            averageViewDuration: insight?.averageViewDuration || 0,
            engagementRate: insight?.engagementRate || 0,
            isDeleted: insight?.isDeleted || false,
            lastUpdated: insight?.updatedAt?.toISOString() || null
        },
        publishedAt: updatedTransaction.publishedAt
    };

    return NextResponse.json({ post: formattedPost });
}

export const GET = withErrorHandling(getHandler, "GET /api/analytics/post-details/:id");
