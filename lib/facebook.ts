import { getSocialMediaUrl, validateMediaUrl, isVideoUrl } from './media-utils';
import { Buffer } from 'buffer';

async function debugFacebookToken(accessToken: string, logPrefix: string = '[Facebook]'): Promise<void> {
    try {
        console.log(`${logPrefix} Debugging Token permissions...`);
        const response = await fetch(`https://graph.facebook.com/v24.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`);

        if (response.ok) {
            const data = await response.json();
            const scopes = data.data?.scopes || [];
            const isValid = data.data?.is_valid;
            console.log(`${logPrefix} Token Debug: Valid=${isValid}, Scopes=${JSON.stringify(scopes)}`);
        } else {
            console.warn(`${logPrefix} Failed to debug token:`, response.status);
        }
    } catch (e) {
        console.error(`${logPrefix} Token debug error:`, e);
    }
}

interface FacebookCredentials {
    accessToken: string;
    pageId: string;
}

interface FacebookPostOptions {
    message: string;
    mediaUrls?: string | string[] | null;
    isReel?: boolean; // For Facebook Reels
}

export async function postToFacebook(
    credentials: FacebookCredentials,
    message: string,
    mediaUrls?: string | string[] | null,
    options?: { isReel?: boolean; scheduledPublishTime?: number }
) {
    const { accessToken, pageId } = credentials;

    // Normalize mediaUrls to array
    const mediaList = Array.isArray(mediaUrls) ? mediaUrls : (mediaUrls ? [mediaUrls] : []);

    console.log(`[Facebook] Posting to page: ${pageId}, Media Count: ${mediaList.length}, Is Reel: ${options?.isReel || false}`);

    // Strict check: Facebook allows only one video per post
    const videoCount = mediaList.filter(url => isVideoUrl(url)).length;
    if (videoCount > 1) {
        throw new Error('Facebook allows only one video per post. Please remove extra videos.');
    }

    try {
        let postId: string;

        if (mediaList.length === 0) {
            // Text-only post
            const response = await fetch(`https://graph.facebook.com/v24.0/${pageId}/feed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    access_token: accessToken,
                    privacy: { value: 'EVERYONE' }, // Ensure post is public
                    published: options?.scheduledPublishTime ? false : true,
                    scheduled_publish_time: options?.scheduledPublishTime
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Facebook API error: ${JSON.stringify(error)}`);
            }

            const data = await response.json();
            postId = data.id;

        } else if (mediaList.length === 1) {
            // Single photo/video post
            const mediaUrl = mediaList[0];

            // Validate and convert URL
            const validation = validateMediaUrl(mediaUrl);

            if (!validation.valid) {
                console.warn(`[Facebook] ${validation.message} Posting as text-only.`);
                // Fall back to text-only post
                const response = await fetch(`https://graph.facebook.com/v24.0/${pageId}/feed`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: message + '\n\n(Media not posted: URL not publicly accessible)',
                        access_token: accessToken,
                        privacy: { value: 'EVERYONE' },
                        published: true
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(`Facebook API error: ${JSON.stringify(error)}`);
                }

                const data = await response.json();
                postId = data.id;
            } else {
                const publicUrl = validation.url;
                const isVideo = isVideoUrl(publicUrl);

                // Check if it's a Reel (short video)
                if (options?.isReel && isVideo) {
                    return await postFacebookReel(credentials, message, publicUrl);
                } else {
                    // Regular photo or video post
                    const endpoint = isVideo ? 'videos' : 'photos';
                    console.log(`[Facebook] Posting ${endpoint} with URL: ${publicUrl}`);

                    if (isVideo) {
                        // Regular video post - Single shot is more reliable for simple URL-based uploads
                        const response = await fetch(`https://graph.facebook.com/v24.0/${pageId}/videos`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                message,
                                file_url: publicUrl,
                                access_token: accessToken,
                                privacy: { value: 'EVERYONE' },
                                published: options?.scheduledPublishTime ? false : true,
                                scheduled_publish_time: options?.scheduledPublishTime
                            }),
                        });

                        if (!response.ok) {
                            const error = await response.json();
                            console.error('[Facebook] API Error:', error);
                            throw new Error(`Facebook API error: ${JSON.stringify(error)}`);
                        }

                        const data = await response.json();
                        postId = data.post_id || data.id;

                        // Wait for processing
                        await waitForFacebookVideoProcessing(data.id, accessToken);
                    } else {
                        // Standard photo post
                        const response = await fetch(`https://graph.facebook.com/v24.0/${pageId}/photos`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                message,
                                url: publicUrl,
                                access_token: accessToken,
                                privacy: { value: 'EVERYONE' },
                                published: options?.scheduledPublishTime ? false : true,
                                scheduled_publish_time: options?.scheduledPublishTime
                            }),
                        });

                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(`Facebook API error: ${JSON.stringify(error)}`);
                        }

                        const data = await response.json();
                        postId = data.post_id || data.id;
                    }
                }
            }

        } else {
            // Multiple media items (mix of photos and videos)
            const mediaIds: string[] = [];

            for (const mediaUrl of mediaList) {
                const validation = validateMediaUrl(mediaUrl);

                if (!validation.valid) {
                    console.warn(`[Facebook] Skipping invalid URL: ${mediaUrl}`);
                    continue;
                }

                const isVideo = isVideoUrl(validation.url);
                const endpoint = isVideo ? 'videos' : 'photos';
                const urlKey = isVideo ? 'file_url' : 'url';

                console.log(`[Facebook] Uploading ${endpoint}: ${validation.url}`);

                const response = await fetch(`https://graph.facebook.com/v24.0/${pageId}/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        [urlKey]: validation.url,
                        published: false, // Don't publish yet
                        access_token: accessToken,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error(`Failed to upload ${endpoint}: ${error}`);
                    continue;
                }

                const data = await response.json();
                mediaIds.push(data.id);
            }

            if (mediaIds.length === 0) {
                throw new Error('No valid media could be uploaded');
            }

            // Create post with all media (photos and videos)
            const response = await fetch(`https://graph.facebook.com/v24.0/${pageId}/feed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    attached_media: mediaIds.map(id => ({ media_fbid: id })),
                    access_token: accessToken,
                    privacy: { value: 'EVERYONE' },
                    published: options?.scheduledPublishTime ? false : true,
                    scheduled_publish_time: options?.scheduledPublishTime
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Facebook API error: ${JSON.stringify(error)}`);
            }

            const data = await response.json();
            postId = data.id;
        }

        console.log(`[Facebook] Post created successfully: ${postId}`);
        return { id: postId };

    } catch (error) {
        console.error('Facebook posting error:', error);
        await debugFacebookToken(accessToken);
        throw error;
    }
}

/**
 * Post a Facebook Reel
 */
async function postFacebookReel(
    credentials: FacebookCredentials,
    message: string,
    videoUrl: string
) {
    const { accessToken, pageId } = credentials;

    console.log(`[Facebook] Creating Reel (Binary Upload) for video: ${videoUrl}`);

    // 1. Initialize Reel Upload
    const startResponse = await fetch(`https://graph.facebook.com/v24.0/${pageId}/video_reels?upload_phase=start&access_token=${accessToken}`, {
        method: 'POST'
    });

    if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(`Facebook Reel initialization error: ${JSON.stringify(error)}`);
    }

    const startData = await startResponse.json();
    const videoId = startData.video_id;
    const uploadUrl = startData.upload_url;

    // 2. Download video binary
    console.log(`[Facebook] Downloading video for binary upload...`);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
        throw new Error(`Failed to download video from ${videoUrl}: ${videoResponse.statusText}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // 3. Upload video binary
    console.log(`[Facebook] Uploading binary to Meta: ${videoBuffer.length} bytes`);
    const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `OAuth ${accessToken}`,
            'offset': '0',
            'file_size': videoBuffer.length.toString(),
            'Content-Type': 'application/octet-stream'
        },
        body: videoBuffer
    });

    if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(`Failed to upload reel binary: ${JSON.stringify(err)}`);
    }

    console.log(`[Facebook] Reel binary uploaded: ${videoId}. Finalizing...`);

    // 4. Finish Reel Upload & Publish
    const finishResponse = await fetch(`https://graph.facebook.com/v24.0/${pageId}/video_reels`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            access_token: accessToken,
            video_id: videoId,
            upload_phase: 'finish',
            video_state: 'PUBLISHED',
            description: message,
        }),
    });

    if (!finishResponse.ok) {
        const error = await finishResponse.json();
        throw new Error(`Facebook Reel finish error: ${JSON.stringify(error)}`);
    }

    console.log(`[Facebook] Reel published successfully: ${videoId}`);
    return { id: videoId };
}

