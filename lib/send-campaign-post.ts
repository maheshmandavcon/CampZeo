import { prisma } from '@/lib/prisma';
import { isVideoUrl } from '@/lib/media-utils';
import { sendCampaignEmail } from '@/lib/email';
import { postToLinkedIn } from '@/lib/linkedin';
import { postToFacebook } from '@/lib/facebook';
import { postToInstagram } from '@/lib/instagram';
import { postToYouTube, postYouTubeCommunity, createYouTubePlaylist, addVideoToPlaylist } from '@/lib/youtube';
import { postToPinterest, createPinterestBoard } from '@/lib/pinterest';
import { sendSms, sendWhatsapp } from '@/lib/twilio';

/**
 * Send a campaign post to contacts or social media
 * This is the shared logic used by both the manual send endpoint and the scheduler
 */
export async function sendCampaignPost(
    post: any,
    contactIds?: number[]
): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
    try {
        const isSocialPlatform = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].includes(post.type);

        // Handle Social Media Posting
        if (isSocialPlatform) {
            // Get the first user from the organisation with the required credentials
            const dbUser = await prisma.user.findFirst({
                where: {
                    organisationId: post.campaign.organisationId,
                },
                select: {
                    linkedInAccessToken: true,
                    linkedInAuthUrn: true,
                    facebookAccessToken: true,
                    facebookPageAccessToken: true,
                    facebookPageId: true,
                    instagramAccessToken: true,
                    instagramUserId: true,
                    youtubeAccessToken: true,
                    pinterestAccessToken: true,
                }
            });

            if (!dbUser) {
                throw new Error('User not found for organisation');
            }

            // LinkedIn
            if (post.type === 'LINKEDIN') {
                if (!dbUser.linkedInAccessToken || !dbUser.linkedInAuthUrn) {
                    throw new Error('LinkedIn credentials not found or expired. Please reconnect your account.');
                }

                const metadata = (post.metadata || {}) as any;
                const authorUrn = metadata?.linkedInUrn || dbUser.linkedInAuthUrn;

                const linkedInResponse = await postToLinkedIn(
                    {
                        accessToken: dbUser.linkedInAccessToken,
                        authorUrn: authorUrn,
                    },
                    post.message || post.subject || "",
                    post.mediaUrls.length > 0 ? post.mediaUrls : post.videoUrl
                );

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: new Date()
                    }
                });

                // Extract post ID from LinkedIn response (response is the full post data)
                const linkedInPostId = linkedInResponse?.id || linkedInResponse?.[Object.keys(linkedInResponse)[0]]?.id || JSON.stringify(linkedInResponse);

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'LINKEDIN',
                        postId: linkedInPostId,
                        accountId: authorUrn,
                        message: post.message || post.subject || "",
                        mediaUrls: post.mediaUrls.length > 0 ? post.mediaUrls[0] : post.videoUrl,
                        postType: (post.mediaUrls.length > 0 || post.videoUrl) ?
                            ((post.mediaUrls[0] || post.videoUrl || '').match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE')
                            : 'TEXT',
                        accessToken: dbUser.linkedInAccessToken,
                        published: true,
                        publishedAt: new Date(),
                    }
                });

                return { success: true, sent: 1, failed: 0 };
            }

            // Facebook
            if (post.type === 'FACEBOOK') {
                const metadata = (post.metadata || {}) as any;
                const fbToken = metadata?.facebookPageAccessToken || dbUser.facebookPageAccessToken || dbUser.facebookAccessToken;
                const fbPageId = metadata?.facebookPageId || dbUser.facebookPageId;

                const tokenSource = metadata?.facebookPageAccessToken ? 'Metadata (Page)' :
                    dbUser.facebookPageAccessToken ? 'DB User (Page)' :
                        dbUser.facebookAccessToken ? 'DB User (User)' : 'None';
                console.log(`[Facebook] Posting using token source: ${tokenSource} for Page ID: ${fbPageId}`);

                if (!fbToken || !fbPageId) {
                    throw new Error('Facebook credentials not found or expired. Please reconnect your account.');
                }

                // Auto-detect if it's a Reel (single video only)
                const mediaToUse = post.mediaUrls.length > 0 ? post.mediaUrls : post.videoUrl;

                // User logic: explicitly check check metadata.isReel. If not set, it is a standard post. 
                // Multiple videos are handled by postToFacebook automatically as an album/feed post.

                const platformResponse = await postToFacebook(
                    {
                        accessToken: fbToken,
                        pageId: fbPageId,
                    },
                    post.message || post.subject || "",
                    mediaToUse,
                    { isReel: metadata?.isReel }
                );

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: new Date()
                    }
                });

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'FACEBOOK',
                        postId: platformResponse.id,
                        accountId: fbPageId,
                        message: post.message || post.subject || "",
                        mediaUrls: Array.isArray(mediaToUse) ? mediaToUse[0] : (mediaToUse || ""),
                        postType: metadata?.isReel ? 'REEL' : ((post.mediaUrls.length > 0 || post.videoUrl) ? 'IMAGE' : 'TEXT'),
                        accessToken: fbToken,
                        published: true,
                        publishedAt: new Date(),
                    }
                });

                return { success: true, sent: 1, failed: 0 };
            }

            // Instagram
            if (post.type === 'INSTAGRAM') {
                const metadata = (post.metadata || {}) as any;
                const igToken = metadata?.facebookPageAccessToken || dbUser.instagramAccessToken;
                const igUserId = metadata?.instagramBusinessId || dbUser.instagramUserId;

                if (!igToken || !igUserId) {
                    throw new Error('Instagram credentials not found or expired. Please reconnect your account.');
                }

                if (igUserId === 'no-business-account') {
                    throw new Error('No Instagram Business Account found');
                }

                const mediaToUse = post.mediaUrls.length > 0 ? post.mediaUrls : post.videoUrl;
                // If using videoUrl logic or isReel is set, treat as video
                const isVideoContent = (!post.mediaUrls.length && !!post.videoUrl) || (post.metadata as any)?.isReel;

                let platformResponse;
                try {
                    platformResponse = await postToInstagram(
                        {
                            accessToken: igToken!,
                            userId: igUserId!,
                        },
                        post.message || post.subject || "",
                        mediaToUse, // Pass the full array or string
                        {
                            isReel: (post.metadata as any)?.isReel,
                            shareToFeed: true,
                            isVideo: isVideoContent
                        }
                    );
                } catch (igError: any) {
                    // Normalize error message if it's an object or JSON
                    let errorMsg = igError instanceof Error ? igError.message : String(igError);
                    try {
                        // Attempt to parse JSON error if stringified
                        const parsed = JSON.parse(errorMsg);
                        errorMsg = parsed.error?.message || parsed.message || errorMsg;
                    } catch (e) {
                        // Not JSON, use as is
                    }
                    console.error('[Instagram] Post failed:', errorMsg);
                    throw new Error(errorMsg); // Re-throw to be caught by main handler
                }

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: new Date()
                    }
                });

                // Determine post type based on media count and type
                const mediaCount = Array.isArray(post.mediaUrls) ? post.mediaUrls.length : (post.mediaUrls ? 1 : 0);
                let postType = 'TEXT';
                if ((post.metadata as any)?.isReel) {
                    postType = 'REEL';
                } else if (mediaCount > 1) {
                    postType = 'CAROUSEL';
                } else if (mediaCount === 1) {
                    const firstMedia = post.mediaUrls[0];
                    postType = firstMedia?.match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE';
                }

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'INSTAGRAM',
                        postId: platformResponse.id,
                        accountId: igUserId!,
                        message: post.message || post.subject || "",
                        mediaUrls: post.mediaUrls.length > 0 ? post.mediaUrls[0] : post.videoUrl,
                        postType,
                        accessToken: igToken!,
                        published: true,
                        publishedAt: new Date(),
                    }
                });

                return { success: true, sent: 1, failed: 0 };
            }

            // YouTube
            if (post.type === 'YOUTUBE') {
                if (!dbUser.youtubeAccessToken) {
                    throw new Error('YouTube credentials not found or expired. Please reconnect your account.');
                }

                const metadata = post.metadata as any;
                const tags = metadata?.tags || [];
                let finalMessage = post.message || "";

                // Transform tags to hashtags and append to message
                if (tags.length > 0) {
                    const hashtags = tags.map((tag: string) => {
                        // Remove special characters and spaces, then add #
                        const normalizedTag = tag.trim().replace(/[^a-zA-Z0-9]/g, '');
                        return normalizedTag ? `#${normalizedTag}` : '';
                    }).filter(Boolean).join(' ');

                    if (hashtags) {
                        finalMessage = finalMessage ? `${finalMessage}\n\n${hashtags}` : hashtags;
                    }
                }

                const media = post.mediaUrls.length > 0 ? post.mediaUrls[0] : post.videoUrl;
                let platformResponse;

                if (media && media.match(/\.(mp4|mov|webm)$/i)) {
                    // Determine isShort from metadata
                    const isShort = metadata?.postType === 'SHORT' || metadata?.isShort || false;

                    platformResponse = await postToYouTube(
                        { accessToken: dbUser.youtubeAccessToken },
                        post.subject || 'Video Post',
                        finalMessage,
                        media,
                        {
                            tags: tags,
                            privacy: metadata?.privacy || 'public',
                            isShort: isShort,
                            thumbnailUrl: metadata?.thumbnailUrl || undefined,
                        }
                    );

                    // Handle Playlist Creation if requested
                    // Handle Playlist (Existing or New)
                    if (metadata?.postType === 'PLAYLIST' || metadata?.playlistId || metadata?.playlistTitle) {
                        try {
                            let targetPlaylistId = metadata?.playlistId;

                            // Create new playlist if no ID but Title provided
                            if (!targetPlaylistId && metadata?.playlistTitle) {
                                const playlist = await createYouTubePlaylist(
                                    { accessToken: dbUser.youtubeAccessToken },
                                    metadata.playlistTitle,
                                    post.message || '', // Use description
                                    metadata?.privacy || 'public'
                                );
                                targetPlaylistId = playlist.id;
                                console.log(`[YouTube] Created new playlist: ${metadata.playlistTitle}`);
                            }

                            if (targetPlaylistId) {
                                await addVideoToPlaylist(
                                    { accessToken: dbUser.youtubeAccessToken },
                                    targetPlaylistId,
                                    platformResponse.id,
                                    undefined, // Position (undefined = auto/append)
                                    { isShort }
                                );
                                console.log(`[YouTube] Added video to playlist: ${targetPlaylistId}`);
                            }
                        } catch (playlistError) {
                            console.error('[YouTube] Failed to handle playlist (non-blocking):', playlistError);
                            // We don't fail the whole post if playlist fails, as the video is uploaded
                        }
                    }

                } else {
                    platformResponse = await postYouTubeCommunity(
                        { accessToken: dbUser.youtubeAccessToken },
                        finalMessage || post.subject || "",
                        media || undefined
                    );
                }

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: new Date()
                    }
                });

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'YOUTUBE',
                        postId: platformResponse.id,
                        accountId: 'youtube-channel',
                        message: post.message || post.subject || "",
                        mediaUrls: post.mediaUrls.length > 0 ? post.mediaUrls[0] : post.videoUrl,
                        postType: media && media.match(/\.(mp4|mov|webm)$/i) ? ((platformResponse as any).isShort || metadata?.postType === 'SHORT' ? 'SHORT' : 'VIDEO') : 'TEXT',
                        accessToken: dbUser.youtubeAccessToken,
                        published: true,
                        publishedAt: new Date(),
                    }
                });

                return { success: true, sent: 1, failed: 0 };
            }

            // Pinterest
            if (post.type === 'PINTEREST') {
                if (!dbUser.pinterestAccessToken) {
                    throw new Error('Pinterest credentials not found or expired. Please reconnect your account.');
                }

                const metadata = post.metadata as any;
                const media = (post.mediaUrls && post.mediaUrls.length > 0) ? post.mediaUrls : post.videoUrl;

                if (!media || (Array.isArray(media) && media.length === 0)) {
                    throw new Error('Pinterest requires an image or video');
                }

                // Check for Multiple Videos (Pinterest API Limitation)
                const mediaList = Array.isArray(media) ? media : [media];
                if (mediaList.length > 1) {
                    const videoCount = mediaList.filter(url => /\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i.test(url)).length;
                    if (videoCount > 0) {
                        // We throw here for earlier feedback, though lib/pinterest.ts also checks.
                        throw new Error('Pinterest does not support multiple video posts or mixed media with videos. Please use a single video or multiple images.');
                    }
                }

                if (!metadata?.boardId && !metadata?.newBoardName) {
                    throw new Error('Pinterest requires a Board ID or a New Board Name');
                }

                // Detect media type for Pinterest post type tracking
                // If array, checking first one is enough for simple type classification or defaulting to IMAGE
                const firstMedia = Array.isArray(media) ? media[0] : media;
                const isVideoPin = /\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i.test(firstMedia);

                let targetBoardId = metadata?.boardId;

                // Create new board if requested
                if (metadata?.newBoardName) {
                    try {
                        const newBoard = await createPinterestBoard(
                            dbUser.pinterestAccessToken,
                            metadata.newBoardName,
                            undefined,
                            'PUBLIC'
                        );
                        targetBoardId = newBoard.id;
                    } catch (error) {
                        console.error("Failed to create new board:", error);
                        throw new Error('Failed to create new board on Pinterest');
                    }
                }

                const platformResponse = await postToPinterest(
                    { accessToken: dbUser.pinterestAccessToken },
                    post.subject || 'Pin',
                    post.message || "",
                    media,
                    {
                        boardId: targetBoardId,
                        coverImageUrl: metadata?.thumbnailUrl || undefined,
                        isVideo: isVideoPin,
                    }
                );

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: new Date()
                    }
                });

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'PINTEREST',
                        postId: platformResponse.id,
                        accountId: 'pinterest-user',
                        message: post.message || post.subject || "",
                        mediaUrls: Array.isArray(media) ? media[0] : media,
                        postType: isVideoPin ? 'VIDEO' : (Array.isArray(media) && media.length > 1 ? 'CAROUSEL' : 'IMAGE'),
                        accessToken: dbUser.pinterestAccessToken,
                        published: true,
                        publishedAt: new Date(),
                    }
                });

                return { success: true, sent: 1, failed: 0 };
            }

            throw new Error(`Platform ${post.type} not yet supported`);
        }

        // Handle Email/SMS/WhatsApp
        // Get contacts
        let contacts;
        if (contactIds && contactIds.length > 0) {
            contacts = await prisma.contact.findMany({
                where: {
                    id: { in: contactIds },
                    organisationId: post.campaign?.organisationId
                }
            });
        } else {
            // Get all campaign contacts
            contacts = post.campaign?.contacts || [];
        }

        if (contacts.length === 0) {
            throw new Error('No valid recipients found');
        }

        const campaignTag = `campaign-${post.id}`;

        let successCount = 0;
        let failCount = 0;

        // Email
        if (post.type === 'EMAIL') {
            for (const contact of contacts) {
                if (!contact.contactEmail) {
                    failCount++;
                    continue;
                }

                // Variable substitution
                let subject = post.subject || '';
                let message = post.message || '';

                const replacements: Record<string, string> = {
                    '{{name}}': contact.contactName || '',
                    '{{email}}': contact.contactEmail || '',
                    '{{phone}}': contact.contactMobile || '',
                    '{{company}}': post.campaign?.organisation?.name || '',
                };

                Object.entries(replacements).forEach(([key, value]) => {
                    subject = subject.replace(new RegExp(key, 'g'), value);
                    message = message.replace(new RegExp(key, 'g'), value);
                });

                const sent = await sendCampaignEmail({
                    to: contact.contactEmail,
                    subject: subject,
                    html: message,
                    replyTo: post.senderEmail || undefined,
                    tags: [campaignTag],
                    attachments: post.mediaUrls
                });

                if (sent) successCount++;
                else failCount++;
            }
        }

        // SMS
        else if (post.type === 'SMS') {
            for (const contact of contacts) {
                if (!contact.contactMobile) {
                    failCount++;
                    continue;
                }

                let message = post.message || '';
                const replacements: Record<string, string> = {
                    '{{name}}': contact.contactName || '',
                    '{{email}}': contact.contactEmail || '',
                    '{{phone}}': contact.contactMobile || '',
                    '{{company}}': post.campaign?.organisation?.name || '',
                };

                Object.entries(replacements).forEach(([key, value]) => {
                    message = message.replace(new RegExp(key, 'g'), value);
                });

                const sent = await sendSms(contact.contactMobile, message);
                if (sent) successCount++;
                else failCount++;
            }
        }

        // WhatsApp
        else if (post.type === 'WHATSAPP') {
            for (const contact of contacts) {
                const number = contact.contactWhatsApp || contact.contactMobile;
                if (!number) {
                    failCount++;
                    continue;
                }

                let message = post.message || '';
                const replacements: Record<string, string> = {
                    '{{name}}': contact.contactName || '',
                    '{{email}}': contact.contactEmail || '',
                    '{{phone}}': number || '',
                    '{{company}}': post.campaign?.organisation?.name || '',
                };

                Object.entries(replacements).forEach(([key, value]) => {
                    message = message.replace(new RegExp(key, 'g'), value);
                });

                const sent = await sendWhatsapp(number, message, post.mediaUrls);
                if (sent) successCount++;
                else failCount++;
            }
        }

        // Update post status if sent to at least one person
        if (successCount > 0) {
            await prisma.campaignPost.update({
                where: { id: post.id },
                data: {
                    isPostSent: true,
                    publishedDate: new Date()
                }
            });

            // Create PostTransaction for Analytics (Email/SMS/WhatsApp)
            // For Email, we use the tag as the ID to fetch analytics later
            const internalPostId = post.type === 'EMAIL' ? campaignTag : `${post.type.toLowerCase()}-${post.id}-${Date.now()}`;

            const transaction = await prisma.postTransaction.create({
                data: {
                    refId: post.id,
                    platform: post.type,
                    postId: internalPostId,
                    accountId: post.senderEmail || 'system',
                    message: post.message || post.subject || "",
                    mediaUrls: Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 ? post.mediaUrls[0] : '',
                    postType: (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) ? 'IMAGE' : 'TEXT',
                    accessToken: 'system',
                    published: true,
                    publishedAt: new Date(),
                }
            });

            // Create initial PostInsight with reach = sent count
            await prisma.postInsight.create({
                data: {
                    postId: internalPostId,
                    likes: 0,
                    comments: 0,
                    reach: successCount,
                    impressions: 0,
                    engagementRate: 0,
                    lastUpdated: new Date()
                }
            });
        }

        return {
            success: successCount > 0,
            sent: successCount,
            failed: failCount
        };

    } catch (error) {
        console.error('[sendCampaignPost] Error:', error);

        // Use a type guard or safe access to get the error message
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.log(`[sendCampaignPost] Attempting to save failure reason for post ${post.id}: "${errorMessage}"`);

        try {
            // Update the post with the failure reason
            const updated = await prisma.campaignPost.update({
                where: { id: post.id },
                data: {
                    failureReason: errorMessage.substring(0, 1000), // Ensure it's not too long just in case
                    isPostSent: false,
                }
            });
            console.log(`[sendCampaignPost] Successfully saved failure reason. Updated record ID: ${updated.id}`);
        } catch (dbError: any) {
            console.error('[sendCampaignPost] Failed to save failure reason:', dbError);
            // Append DB error to the returned error so it's visible in the UI/API response
            const dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
            return {
                success: false,
                sent: 0,
                failed: 1,
                error: `Original Error: ${errorMessage} | DB Save Error: ${dbErrorMsg}`
            };
        }

        return {
            success: false,
            sent: 0,
            failed: 1,
            error: errorMessage
        };
    }
}
