import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { sendCampaignPost } from '@/lib/send-campaign-post';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET - Fetch all posts for a campaign
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to fetch campaign posts", { action: "fetch-campaign-posts" });
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

        const { id } = await params;
        const campaignId = parseInt(id);

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

        // Fetch posts
        const posts = await prisma.campaignPost.findMany({
            where: {
                campaignId,
                isAttachedToCampaign: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ posts });
    } catch (error: any) {
        console.error('Error fetching campaign posts:', error);
        await logError("Failed to fetch campaign posts", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }
}

// POST - Create a new post for a campaign
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to create campaign post", { action: "create-campaign-post" });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database to check organisation and credentials
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: {
                organisationId: true,
                role: true,
                linkedInAccessToken: true,
                linkedInAuthUrn: true
            }
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

        const { id } = await params;
        const campaignId = parseInt(id);

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

        const body = await request.json();
        const {
            subject,
            message,
            type,
            scheduledPostTime,
            senderEmail,
            mediaUrls,
            youtubeTags,
            youtubePrivacy,
            youtubeContentType,
            youtubePlaylistTitle,
            youtubePlaylistId,
            pinterestBoardId,
            pinterestLink,
            isReel,
            contentType,
            thumbnailUrl,
            facebookPageId,
            facebookPageAccessToken,
            instagramBusinessId
        } = body;

        // Validation
        if (!type) {
            return NextResponse.json({ error: 'Platform type is required' }, { status: 400 });
        }

        if (!message && !subject && !mediaUrls?.length) {
            return NextResponse.json({ error: 'Message, subject or media is required' }, { status: 400 });
        }

        // Prepare metadata
        let metadata: any = {};
        if (type === 'YOUTUBE') {
            metadata = {
                tags: youtubeTags,
                privacy: youtubePrivacy,
                thumbnailUrl,
                postType: youtubeContentType,
                playlistTitle: youtubePlaylistTitle,
                playlistId: youtubePlaylistId
            };
        } else if (type === 'PINTEREST') {
            metadata = { boardId: pinterestBoardId, link: pinterestLink };
        } else if (type === 'FACEBOOK' || type === 'INSTAGRAM') {
            metadata = {
                isReel: !!isReel,
                thumbnailUrl,
                postType: contentType,
                facebookPageId,
                facebookPageAccessToken,
                instagramBusinessId
            };
        }

        // Create post
        const post = await prisma.campaignPost.create({
            data: {
                campaignId,
                subject,
                message,
                type,
                senderEmail: type === 'EMAIL' ? senderEmail : null,
                scheduledPostTime: scheduledPostTime ? new Date(scheduledPostTime) : null,
                isAttachedToCampaign: true,
                videoUrl: mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null, // Legacy support
                mediaUrls: mediaUrls || [],
                metadata,
            },
            include: {
                campaign: {
                    include: {
                        organisation: true,
                    }
                }
            }
        });

        // If it's a social post and not scheduled, send it immediately
        const isSocialPlatform = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].includes(type);

        if (isSocialPlatform && !scheduledPostTime) {
            try {
                await sendCampaignPost(post);
            } catch (postError) {
                console.error(`Failed to post to ${type}:`, postError);
            }
        }

        await logInfo("Campaign post created", { postId: post.id, campaignId, type, createdBy: user.id });
        return NextResponse.json({ post }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating campaign post:', error);
        await logError("Failed to create campaign post", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }
}