/**
 * Wait for Facebook video processing to complete
 */
async function waitForFacebookVideoProcessing(
    videoId: string,
    accessToken: string,
    timeout: number = 60000 // 60 second timeout
): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds

    console.log(`[Facebook] Waiting for video processing: ${videoId}`);

    while (Date.now() - startTime < timeout) {
        try {
            const statusResponse = await fetch(
                `https://graph.facebook.com/v24.0/${videoId}?fields=status&access_token=${accessToken}`
            );

            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                const videoStatus = statusData.status?.video_status;

                console.log(`[Facebook] Video ${videoId} status: ${videoStatus}`);

                if (videoStatus === 'ready') {
                    console.log(`[Facebook] Video processing complete: ${videoId}`);
                    return;
                } else if (videoStatus === 'error') {
                    console.error(`[Facebook] Video processing error details:`, JSON.stringify(statusData, null, 2));
                    throw new Error(`Video processing failed for ${videoId}. Status: ${videoStatus}. Details: ${JSON.stringify(statusData)}`);
                }
            } else {
                console.warn(`[Facebook] Status check failed for ${videoId}: ${statusResponse.status}`);
            }
        } catch (e) {
            console.error(`[Facebook] Error checking status for ${videoId}`, e);
            // Don't swallow the specific error thrown above
            if (e instanceof Error && e.message.includes('Video processing failed')) {
                await debugFacebookToken(accessToken);
                throw e;
            }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Video processing timeout for ${videoId}`);
}

// Create a Facebook Video Collection/Playlist
export async function createFacebookVideoCollection(
    credentials: FacebookCredentials,
    title: string,
    description: string
) {
    const { accessToken, pageId } = credentials;

    console.log(`[Facebook] Creating video collection: ${title}`);

    try {
        // Facebook uses "video_collections" endpoint for organizing videos
        const response = await fetch(`https://graph.facebook.com/v24.0/${pageId}/video_collections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                description,
                access_token: accessToken,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[Facebook] Video collection creation error:', error);
            throw new Error(`Facebook video collection creation failed: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        console.log(`[Facebook] Video collection created successfully: ${data.id}`);
        return { id: data.id };

    } catch (error) {
        console.error('Facebook video collection error:', error);
        throw error;
    }
}

// Add video to Facebook Video Collection
export async function addVideoToFacebookCollection(
    credentials: FacebookCredentials,
    collectionId: string,
    videoId: string,
    metadata?: {
        title?: string;
        description?: string;
        thumbnailUrl?: string;
    }
) {
    const { accessToken } = credentials;

    console.log(`[Facebook] Adding video ${videoId} to collection ${collectionId}`);

    try {
        const body: any = {
            video_id: videoId,
            access_token: accessToken,
        };

        // Add optional metadata if provided
        if (metadata?.title) {
            body.title = metadata.title;
        }
        if (metadata?.description) {
            body.description = metadata.description;
        }

        const response = await fetch(`https://graph.facebook.com/v24.0/${collectionId}/videos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[Facebook] Failed to add video to collection:', error);
            throw new Error(`Failed to add video to collection: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        console.log(`[Facebook] Video added to collection successfully`);

        // Update video thumbnail if provided
        if (metadata?.thumbnailUrl) {
            try {
                await setFacebookVideoThumbnail(accessToken, videoId, metadata.thumbnailUrl);
                console.log(`[Facebook] Thumbnail updated for video in collection`);
            } catch (err) {
                console.warn(`[Facebook] Failed to update thumbnail (non-blocking):`, err);
            }
        }

        return { success: true, itemId: data.id };

    } catch (error) {
        console.error('Facebook add to collection error:', error);
        throw error;
    }
}

// Update Facebook video thumbnail
async function setFacebookVideoThumbnail(
    accessToken: string,
    videoId: string,
    thumbnailUrl: string
): Promise<void> {
    try {
        // Fetch thumbnail from URL
        const thumbnailResponse = await fetch(thumbnailUrl);
        if (!thumbnailResponse.ok) {
            throw new Error(`Failed to fetch thumbnail: ${thumbnailResponse.statusText}`);
        }

        const thumbnailBuffer = Buffer.from(await thumbnailResponse.arrayBuffer());
        const contentType = thumbnailResponse.headers.get('content-type') || 'image/jpeg';

        // Upload thumbnail to Facebook
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${videoId}/picture?access_token=${accessToken}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': contentType,
                },
                body: thumbnailBuffer,
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Thumbnail upload failed: ${error}`);
        }

        console.log(`[Facebook] Thumbnail set for video ${videoId}`);
    } catch (error) {
        console.error('Facebook thumbnail upload error:', error);
        throw error;
    }
}

