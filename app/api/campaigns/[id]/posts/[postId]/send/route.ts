import { NextResponse, after } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { sendCampaignPost } from '@/lib/send-campaign-post';
import { logWarning } from '@/lib/audit-logger';
import { withErrorHandling, ApiError } from '@/lib/api-handler';

async function sendPostHandler(
    req: Request,   
    { params }: { params: Promise<{ id: string; postId: string }> }
) {
    console.log("POST /api/campaigns/[id]/posts/[postId]/send hit");
    const user = await currentUser();
    if (!user) {
        await logWarning("Unauthorized access attempt to send campaign post", { action: "send-campaign-post" });
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

    // Await params before accessing properties
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const postId = resolvedParams.postId;

    console.log(`[SendRoute] Resolved params: id=${id}, postId=${postId}`);
    console.log(`[SendRoute] User: ${user.id}, Org: ${effectiveOrganisationId}`);

    const { contactIds } = await req.json().catch(() => ({ contactIds: [] }));
    console.log(`[SendRoute] Contact IDs:`, contactIds);

    // Fetch post and campaign - verify campaign belongs to the effective organisation
    const post = await prisma.campaignPost.findFirst({
        where: {
            id: parseInt(postId),
            campaignId: parseInt(id),
            campaign: {
                organisationId: effectiveOrganisationId,
            }
        },
        include: {
            campaign: {
                include: {
                    organisation: true,
                    contacts: true,
                }
            }
        }
    });

    if (!post) {
        console.error(`[SendRoute] Post not found or org mismatch: ID=${postId}, Campaign=${id}, Org=${effectiveOrganisationId}`);
        return NextResponse.json({ error: 'Post or Campaign not found' }, { status: 404 });
    }

    console.log(`[SendRoute] Post found: ${post.subject || 'No subject'} (${post.type})`);
    const isSocialPlatform = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].includes(post.type);

    if (!isSocialPlatform && (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0)) {
        return NextResponse.json({ error: 'No contacts selected' }, { status: 400 });
    }

    // Use the official 'after' API from Next.js 15+ for background tasks.
    // This allows the request to finish and release the client while the background task continues.
    after(async () => {
        try {
            console.log(`[BackgroundSend] Starting for post ${postId}...`);
            await sendCampaignPost(
                post,
                contactIds ? contactIds.map((id: string) => parseInt(id)) : undefined,
                { publishNow: true }
            );
            // Notifications and status updates are handled inside sendCampaignPost
        } catch (error) {
            console.error(`[BackgroundSend] Critical error for post ${postId}:`, error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown critical error';

            await prisma.notification.create({
                data: {
                    message: `Critical failure publishing post: ${post.subject || post.type}. ${errorMsg}`,
                    isSuccess: false,
                    type: 'POST_PUBLISH_FAILURE',
                    platform: post.type,
                    organisationId: effectiveOrganisationId,
                    referenceId: post.id,
                    campaignId: post.campaignId
                }
            });

            await prisma.campaignPost.update({
                where: { id: post.id },
                data: {
                    status: 'FAILED',
                    failureReason: errorMsg
                }
            });
        }
    });

    return NextResponse.json({
        success: true,
        message: 'Post sending has been queued in the background.',
        queued: true
    }, { status: 202 });
}

export const POST = withErrorHandling(sendPostHandler as any, "POST /api/campaigns/[id]/posts/[postId]/send");
