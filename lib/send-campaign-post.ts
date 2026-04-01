import { prisma } from '@/lib/prisma';
import { del } from '@vercel/blob';
import { isVideoUrl } from '@/lib/media-utils';
import { sendCampaignEmail } from '@/lib/email';
import { postToLinkedIn, getLinkedInPostInsights } from '@/lib/linkedin';
import { postToFacebook, getFacebookPostInsights } from '@/lib/facebook';
import { postToInstagram, getInstagramPostInsights } from '@/lib/instagram';
import { postToYouTube, postYouTubeCommunity, createYouTubePlaylist, addVideoToPlaylist, getYouTubeVideoInsights } from '@/lib/youtube';
import { postToPinterest, createPinterestBoard, getPinterestPostInsights } from '@/lib/pinterest';
import { sendSms, sendWhatsapp } from '@/lib/twilio';
import { createBoostedAd } from '@/lib/meta-ads';
import { logInfo } from '@/lib/audit-logger';
import { deleteFromServer } from '@/lib/upload-helper';


async function cleanupBlobs(urls: (string | string[] | null | undefined)[]) {
    const allUrls = urls.flat().filter((url): url is string =>
        typeof url === 'string' && (url.includes('vercel-storage.com') || url.includes('103.72.220.77'))
    );

    if (allUrls.length > 0) {
        const urlsToDelete: string[] = [];

        for (const url of allUrls) {
            try {
                // Check if any other CampaignPost still references this URL
                const postCount = await prisma.campaignPost.count({
                    where: {
                        OR: [
                            { videoUrl: url },
                            { mediaUrls: { has: url } }
                        ],
                        isDeleted: false
                    }
                });

                // Also check MessageTemplates just in case
                const templateCount = await prisma.messageTemplate.count({
                    where: {
                        mediaUrls: { has: url },
                        isActive: true
                    }
                });

                if (postCount === 0 && templateCount === 0) {
                    urlsToDelete.push(url);
                } else {
                    console.log(`[Cleanup] Skipping deletion of ${url} because it is still referenced (${postCount} posts, ${templateCount} templates)`);
                }
            } catch (error) {
                console.error(`[Cleanup] Error checking references for ${url}:`, error);
                // If we can't check, safer to skip deletion
            }
        }

        if (urlsToDelete.length > 0) {
            console.log(`[Cleanup] Deleting ${urlsToDelete.length} files...`);

            const vercelUrls = urlsToDelete.filter(url => url.includes('vercel-storage.com'));
            const customUrls = urlsToDelete.filter(url => url.includes('103.72.220.77'));

            if (vercelUrls.length > 0) {
                try {
                    await del(vercelUrls);
                } catch (error) {
                    console.error('[Cleanup] Failed to delete Vercel blobs:', error);
                }
            }

            if (customUrls.length > 0) {
                for (const url of customUrls) {
                    await deleteFromServer(url);
                }
            }
        }
    }
}

/**
 * Send a campaign post to contacts or social media
 * This is the shared logic used by both the manual send endpoint and the scheduler
 */