export interface FacebookPost {
    id: string;
    message?: string;
    created_time: string;
    full_picture?: string;
    permalink_url: string;
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
}

export async function getFacebookPagePosts(
    credentials: FacebookCredentials,
    limit: number = 5
): Promise<FacebookPost[]> {
    const { accessToken, pageId } = credentials;

    try {
        const fields = 'id,message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true)';
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${pageId}/feed?fields=${fields}&limit=${limit}&access_token=${accessToken}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch posts: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('[Facebook] Error fetching posts:', error);
        throw error;
    }
}

/**
 * Fetch all Facebook Pages the user manages
 */
export async function getFacebookPages(userAccessToken: string) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,category,instagram_business_account&access_token=${userAccessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch pages: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('[Facebook] Error fetching pages:', error);
        throw error;
    }
}

export interface FacebookPostInsights {
    likes: number;
    comments: number;
    impressions: number;
    reach: number;
    engagement: number;
    engagementRate: number;
    isDeleted?: boolean;
    message?: string;
    full_picture?: string;
    permalink_url?: string;
}

export async function getFacebookPostInsights(
    postId: string,
    accessToken: string
): Promise<FacebookPostInsights> {
    try {
        // 1. Get basic interaction counts (likes, reactions, comments) and metadata
        // We use both 'likes' and 'reactions' because sometimes 'likes' summary is empty for certain post types/tokens.
        // We also handle the case where 'shares' field might not exist on some objects (like Photos).
        let fields = 'likes.summary(true),reactions.summary(true),comments.summary(true),shares,engagement,message,full_picture,permalink_url';
        let postResponse = await fetch(
            `https://graph.facebook.com/v24.0/${postId}?fields=${fields}&access_token=${accessToken}`
        );

        if (!postResponse.ok) {
            const error = await postResponse.json();
            const errorMessage = error.error?.message || "";

            // If the error is specifically about non-existing fields (common on Photo/Video nodes), retry without them
            if (errorMessage.includes('nonexisting field')) {
                console.log(`[Facebook] Retrying insights for ${postId} without incompatible fields...`);

                // Identify which field caused the error and remove it
                let currentFields = fields.split(',');
                let newFieldsArr = currentFields;

                if (errorMessage.includes('(shares)')) newFieldsArr = newFieldsArr.filter(f => f !== 'shares');
                if (errorMessage.includes('(engagement)')) newFieldsArr = newFieldsArr.filter(f => f !== 'engagement');
                if (errorMessage.includes('(message)')) {
                    newFieldsArr = newFieldsArr.filter(f => f !== 'message');
                    // For Photos, 'name' is often the caption field
                    if (!newFieldsArr.includes('name')) newFieldsArr.push('name');
                }

                const newFields = newFieldsArr.join(',');
                if (newFields !== fields) {
                    postResponse = await fetch(
                        `https://graph.facebook.com/v24.0/${postId}?fields=${newFields}&access_token=${accessToken}`
                    );
                }
            }
        }

        if (!postResponse.ok) {
            const error = await postResponse.json();
            console.error(`[Facebook] API Error for post ${postId}:`, error);
            // Check for specific error codes or status
            const errorCode = error.error?.code;
            const errorSubcode = error.error?.error_subcode;
            const errorMessage = error.error?.message || "";

            // Check for specific "Object Not Found" or "Does Not Exist" errors
            const isDefinitelyDeleted =
                (errorCode === 100 && (errorSubcode === 33 || errorMessage.includes('does not exist') || errorMessage.includes('Unsupported get request'))) ||
                errorCode === 803 ||
                errorCode === 210;

            if (isDefinitelyDeleted) {
                console.warn(`[Facebook] Post ${postId} not found via direct lookup. Attempting Page Feed fallback...`);

                // Fallback: Check the Page Feed. Sometimes direct object lookup fails but feed works.
                try {
                    // Extract pageId from postId if it's in the format PAGEID_POSTID
                    const pageId = postId.includes('_') ? postId.split('_')[0] : null;
                    if (pageId) {
                        const feedResponse = await fetch(
                            `https://graph.facebook.com/v24.0/${pageId}/feed?fields=id,likes.summary(true),comments.summary(true)&limit=25&access_token=${accessToken}`
                        );

                        if (feedResponse.ok) {
                            const feedData = await feedResponse.json();
                            const feedPost = feedData.data?.find((p: any) => p.id === postId);

                            if (feedPost) {
                                console.log(`[Facebook] Post ${postId} found in Page Feed fallback. Using feed metrics.`);
                                return {
                                    likes: feedPost.likes?.summary?.total_count || 0,
                                    comments: feedPost.comments?.summary?.total_count || 0,
                                    impressions: 0, // Feed doesn't give insights
                                    reach: 0,
                                    engagement: feedPost.likes?.summary?.total_count + feedPost.comments?.summary?.total_count || 0,
                                    engagementRate: 0,
                                    isDeleted: false
                                };
                            }
                        }
                    }
                } catch (fallbackErr) {
                    console.error(`[Facebook] Fallback failed for ${postId}:`, fallbackErr);
                }

                console.warn(`[Facebook] Post ${postId} confirmed as deleted or inaccessible after fallback.`);
                return {
                    likes: 0,
                    comments: 0,
                    impressions: 0,
                    reach: 0,
                    engagement: 0,
                    engagementRate: 0,
                    isDeleted: true
                };
            }

            throw new Error(`Failed to fetch post details: ${JSON.stringify(error)}`);
        }

        const postData = await postResponse.json();

        // Debug logging to see exactly what FB returns
        console.log(`[Facebook] Raw data for ${postId}:`, JSON.stringify({
            likes: postData.likes?.summary,
            reactions: postData.reactions?.summary,
            comments: postData.comments?.summary,
            engagement: postData.engagement
        }));

        // Try to get like count from multiple sources
        const likesCount = postData.likes?.summary?.total_count ?? 0;
        const reactionsCount = postData.reactions?.summary?.total_count ?? 0;
        const engagementLikes = postData.engagement?.reaction_count ?? 0;

        // Use the highest count found (sometimes one field is 0 while others have data)
        const likes = Math.max(likesCount, reactionsCount, engagementLikes);

        const comments = postData.comments?.summary?.total_count || 0;
        const shares = postData.shares?.count || 0;

        // 2. Get Insights (Reach, Impressions)
        // Note: Insights might not be available for all posts (e.g. personal profile posts vs page posts)
        // We try to fetch them, but handle failure gracefully
        let impressions = 0;
        let reach = 0;

        try {
            // User requested: post_impressions, post_reach, post_engaged_users, post_reactions
            const metrics = 'post_impressions,post_reach,post_engaged_users,post_reactions,post_impressions_unique';
            const insightsResponse = await fetch(
                `https://graph.facebook.com/v24.0/${postId}/insights?metric=${metrics}&access_token=${accessToken}`
            );

            if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json();
                const data = insightsData.data || [];

                const impressionsMetric = data.find((m: any) => m.name === 'post_impressions');
                const reachMetric = data.find((m: any) => m.name === 'post_reach' || m.name === 'post_impressions_unique');
                const engagedUsersMetric = data.find((m: any) => m.name === 'post_engaged_users');
                const reactionsMetric = data.find((m: any) => m.name === 'post_reactions');

                if (impressionsMetric) impressions = impressionsMetric.values[0]?.value || 0;
                if (reachMetric) reach = reachMetric.values[0]?.value || 0;
                // If the user specifically wants engaged users or reactions, we could store them too,
                // but for now they contribute to 'engagement' if not already summed.
            } else {
                console.warn(`[Facebook] Insights call failed for ${postId}, status: ${insightsResponse.status}`);
            }
        } catch (insightError) {
            console.warn(`[Facebook] Could not fetch (deep) insights for post ${postId}`, insightError);
        }

        // Calculate engagement rate
        // (Likes + Comments + Shares) / Reach * 100
        // If reach is 0, use impressions. If both 0, rate is 0.
        const totalEngagements = likes + comments + shares;
        const base = reach > 0 ? reach : impressions;
        const engagementRate = base > 0 ? (totalEngagements / base) * 100 : 0;

        return {
            likes,
            comments,
            impressions,
            reach,
            engagement: totalEngagements,
            engagementRate,
            isDeleted: false,
            message: postData.message || postData.name,
            full_picture: postData.full_picture,
            permalink_url: postData.permalink_url
        };

    } catch (error) {
        console.error(`[Facebook] Error fetching insights for ${postId}:`, error);
        throw error;
    }
}

