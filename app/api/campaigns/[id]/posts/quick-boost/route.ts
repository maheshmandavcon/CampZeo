import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { sendCampaignPost } from '@/lib/send-campaign-post';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const campaignId = parseInt(id);
        if (isNaN(campaignId)) {
            return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
        }

        const body = await request.json();
        const {
            postId,
            subject,
            message,
            type,
            mediaUrls,
            isReel,
            contentType,
            thumbnailUrl,
            facebookPageId,
            facebookPageName,
            facebookPageAccessToken,
            instagramBusinessId,
            metaBoost,
            metadata: existingMetadata,
            ...otherData
        } = body;

        // Combine all metadata-related fields
        const combinedMetadata = {
            ...(existingMetadata || {}),
            isReel: !!isReel,
            postType: contentType,
            thumbnailUrl,
            facebookPageId,
            facebookPageName,
            facebookPageAccessToken,
            instagramBusinessId,
            metaBoost
        };

        let post;
        if (postId) {
            // Update explicitly specified post
            post = await prisma.campaignPost.update({
                where: { id: postId },
                data: {
                    subject,
                    message,
                    type,
                    mediaUrls,
                    metadata: combinedMetadata,
                    status: 'DRAFT', // Reset for processing
                    ...otherData
                },
                include: { campaign: true }
            });
        } else {
            // No postId provided - check for existing DRAFT/FAILED post to avoid duplicates
            const existingPost = await prisma.campaignPost.findFirst({
                where: {
                    campaignId,
                    type,
                    isDeleted: false,
                    status: 'DRAFT',
                    isPostSent: false,
                }
            });

            if (existingPost) {
                // Reuse the existing post
                post = await prisma.campaignPost.update({
                    where: { id: existingPost.id },
                    data: {
                        subject,
                        message,
                        type,
                        mediaUrls,
                        metadata: combinedMetadata,
                        status: 'DRAFT',
                        failureReason: null,
                        ...otherData
                    },
                    include: { campaign: true }
                });
            } else {
                // Create new post
                post = await prisma.campaignPost.create({
                    data: {
                        subject,
                        message,
                        type,
                        mediaUrls,
                        metadata: combinedMetadata,
                        campaignId,
                        status: 'DRAFT',
                        ...otherData
                    },
                    include: { campaign: true }
                });
            }
        }

        // Trigger send with forceSchedule: true
        // This will create a scheduled post on Meta platforms even if no time was picked
        const result = await sendCampaignPost(post, undefined, { forceSchedule: true });

        if (!result.success) {
            return NextResponse.json({
                error: result.error || 'Failed to prepare post for Meta. Please ensure your account is connected and try again.'
            }, { status: 400 });
        }

        // Fetch the updated post to get the metadata (which contains the new platform IDs)
        const updatedPost = await prisma.campaignPost.findUnique({
            where: { id: post.id }
        });

        return NextResponse.json({
            success: true,
            post: updatedPost
        });

    } catch (error: any) {
        console.error('[Quick Boost API] Error:', error);
        return NextResponse.json({
            error: error.message || 'An unexpected error occurred while preparing for boost.'
        }, { status: 500 });
    }
}