export async function sendCampaignPost(
    post: any,
    contactIds?: number[],
    options?: { forceSchedule?: boolean; publishNow?: boolean }
): Promise<{ success: boolean; sent: number; failed: number; error?: string; errors?: string[] }> {
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

                const liMediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
                const allLiMedia = [...liMediaUrls];
                if (post.videoUrl && !allLiMedia.includes(post.videoUrl)) {
                    allLiMedia.push(post.videoUrl);
                }

                const linkedInResponse = await postToLinkedIn(
                    {
                        accessToken: dbUser.linkedInAccessToken,
                        authorUrn: authorUrn,
                    },
                    post.message || post.subject || "",
                    allLiMedia
                );

                // Extract post ID from LinkedIn response (response is the full post data)
                const linkedInPostId = linkedInResponse?.id || linkedInResponse?.[Object.keys(linkedInResponse)[0]]?.id || JSON.stringify(linkedInResponse);

                let finalMediaUrls = post.mediaUrls;
                let finalVideoUrl = post.videoUrl;
                let finalLiveLink = `https://www.linkedin.com/feed/update/${linkedInPostId}`;

                try {
                    const insights = await getLinkedInPostInsights(linkedInPostId, dbUser.linkedInAccessToken);
                    if (insights.media && insights.media.length > 0) {
                        // LinkedIn media array now contains resolved URLs where possible
                        const resolvedUrls = (insights.media as any[])
                            .map(m => typeof m === 'string' ? m : (m.originalSrc || m.media || m.image || m.url))
                            .filter(Boolean);

                        if (resolvedUrls.length > 0) {
                            // If it's a video post, update the videoUrl (thumbnail)
                            if (post.videoUrl) {
                                finalVideoUrl = resolvedUrls[0];
                            } else {
                                finalMediaUrls = resolvedUrls;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[LinkedIn] Failed to fetch final URLs:', e);
                }

                const liIsScheduledTx = !!(options?.forceSchedule || (!options?.publishNow && post.scheduledPostTime && post.scheduledPostTime.getTime() > Date.now()));
                const liScheduledTimeTx = options?.publishNow ? null : (post.scheduledPostTime || null);

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: liIsScheduledTx ? null : new Date(),
                        status: liIsScheduledTx ? 'SCHEDULED' : 'PUBLISHED',
                        mediaUrls: finalMediaUrls,
                        videoUrl: finalVideoUrl,
                        liveLink: finalLiveLink
                    }
                });

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'LINKEDIN',
                        postId: linkedInPostId,
                        accountId: authorUrn,
                        message: post.message || post.subject || "",
                        mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls[0] : (finalVideoUrl || ""),
                        postType: (finalMediaUrls.length > 0 || finalVideoUrl) ?
                            ((finalMediaUrls[0] || finalVideoUrl || '').match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE')
                            : 'TEXT',
                        accessToken: dbUser.linkedInAccessToken,
                        isScheduled: liIsScheduledTx,
                        scheduledTime: liScheduledTimeTx,
                        published: !liIsScheduledTx,
                        publishedAt: liIsScheduledTx ? null : new Date(),
                    }
                });

                await logInfo(`LinkedIn post ${linkedInPostId} processed`, { postId: post.id, platform: 'LINKEDIN', isScheduled: liIsScheduledTx });

                await cleanupBlobs([...post.mediaUrls, post.videoUrl]);
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
                // Consolidate all media into an array for multi-media support
                const fbMediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
                const allFbMedia = [...fbMediaUrls];
                if (post.videoUrl && !allFbMedia.includes(post.videoUrl)) {
                    allFbMedia.push(post.videoUrl);
                }

                // If it's a Reel, pick the video URL. If multiple media, use the array.
                const isReel = !!metadata?.isReel;
                const mediaToUse = isReel ? (post.videoUrl || allFbMedia[0]) : (allFbMedia.length > 0 ? allFbMedia : (post.videoUrl || []));

                const hasMedia = allFbMedia.length > 0;

                if (isReel && !hasMedia) {
                    throw new Error('Media is required for Facebook Reels. Please upload a video file.');
                }

                // Multiple videos are handled by postToFacebook automatically as an album/feed post.

                // If forceSchedule is true and there is no scheduledPostTime, default to 1 day from now
                let scheduledTime = options?.publishNow ? null : post.scheduledPostTime;
                if (options?.forceSchedule && !scheduledTime) {
                    scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
                }

                const platformResponse = await postToFacebook(
                    {
                        accessToken: fbToken,
                        pageId: fbPageId,
                    },
                    post.message || post.subject || "",
                    mediaToUse,
                    {
                        isReel: isReel,
                        coverUrl: metadata?.thumbnailUrl,
                        scheduledPublishTime: (scheduledTime && scheduledTime.getTime() > Date.now() + 960000) ? Math.floor(scheduledTime.getTime() / 1000) : undefined
                    }
                );

                let finalMediaUrls = post.mediaUrls;
                let finalVideoUrl = post.videoUrl;
                let finalLiveLink = post.liveLink || `https://facebook.com/${platformResponse.id}`;
                try {
                    const insights = await getFacebookPostInsights(platformResponse.id, fbToken);
                    if (insights.full_picture) {
                        finalMediaUrls = [insights.full_picture];
                        if (post.videoUrl || metadata?.isReel) {
                            finalVideoUrl = insights.full_picture;
                        }
                    }
                    if (insights.permalink_url) finalLiveLink = insights.permalink_url;
                } catch (e) {
                    console.warn('[Facebook] Failed to fetch final URLs:', e);
                }

                const isPlatformScheduled = !!(scheduledTime && (scheduledTime instanceof Date ? scheduledTime.getTime() : new Date(scheduledTime).getTime()) > Date.now() + 960000);
                const fbIsScheduledTx = !!(options?.forceSchedule || (isPlatformScheduled && !options?.publishNow));
                const fbScheduledTimeTx = options?.publishNow ? null : (scheduledTime || post.scheduledPostTime || null);

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: fbIsScheduledTx ? null : new Date(),
                        status: fbIsScheduledTx ? 'SCHEDULED' : 'PUBLISHED',
                        mediaUrls: finalMediaUrls,
                        videoUrl: finalVideoUrl,
                        liveLink: finalLiveLink,
                        metadata: {
                            ...(post.metadata || {}),
                            facebookPostId: platformResponse.id,
                            facebookPageId: fbPageId
                        }
                    }
                });

                // Handle Meta Boosting and transaction tracking
                let fbBoostMeta:
                    | { campaignId: string | null; adSetId: string | null; adId: string | null }
                    | null = null;
                let fbBoostFailed = false;
                let fbBoostFailureReason: string | null = null;

                if (metadata?.metaBoost?.enabled) {
                    try {
                        console.log(`[Facebook] Triggering boost for post ${platformResponse.id}`);
                        const boostResult = await createBoostedAd({
                            adAccountId: metadata.metaBoost.adAccountId,
                            accessToken: dbUser.facebookAccessToken || fbToken, // Ad accounts need User Token
                            postId: platformResponse.id,
                            name: post.subject || post.message?.substring(0, 20) || "Boosted Post",
                            budget: metadata.metaBoost.budget,
                            days: metadata.metaBoost.duration,
                            objective: metadata.metaBoost.objective,
                            startTime: post.scheduledPostTime,
                            targeting: metadata.metaBoost.targeting
                        });
                        fbBoostMeta = {
                            campaignId: boostResult.campaignId || null,
                            adSetId: boostResult.adSetId || null,
                            adId: boostResult.adId || null
                        };
                        console.log(`[Facebook] Boost created successfully for post ${platformResponse.id}`);
                    } catch (boostError) {
                        console.error(`[Facebook] Meta Boosting failed:`, boostError);
                        fbBoostFailed = true;
                        fbBoostFailureReason =
                            boostError instanceof Error ? boostError.message : String(boostError);
                    }
                }

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'FACEBOOK',
                        postId: platformResponse.id,
                        accountId: fbPageId,
                        message: post.message || post.subject || "",
                        mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls[0] : (finalVideoUrl || ""),
                        postType: metadata?.isReel ? 'REEL' : ((finalMediaUrls.length > 0 || finalVideoUrl) ? 'IMAGE' : 'TEXT'),
                        accessToken: fbToken,
                        isScheduled: fbIsScheduledTx,
                        scheduledTime: fbScheduledTimeTx,
                        metaPostId: platformResponse.id,
                        metaCampaignId: fbBoostMeta?.campaignId || null,
                        metaAdSetId: fbBoostMeta?.adSetId || null,
                        metaAdId: fbBoostMeta?.adId || null,
                        boostBudgetDaily: metadata?.metaBoost?.budget ?? null,
                        boostDurationDays: metadata?.metaBoost?.duration ?? null,
                        boostTargeting: metadata?.metaBoost?.targeting ?? null,
                        boostFailed: fbBoostFailed,
                        boostFailureReason: fbBoostFailureReason,
                        published: !fbIsScheduledTx,
                        publishedAt: fbIsScheduledTx ? null : new Date(),
                    }
                });

                await logInfo(`Facebook post ${platformResponse.id} processed`, { postId: post.id, platform: 'FACEBOOK', isScheduled: fbIsScheduledTx, boostEnabled: !!metadata?.metaBoost?.enabled });

                await cleanupBlobs([...post.mediaUrls, post.videoUrl]);
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

                // Consolidate all media for Instagram Carousel support
                const igMediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
                const allIgMedia = [...igMediaUrls];
                if (post.videoUrl && !allIgMedia.includes(post.videoUrl)) {
                    allIgMedia.push(post.videoUrl);
                }

                const isReel = !!(post.metadata as any)?.isReel;
                const mediaToUse = isReel ? (post.videoUrl || allIgMedia[0]) : (allIgMedia.length > 1 ? allIgMedia : (allIgMedia[0] || post.videoUrl));

                if (!mediaToUse || (Array.isArray(mediaToUse) && mediaToUse.length === 0)) {
                    throw new Error('Media is required for Instagram posts. Please upload an image or video.');
                }

                // If using videoUrl logic or isReel is set, treat as video
                const isVideoContent = (!post.mediaUrls.length && !!post.videoUrl) || (post.metadata as any)?.isReel;

                // If forceSchedule is true and there is no scheduledPostTime, default to 1 day from now
                let scheduledTime = options?.publishNow ? null : post.scheduledPostTime;
                if (options?.forceSchedule && !scheduledTime) {
                    scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
                }

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
                            coverUrl: (post.metadata as any)?.thumbnailUrl,
                            shareToFeed: true,
                            isVideo: isVideoContent,
                            scheduledPublishTime: (scheduledTime && scheduledTime.getTime() > Date.now() + 960000) ? Math.floor(scheduledTime.getTime() / 1000) : undefined
                        }
                    );
                } catch (igError: any) {
                    // Normalize error message if it's an object or contains JSON
                    let errorMsg = igError instanceof Error ? igError.message : String(igError);

                    // If the error message contains a JSON block (common from lib/instagram.ts), extract it
                    if (errorMsg.includes('{') && errorMsg.includes('}')) {
                        try {
                            const jsonContent = errorMsg.substring(errorMsg.indexOf('{'), errorMsg.lastIndexOf('}') + 1);
                            const parsed = JSON.parse(jsonContent);
                            errorMsg = parsed.error?.message || parsed.message || errorMsg;
                        } catch (e) {
                            // If parsing fails, stick with the original message
                        }
                    }

                    console.error('[Instagram] Post failed:', errorMsg);
                    throw new Error(errorMsg); // Re-throw to be caught by main handler
                }

                let finalMediaUrls = post.mediaUrls;
                let finalVideoUrl = post.videoUrl;
                let finalLiveLink = post.liveLink;
                try {
                    const insights = await getInstagramPostInsights(platformResponse.id, igToken!);
                    if (insights.media_url) {
                        if ((post.metadata as any)?.isReel) finalVideoUrl = insights.media_url;
                        else finalMediaUrls = [insights.media_url];
                    }
                    if (insights.permalink) finalLiveLink = insights.permalink;
                } catch (e) {
                    console.warn('[Instagram] Failed to fetch final URLs:', e);
                }

                const isIgPlatformScheduled = !!(scheduledTime && (scheduledTime instanceof Date ? scheduledTime.getTime() : new Date(scheduledTime).getTime()) > Date.now() + 960000);
                const igIsScheduledTx = !!(options?.forceSchedule || (isIgPlatformScheduled && !options?.publishNow));
                const igScheduledTimeTx = options?.publishNow ? null : (scheduledTime || post.scheduledPostTime || null);

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        publishedDate: igIsScheduledTx ? null : new Date(),
                        status: igIsScheduledTx ? 'SCHEDULED' : 'PUBLISHED',
                        mediaUrls: finalMediaUrls,
                        videoUrl: finalVideoUrl,
                        liveLink: finalLiveLink,
                        metadata: {
                            ...(post.metadata || {}),
                            facebookPostId: platformResponse.id,
                            facebookPageId: dbUser.facebookPageId
                        }
                    }
                });

                // Determine post type based on media count and type
                const mediaCount = finalMediaUrls.length;
                let postType = 'TEXT';
                if ((post.metadata as any)?.isReel) {
                    postType = 'REEL';
                } else if (mediaCount > 1) {
                    postType = 'CAROUSEL';
                } else if (mediaCount === 1) {
                    const firstMedia = finalMediaUrls[0];
                    postType = firstMedia?.match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE';
                }
                // Handle Meta Boosting and transaction tracking
                let igBoostMeta:
                    | { campaignId: string | null; adSetId: string | null; adId: string | null }
                    | null = null;
                let igBoostFailed = false;
                let igBoostFailureReason: string | null = null;

                if (metadata?.metaBoost?.enabled) {
                    try {
                        console.log(`[Instagram] Triggering boost for post ${platformResponse.id}`);
                        const igBoostResult = await createBoostedAd({
                            adAccountId: metadata.metaBoost.adAccountId,
                            accessToken: dbUser.facebookAccessToken || igToken!, // Ad accounts need User Token
                            postId: platformResponse.id,
                            name: post.subject || post.message?.substring(0, 20) || "Boosted Post",
                            budget: metadata.metaBoost.budget,
                            days: metadata.metaBoost.duration,
                            objective: metadata.metaBoost.objective,
                            startTime: post.scheduledPostTime,
                            targeting: metadata.metaBoost.targeting,
                            instagramActorId: igUserId
                        });
                        igBoostMeta = {
                            campaignId: igBoostResult.campaignId || null,
                            adSetId: igBoostResult.adSetId || null,
                            adId: igBoostResult.adId || null
                        };
                        console.log(`[Instagram] Boost created successfully for post ${platformResponse.id}`);
                    } catch (boostError) {
                        console.error(`[Instagram] Meta Boosting failed:`, boostError);
                        igBoostFailed = true;
                        igBoostFailureReason =
                            boostError instanceof Error ? boostError.message : String(boostError);
                    }
                }

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'INSTAGRAM',
                        postId: platformResponse.id,
                        accountId: igUserId!,
                        message: post.message || post.subject || "",
                        mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls[0] : (finalVideoUrl || ""),
                        postType,
                        accessToken: igToken!,
                        isScheduled: igIsScheduledTx,
                        scheduledTime: igScheduledTimeTx,
                        metaPostId: platformResponse.id,
                        metaCampaignId: igBoostMeta?.campaignId || null,
                        metaAdSetId: igBoostMeta?.adSetId || null,
                        metaAdId: igBoostMeta?.adId || null,
                        boostBudgetDaily: metadata?.metaBoost?.budget ?? null,
                        boostDurationDays: metadata?.metaBoost?.duration ?? null,
                        boostTargeting: metadata?.metaBoost?.targeting ?? null,
                        boostFailed: igBoostFailed,
                        boostFailureReason: igBoostFailureReason,
                        published: !igIsScheduledTx,
                        publishedAt: igIsScheduledTx ? null : new Date(),
                    }
                });

                await logInfo(`Instagram post ${platformResponse.id} processed`, { postId: post.id, platform: 'INSTAGRAM', isScheduled: igIsScheduledTx, boostEnabled: !!metadata?.metaBoost?.enabled });

                await cleanupBlobs([...post.mediaUrls, post.videoUrl]);
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

                const media = post.videoUrl || (post.mediaUrls.length > 0 ? post.mediaUrls[0] : null);
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

                let finalMediaUrls = post.mediaUrls;
                let finalVideoUrl = post.videoUrl;
                let finalLiveLink = `https://www.youtube.com/watch?v=${platformResponse.id}`;
                try {
                    const insights = await getYouTubeVideoInsights(platformResponse.id, dbUser.youtubeAccessToken);
                    if (insights.thumbnails) {
                        const thumb = insights.thumbnails.maxres || insights.thumbnails.high || insights.thumbnails.default;
                        if (thumb?.url) {
                            finalMediaUrls = [thumb.url];
                            if (post.videoUrl) finalVideoUrl = thumb.url;
                        }
                    }
                } catch (e) {
                    console.warn('[YouTube] Failed to fetch final URLs:', e);
                }

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        status: 'PUBLISHED',
                        publishedDate: new Date(),
                        mediaUrls: finalMediaUrls,
                        videoUrl: finalVideoUrl,
                        liveLink: finalLiveLink
                    }
                });

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'YOUTUBE',
                        postId: platformResponse.id,
                        accountId: 'youtube-channel',
                        message: post.message || post.subject || "",
                        mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls[0] : (finalVideoUrl || ""),
                        postType: media && media.match(/\.(mp4|mov|webm)$/i) ? ((platformResponse as any).isShort || metadata?.postType === 'SHORT' ? 'SHORT' : 'VIDEO') : 'TEXT',
                        accessToken: dbUser.youtubeAccessToken,
                        isScheduled: !!(!options?.publishNow && post.scheduledPostTime),
                        scheduledTime: options?.publishNow ? null : (post.scheduledPostTime || null),
                        published: true,
                        publishedAt: new Date(),
                    }
                });

                await logInfo(`YouTube post ${platformResponse.id} processed`, { postId: post.id, platform: 'YOUTUBE' });

                await cleanupBlobs([...post.mediaUrls, post.videoUrl]);
                return { success: true, sent: 1, failed: 0 };
            }

            // Pinterest
            if (post.type === 'PINTEREST') {
                if (!dbUser.pinterestAccessToken) {
                    throw new Error('Pinterest credentials not found or expired. Please reconnect your account.');
                }

                const metadata = post.metadata as any;
                const pinMediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
                const allPinMedia = [...pinMediaUrls];
                if (post.videoUrl && !allPinMedia.includes(post.videoUrl)) {
                    allPinMedia.push(post.videoUrl);
                }
                const media = allPinMedia;

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

                let finalMediaUrls = post.mediaUrls;
                let finalVideoUrl = post.videoUrl;
                let finalLiveLink = `https://www.pinterest.com/pin/${platformResponse.id}`;
                try {
                    const insights = await getPinterestPostInsights(platformResponse.id, dbUser.pinterestAccessToken);
                    if (insights.media?.images?.original?.url) {
                        finalMediaUrls = [insights.media.images.original.url];
                        if (post.videoUrl || isVideoPin) {
                            finalVideoUrl = insights.media.images.original.url;
                        }
                    }
                } catch (e) {
                    console.warn('[Pinterest] Failed to fetch final URLs:', e);
                }

                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        isPostSent: true,
                        status: 'PUBLISHED',
                        publishedDate: new Date(),
                        mediaUrls: finalMediaUrls,
                        videoUrl: finalVideoUrl,
                        liveLink: finalLiveLink
                    }
                });

                await prisma.postTransaction.create({
                    data: {
                        refId: post.id,
                        platform: 'PINTEREST',
                        postId: platformResponse.id,
                        accountId: 'pinterest-user',
                        message: post.message || post.subject || "",
                        mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls[0] : (finalVideoUrl || ""),
                        postType: isVideoPin ? 'VIDEO' : (Array.isArray(media) && media.length > 1 ? 'CAROUSEL' : 'IMAGE'),
                        accessToken: dbUser.pinterestAccessToken,
                        isScheduled: !!(!options?.publishNow && post.scheduledPostTime),
                        scheduledTime: options?.publishNow ? null : (post.scheduledPostTime || null),
                        published: true,
                        publishedAt: new Date(),
                    }
                });

                await logInfo(`Pinterest pin ${platformResponse.id} processed`, { postId: post.id, platform: 'PINTEREST' });

                await cleanupBlobs([...post.mediaUrls, post.videoUrl]);
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

        // Twilio Access & Credit Pre-check
        if (post.type === 'SMS' || post.type === 'WHATSAPP') {
            const [org, wallet] = await Promise.all([
                prisma.organisation.findUnique({
                    where: { id: post.campaign.organisationId },
                    select: { twilioAccessStatus: true }
                }),
                prisma.wallet.findUnique({
                    where: { organisationId: post.campaign.organisationId }
                })
            ]);

            if (org?.twilioAccessStatus !== "APPROVED") {
                const error = `Twilio access not approved for this organisation (${org?.twilioAccessStatus || 'NONE'}).`;
                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: { status: 'FAILED', failureReason: error }
                });
                return { success: false, error, sent: 0, failed: contacts.length };
            }

            const required = contacts.length;
            const available = post.type === 'SMS' ? (wallet?.smsCreditsAvailable || 0) : (wallet?.whatsappCreditsAvailable || 0);

            if (required > available) {
                const errorMessage = available === 0 
                    ? `no message credits please add on credit first`
                    : `Insufficient ${post.type} credits. Required: ${required}, Available: ${available}.`;
                
                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: { status: 'FAILED', failureReason: errorMessage }
                });
                return { success: false, error: errorMessage, sent: 0, failed: required };
            }
        }

        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

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

                const formattedMessage = message
                    .replace(/\n/g, '<br />')
                    .replace(/  /g, '&nbsp; ');

                const sent = await sendCampaignEmail({
                    to: contact.contactEmail,
                    subject: subject,
                    html: `<div style="font-family: sans-serif; line-height: 1.5;">${formattedMessage}</div>`,
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

                const result = await sendSms(contact.contactMobile, message, post.campaign.organisationId, post.id);
                if (result.success) successCount++;
                else {
                    failCount++;
                    errors.push(`SMS to ${contact.contactMobile}: ${result.error || 'Unknown error'}`);
                }
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

                const result = await sendWhatsapp(number, message, post.mediaUrls, post.campaign.organisationId, post.id);
                if (result.success) successCount++;
                else {
                    failCount++;
                    errors.push(`WhatsApp to ${number}: ${result.error || 'Unknown error'}`);
                }
            }
        }

        // Update post status if sent to at least one person
        if (successCount > 0) {
            await prisma.campaignPost.update({
                where: { id: post.id },
                data: {
                    isPostSent: true,
                    status: 'PUBLISHED',
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
                    isScheduled: !!(!options?.publishNow && post.scheduledPostTime),
                    scheduledTime: options?.publishNow ? null : (post.scheduledPostTime || null),
                    published: true,
                    publishedAt: new Date(),
                }
            });

            await logInfo(`${post.type} campaign post processed`, { postId: post.id, platform: post.type, count: successCount });

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
            failed: failCount,
            errors: errors.length > 0 ? errors : undefined
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
                    status: 'DRAFT'
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