export interface FacebookAudienceInsights {
    fansByCity: Record<string, number>;
    fansByCountry: Record<string, number>;
    fansByGenderAge: Record<string, number>;
    totalFollowers?: number;
    // New fields for reached audience
    reachedByCity: Record<string, number>;
    reachedByCountry: Record<string, number>;
    reachedByGenderAge: Record<string, number>;
    fanReach: number;
    nonFanReach: number;
    // New fields from user request
    fanAdds?: number;
    fanRemoves?: number;
    _rawResponses?: any[];
}

export async function getFacebookPageAudience(
    credentials: FacebookCredentials
): Promise<FacebookAudienceInsights> {
    const { accessToken, pageId } = credentials;

    const _rawResponses: any[] = [];
    const capture = async (res: Response, label: string) => {
        try {
            const clone = res.clone();
            const data = await clone.json();
            _rawResponses.push({ label, url: res.url, status: res.status, data });
        } catch (e) {
            _rawResponses.push({ label, url: res.url, status: res.status, error: 'Failed to parse JSON' });
        }
    };

    try {
        // 1. Fetch Total Follower Count
        const pageResponse = await fetch(
            `https://graph.facebook.com/v24.0/${pageId}?fields=followers_count&access_token=${accessToken}`
        );
        await capture(pageResponse, 'page_profile');

        let totalFollowers = 0;
        if (pageResponse.ok) {
            const pageData = await pageResponse.json();
            totalFollowers = pageData.followers_count || 0;
        }

        // 1. Fetch Follower (Fan) Demographics
        const fanMetrics = 'page_fans_city,page_fans_country,page_fans_gender_age';
        const fanResponse = await fetch(
            `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${fanMetrics}&period=lifetime&access_token=${accessToken}`
        );
        await capture(fanResponse, 'fan_demographics');

        let fansByCity: Record<string, number> = {};
        let fansByCountry: Record<string, number> = {};
        let fansByGenderAge: Record<string, number> = {};

        if (fanResponse.ok) {
            const data = await fanResponse.json();
            fansByCity = data.data?.find((m: any) => m.name === 'page_fans_city')?.values[0]?.value || {};
            fansByCountry = data.data?.find((m: any) => m.name === 'page_fans_country')?.values[0]?.value || {};
            fansByGenderAge = data.data?.find((m: any) => m.name === 'page_fans_gender_age')?.values[0]?.value || {};
        }

        // 2. Fetch Reached Audience Demographics
        const reachMetricsList = 'page_impressions_by_city_unique,page_impressions_by_country_unique,page_impressions_by_age_gender_unique';
        const reachDemographicsResponse = await fetch(
            `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${reachMetricsList}&period=days_28&access_token=${accessToken}`
        );
        await capture(reachDemographicsResponse, 'reach_demographics_28d');

        let reachedByCity: Record<string, number> = {};
        let reachedByCountry: Record<string, number> = {};
        let reachedByGenderAge: Record<string, number> = {};

        if (reachDemographicsResponse.ok) {
            const data = await reachDemographicsResponse.json();
            reachedByCity = data.data?.find((m: any) => m.name === 'page_impressions_by_city_unique')?.values[0]?.value || {};
            reachedByCountry = data.data?.find((m: any) => m.name === 'page_impressions_by_country_unique')?.values[0]?.value || {};
            reachedByGenderAge = data.data?.find((m: any) => m.name === 'page_impressions_by_age_gender_unique')?.values[0]?.value || {};
        }

        // 3. Fetch Fan vs Non-Fan Reach
        const reachSplitMetrics = 'page_posts_impressions_fan_unique,page_posts_impressions_unique';
        const reachSplitResponse = await fetch(
            `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${reachSplitMetrics}&period=days_28&access_token=${accessToken}`
        );
        await capture(reachSplitResponse, 'reach_split_28d');

        let fanReach = 0;
        let totalUniqueReach = 0;

        if (reachSplitResponse.ok) {
            const data = await reachSplitResponse.ok ? await reachSplitResponse.json() : { data: [] };
            fanReach = data.data?.find((m: any) => m.name === 'page_posts_impressions_fan_unique')?.values[0]?.value || 0;
            totalUniqueReach = data.data?.find((m: any) => m.name === 'page_posts_impressions_unique')?.values[0]?.value || 0;
        }

        // 4. Fetch Fan Adds/Removes (User requested metrics from separate URL logic)
        let fanAdds = 0;
        let fanRemoves = 0;
        try {
            const fanGrowthMetrics = 'page_fan_adds,page_fan_removes';
            const growthRes = await fetch(
                `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${fanGrowthMetrics}&period=lifetime&access_token=${accessToken}`
            );
            await capture(growthRes, 'fan_growth_lifetime');
            if (growthRes.ok) {
                const growthData = await growthRes.json();
                fanAdds = growthData.data?.find((m: any) => m.name === 'page_fan_adds')?.values[0]?.value || 0;
                fanRemoves = growthData.data?.find((m: any) => m.name === 'page_fan_removes')?.values[0]?.value || 0;
            }
        } catch (e) {
            console.error('[Facebook] Error fetching fan growth:', e);
        }

        return {
            fansByCity,
            fansByCountry,
            fansByGenderAge,
            totalFollowers,
            reachedByCity,
            reachedByCountry,
            reachedByGenderAge,
            fanReach,
            nonFanReach: Math.max(0, totalUniqueReach - fanReach),
            fanAdds,
            fanRemoves,
            _rawResponses
        };

    } catch (error) {
        console.error('[Facebook] Error fetching audience insights:', error);
        return {
            fansByCity: {},
            fansByCountry: {},
            fansByGenderAge: {},
            totalFollowers: 0,
            reachedByCity: {},
            reachedByCountry: {},
            reachedByGenderAge: {},
            fanReach: 0,
            nonFanReach: 0
        };
    }
}

export interface FacebookAccountInsights {
    reach: number;
    impressions: number;
    engagement: number;
    followerCount: number;
    // New fields from user request
    pageViews?: number;
    pageLikes?: number;
    engagedUsers?: number;
    _rawResponses?: any[];
}

export async function getFacebookAccountInsights(
    credentials: FacebookCredentials
): Promise<FacebookAccountInsights> {
    const { accessToken, pageId } = credentials;
    try {
        const _rawResponses: any[] = [];
        const capture = async (res: Response, label: string) => {
            try {
                const clone = res.clone();
                const data = await clone.json();
                _rawResponses.push({ label, url: res.url, status: res.status, data });
            } catch (e) {
                _rawResponses.push({ label, url: res.url, status: res.status, error: 'Failed to parse JSON' });
            }
        };

        // Fetch metrics using robust v24-safe metrics
        const accountInsightsMetrics = 'page_impressions_unique,page_post_engagements';
        const insightsUrl = `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${accountInsightsMetrics}&period=days_28&access_token=${accessToken}`;

        let pageViews = 0;
        let pageLikes = 0; // page_fan_adds is deprecated/unreliable in v24
        let reach = 0;
        let engagedUsers = 0;
        let impressions = 0;
        let engagement = 0;

        const insightsRes = await fetch(insightsUrl);
        await capture(insightsRes, 'account_insights_combined_28d');
        if (insightsRes.ok) {
            const data = await insightsRes.json();
            const items = data.data || [];

            const reachValues = items.find((m: any) => m.name === 'page_impressions_unique')?.values || [];
            reach = reachValues[reachValues.length - 1]?.value || 0;

            const engagementValues = items.find((m: any) => m.name === 'page_post_engagements')?.values || [];
            engagement = engagementValues[engagementValues.length - 1]?.value || 0;

            impressions = reach; // Proxy reach as impressions if impressions metric is deprecated
        }

        // Separate call for page_views (daily only in v24)
        try {
            const viewsRes = await fetch(`https://graph.facebook.com/v24.0/${pageId}/insights?metric=page_views_total&period=day&access_token=${accessToken}`);
            await capture(viewsRes, 'page_views_day');
            if (viewsRes.ok) {
                const viewsData = await viewsRes.json();
                const values = viewsData.data?.[0]?.values || [];
                pageViews = values.reduce((acc: number, v: any) => acc + (v.value || 0), 0);
            }
        } catch (e) {
            console.warn('[Facebook] Failed to fetch page views:', e);
        }

        // Follower count (fans) - Always use profile field in v24
        const pageRes = await fetch(`https://graph.facebook.com/v24.0/${pageId}?fields=followers_count&access_token=${accessToken}`);
        await capture(pageRes, 'page_profile_follower_v24');
        let followerCount = 0;
        if (pageRes.ok) {
            const pageData = await pageRes.json();
            followerCount = pageData.followers_count || 0;
        }

        return {
            reach,
            impressions,
            engagement,
            followerCount,
            pageViews,
            pageLikes,
            engagedUsers,
            _rawResponses
        };
    } catch (error) {
        console.error('[Facebook] Error fetching account insights:', error);
        return { reach: 0, impressions: 0, engagement: 0, followerCount: 0, pageViews: 0, pageLikes: 0, engagedUsers: 0 };
    }
}

/**
 * Lead Generation Functions
 */

// Fetch lead gen forms for a page
export async function getFacebookLeadForms(pageId: string, pageAccessToken: string) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${pageId}/leadgen_forms?fields=id,name,status&access_token=${pageAccessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch lead forms: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('[Facebook] Error fetching lead forms:', error);
        throw error;
    }
}

// Fetch leads for a specific form
export async function getFacebookLeads(formId: string, pageAccessToken: string) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${formId}/leads?fields=id,created_time,field_data&access_token=${pageAccessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch leads: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('[Facebook] Error fetching leads:', error);
        throw error;
    }
}

// Fetch details for a specific lead
export async function getFacebookLeadDetails(leadId: string, pageAccessToken: string) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${leadId}?fields=id,created_time,ad_id,form_id,field_data&access_token=${pageAccessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch lead details: ${JSON.stringify(error)}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[Facebook] Error fetching lead details:', error);
        throw error;
    }
}

// Subscribe a page to the application's webhooks
export async function subscribePageToApp(pageId: string, pageAccessToken: string) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${pageId}/subscribed_apps`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscribed_fields: ['leadgen'],
                    access_token: pageAccessToken
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to subscribe page: ${JSON.stringify(error)}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[Facebook] Error subscribing page:', error);
        throw error;
    }
}


/**
 * Ads Management Functions
 */

// Fetch all Ad Accounts reachable by the user
export async function getFacebookAdAccounts(userAccessToken: string) {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v24.0/me/adaccounts?fields=id,name,account_status,amount_spent,balance,currency&access_token=${userAccessToken}`
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch ad accounts: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('[Facebook] Error fetching ad accounts:', error);
        throw error;
    }
}