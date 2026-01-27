import { prisma } from "@/lib/prisma";
import { Buffer } from 'buffer';
import { validateMediaUrl, isVideoUrl } from './media-utils';

interface InstagramCredentials {
    accessToken: string;
    userId: string;
}

export async function postToInstagram(
    credentials: InstagramCredentials,
    caption: string,
    media: string | string[],
    options?: { isReel?: boolean; shareToFeed?: boolean; isVideo?: boolean }
) {
    const { accessToken, userId } = credentials;

    // Normalize media to array
    const mediaList = Array.isArray(media) ? media : [media];
    const isCarousel = mediaList.length > 1;

    console.log(`[Instagram] Posting to user: ${userId}, Media Count: ${mediaList.length}, Is Carousel: ${isCarousel}, Is Reel: ${options?.isReel || false}`);

    try {
        let creationId: string;

        if (isCarousel) {
            // CAROUSEL POSTING
            // 1. Create Item Containers for each media
            const itemIds: string[] = [];

            for (const mediaUrl of mediaList) {
                const isVideo = isVideoUrl(mediaUrl) || options?.isVideo; // Naive check for individual items
                const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

                let itemUrl = `https://graph.facebook.com/v24.0/${userId}/media?is_carousel_item=true&access_token=${accessToken}`;

                if (isVideo) {
                    itemUrl += `&media_type=VIDEO&video_url=${encodeURIComponent(mediaUrl)}`;
                } else {
                    itemUrl += `&image_url=${encodeURIComponent(mediaUrl)}`;
                }

                console.log(`[Instagram] Creating carousel item (${mediaType}): ${mediaUrl}`);
                const itemRes = await fetch(itemUrl, { method: 'POST' });

                if (!itemRes.ok) {
                    const error = await itemRes.json();
                    throw new Error(`Carousel Item creation failed: ${JSON.stringify(error)}`);
                }

                const itemData = await itemRes.json();
                itemIds.push(itemData.id);

                // Wait for video processing if needed
                if (isVideo) {
                    await waitForInstagramMediaProcessing(itemData.id, accessToken);
                }
            }

            // 2. Create Carousel Container
            console.log(`[Instagram] Creating carousel container with items: ${itemIds.join(', ')}`);
            const containerUrl = `https://graph.facebook.com/v24.0/${userId}/media?media_type=CAROUSEL&caption=${encodeURIComponent(caption)}&children=${itemIds.join(',')}&access_token=${accessToken}`;

            const containerRes = await fetch(containerUrl, { method: 'POST' });

            if (!containerRes.ok) {
                const error = await containerRes.json();
                const errorStr = JSON.stringify(error);

                // Add helpful context for common mixed-media carousel failures
                let hint = '';
                if (mediaList.length > 1 && mediaList.some(isVideoUrl) && mediaList.some(u => !isVideoUrl(u))) {
                    hint = ' (Hint: Mixed Image/Video carousels often fail if items have different aspect ratios. Try ensuring all items are 1:1 or 4:5)';
                }

                throw new Error(`Carousel Container creation failed: ${errorStr}${hint}`);
            }

            const containerData = await containerRes.json();
            creationId = containerData.id;

            // Wait for Carousel Container to be READY (IMPORTANT)
            // Even though items are ready, the container itself takes time to become FINISHED
            await waitForInstagramMediaProcessing(creationId, accessToken);

        } else {
            // SINGLE POST OR REEL
            const mediaUrl = mediaList[0];
            const isVideo = options?.isReel || isVideoUrl(mediaUrl);
            const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

            let containerUrl = `https://graph.facebook.com/v24.0/${userId}/media?caption=${encodeURIComponent(caption)}&access_token=${accessToken}`;

            if (isVideo) {
                containerUrl += `&media_type=${options?.isReel ? 'REELS' : 'VIDEO'}&video_url=${encodeURIComponent(mediaUrl)}`;
                if (options?.shareToFeed) {
                    // containerUrl += `&share_to_feed=true`; // Specific to REELS sometimes, but often automatic
                }
            } else {
                containerUrl += `&image_url=${encodeURIComponent(mediaUrl)}`;
            }

            console.log(`[Instagram] Creating single media container (${mediaType})`);
            const containerResponse = await fetch(containerUrl, { method: 'POST' });

            if (!containerResponse.ok) {
                const error = await containerResponse.json();
                throw new Error(`Media Container creation failed: ${JSON.stringify(error)}`);
            }

            const containerData = await containerResponse.json();
            creationId = containerData.id;

            // 2. Wait for Processing (if video)
            if (isVideo) {
                await waitForInstagramMediaProcessing(creationId, accessToken);
            }
        }

        // 3. Publish Media
        console.log(`[Instagram] Publishing media: ${creationId}`);
        const publishResponse = await fetch(
            `https://graph.facebook.com/v24.0/${userId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`,
            { method: 'POST' }
        );

        if (!publishResponse.ok) {
            const error = await publishResponse.json();
            throw new Error(`Media Publish failed: ${JSON.stringify(error)}`);
        }

        const publishData = await publishResponse.json();
        return { id: publishData.id };

    } catch (error) {
        console.error('Instagram posting error:', error);
        throw error;
    }
}

async function waitForInstagramMediaProcessing(
    containerId: string,
    accessToken: string,
    timeout: number = 60000
): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // Increased poll interval to 5s

    console.log(`[Instagram] Waiting for processing of container: ${containerId}`);

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(
                `https://graph.facebook.com/v24.0/${containerId}?fields=status_code&access_token=${accessToken}`
            );

            if (response.ok) {
                const data = await response.json();
                const status = data.status_code;
                console.log(`[Instagram] Container ${containerId} status: ${status}`);

                if (status === 'FINISHED') return;
                if (status === 'ERROR') {
                    // Try to fetch error details if possible (though often not exposed on this edge)
                    console.error(`[Instagram] Container ${containerId} failed processing.`);
                    throw new Error(`Media processing failed for ${containerId}. This usually means one of the items (Video/Image) failed validation (e.g. wrong aspect ratio, corrupt file).`);
                }
                // If IN_PROGRESS or PUBLISHED, keep waiting (though PUBLISHED shouldn't happen before publish step)
            } else {
                console.warn(`[Instagram] Status check failed for ${containerId}: ${response.status}`);
            }
        } catch (e) {
            console.error(`[Instagram] Error checking status for ${containerId}`, e);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Media processing timeout for ${containerId}`);
}

export interface InstagramPostInsights {
    likes: number;
    comments: number;
    impressions: number;
    reach: number;
    saved: number;
    shares: number;
    video_views: number;
    engagement: number;
    engagementRate: number;
    isDeleted?: boolean;
    caption?: string;
    media_url?: string;
    permalink?: string;
}

export async function getInstagramPostInsights(
    mediaId: string,
    accessToken: string
): Promise<InstagramPostInsights> {
    try {
        const fields = 'like_count,comments_count,media_type,caption,media_url,permalink';
        const mediaResponse = await fetch(
            `https://graph.facebook.com/v24.0/${mediaId}?fields=${fields}&access_token=${accessToken}`
        );

        if (!mediaResponse.ok) {
            const error = await mediaResponse.json();
            const errorCode = error.error?.code;
            const errorSubcode = error.error?.error_subcode;
            const errorMessage = error.error?.message || "";

            const isDefinitelyDeleted =
                (errorCode === 100 && (errorSubcode === 33 || errorMessage.includes('does not exist'))) ||
                errorCode === 210;

            if (isDefinitelyDeleted) {
                return {
                    likes: 0, comments: 0, impressions: 0, reach: 0, saved: 0, shares: 0, video_views: 0, engagement: 0, engagementRate: 0, isDeleted: true
                };
            }
            throw new Error(`Failed to fetch media details: ${JSON.stringify(error)}`);
        }

        const mediaData = await mediaResponse.json();
        const likes = mediaData.like_count || 0;
        const comments = mediaData.comments_count || 0;

        let impressions = 0;
        let reach = 0;
        let saved = 0;
        let shares = 0;
        let video_views = 0;
        let totalInteractions = likes + comments;

        try {
            const isVideo = mediaData.media_type === 'VIDEO';

            // User requested metrics: impressions, reach, saves, video_views, engagement
            const metricsArr = ['impressions', 'reach', 'saved', 'engagement'];
            if (isVideo) {
                metricsArr.push('plays'); // maps to video_views for Reels
                metricsArr.push('total_interactions');
            }

            const metrics = metricsArr.join(',');

            const insightsResponse = await fetch(
                `https://graph.facebook.com/v24.0/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
            );

            if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json();
                const data = insightsData.data || [];

                const reachMetric = data.find((m: any) => m.name === 'reach');
                const savedMetric = data.find((m: any) => m.name === 'saved');
                const impressionsMetric = data.find((m: any) => m.name === 'impressions');
                const playsMetric = data.find((m: any) => m.name === 'plays');
                const interactionsMetric = data.find((m: any) => m.name === 'total_interactions');
                const engagementMetric = data.find((m: any) => m.name === 'engagement');

                if (reachMetric) reach = reachMetric.values[0]?.value || 0;
                if (savedMetric) saved = savedMetric.values[0]?.value || 0;
                if (impressionsMetric) impressions = impressionsMetric.values[0]?.value || 0;
                if (playsMetric) video_views = playsMetric.values[0]?.value || 0;

                if (interactionsMetric) {
                    totalInteractions = interactionsMetric.values[0]?.value || totalInteractions;
                    if (impressions === 0) impressions = video_views;
                } else if (engagementMetric) {
                    totalInteractions = engagementMetric.values[0]?.value || totalInteractions;
                }

            shares = Math.max(0, totalInteractions - (likes + comments + saved));

        } else {
                const fallbackResponse = await fetch(
                    `https://graph.facebook.com/v24.0/${mediaId}/insights?metric=impressions,reach,saved&access_token=${accessToken}`
                );
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    const fData = fallbackData.data || [];
                    const impMetric = fData.find((m: any) => m.name === 'impressions');
                    const rMetric = fData.find((m: any) => m.name === 'reach');
                    const sMetric = fData.find((m: any) => m.name === 'saved');
                    if (impMetric) impressions = impMetric.values[0]?.value || 0;
                    if (rMetric) reach = rMetric.values[0]?.value || 0;
                    if (sMetric) saved = sMetric.values[0]?.value || 0;
                }
            }
        } catch (insightError) {
            console.warn(`[Instagram] Could not fetch insights for media ${mediaId}`, insightError);
        }

        const base = reach > 0 ? reach : impressions;
        const engagementRate = base > 0 ? (totalInteractions / base) * 100 : 0;

        return {
            likes,
            comments,
            impressions,
            reach,
            saved,
            shares,
            video_views,
            engagement: totalInteractions,
            engagementRate,
            isDeleted: false,
            caption: mediaData.caption,
            media_url: mediaData.media_url,
            permalink: mediaData.permalink
        };

    } catch (error) {
        console.error(`[Instagram] Error fetching insights for ${mediaId}:`, error);
        return {
            likes: 0, comments: 0, impressions: 0, reach: 0, saved: 0, shares: 0, video_views: 0, engagement: 0, engagementRate: 0, isDeleted: false
        };
    }
}

export interface InstagramMedia {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    permalink: string;
    timestamp: string;
    thumbnail_url?: string;
}

export async function getInstagramUserMedia(
    credentials: InstagramCredentials,
    limit: number = 20
): Promise<InstagramMedia[]> {
    const { accessToken, userId } = credentials;
    try {
        const fields = 'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url';
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${userId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`
        );
        if (!response.ok) throw new Error('Failed to fetch Instagram media');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Instagram fetch media error:', error);
        throw error;
    }
}

export interface InstagramAudienceInsights {
    audienceCity: Record<string, number>;
    audienceCountry: Record<string, number>;
    audienceGenderAge: Record<string, number>;
    audienceLocale: Record<string, number>;
    totalFollowers: number;
    // New fields for detailed reports
    followerCity: Record<string, number>;
    followerCountry: Record<string, number>;
    followerGenderAge: Record<string, number>;
    followerReach: number;
    nonFollowerReach: number;
    _rawResponses?: any[];
}

export async function getInstagramAudienceInsights(
    credentials: InstagramCredentials
): Promise<InstagramAudienceInsights> {
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

    const { accessToken, userId } = credentials;
    try {
        // Fetch total followers count
        const profileRes = await fetch(`https://graph.facebook.com/v24.0/${userId}?fields=followers_count&access_token=${accessToken}`);
        await capture(profileRes, 'profile');
        let totalFollowers = 0;
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            totalFollowers = profileData.followers_count || 0;
        }

        // 1. Follower Demographics (Strict v24 - split calls)
        const followerCity: Record<string, number> = {};
        const followerCountry: Record<string, number> = {};
        const followerGenderAge: Record<string, number> = {};

        const breakdowns = ['city', 'country', 'gender', 'age'];
        for (const breakdown of breakdowns) {
            try {
                // v24 strict demographics: one breakdown per request, NO metric_type
                const url = `https://graph.facebook.com/v24.0/${userId}/insights?metric=follower_demographics&period=lifetime&breakdown=${breakdown}&access_token=${accessToken}`;
                const res = await fetch(url);
                await capture(res, `follower_demographics_${breakdown}`);

                if (res.ok) {
                    const data = await res.json();
                    const value = data.data?.[0]?.values?.[0]?.value || {};
                    if (breakdown === 'city') Object.assign(followerCity, value);
                    else if (breakdown === 'country') Object.assign(followerCountry, value);
                    else Object.assign(followerGenderAge, value);
                }
            } catch (e) {
                console.error(`[Instagram] Error fetching follower demographics (${breakdown}):`, e);
            }
        }

        // Audience demographics (legacy/mapped from followers for UI stability)
        const audienceCity = followerCity;
        const audienceCountry = followerCountry;
        const audienceGenderAge = followerGenderAge;
        const audienceLocale: Record<string, number> = {};

        // 2. Reach Breakdown (Not supported for IG accounts)
        const followerReach = 0;
        const nonFollowerReach = 0;

        return {
            audienceCity,
            audienceCountry,
            audienceGenderAge,
            audienceLocale,
            totalFollowers,
            followerCity,
            followerCountry,
            followerGenderAge,
            followerReach,
            nonFollowerReach,
            _rawResponses
        };
    } catch (error) {
        console.error('[Instagram] Error fetching audience insights:', error);
        return {
            audienceCity: {},
            audienceCountry: {},
            audienceGenderAge: {},
            audienceLocale: {},
            totalFollowers: 0,
            followerCity: {},
            followerCountry: {},
            followerGenderAge: {},
            followerReach: 0,
            nonFollowerReach: 0
        };
    }
}

export interface InstagramAccountInsights {
    reach: number;
    impressions: number;
    profileViews: number;
    websiteClicks: number;
    followerCount: number;
    _rawResponses?: any[];
}

export async function getInstagramAccountInsights(
    credentials: InstagramCredentials
): Promise<InstagramAccountInsights> {
    const { accessToken, userId } = credentials;
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

        let reach = 0;
        let impressions = 0;
        let profileViews = 0;
        let websiteClicks = 0;
        let followerCount = 0;

        // 1. Fetch Follower Count via profile field (verified working)
        const profileRes = await fetch(`https://graph.facebook.com/v24.0/${userId}?fields=followers_count&access_token=${accessToken}`);
        await capture(profileRes, 'profile_followers_direct');
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            followerCount = profileData.followers_count || 0;
        }

        // 2. Fetch Daily Metrics (Reach, Profile Views, Website Clicks) manually aggregate over ~30 days.
        // v24 Working URL for Reach/Views/Clicks: metric=reach,profile_views,website_clicks&period=day&metric_type=total_value
        const until = Math.floor(Date.now() / 1000);
        const since = until - (30 * 24 * 60 * 60);

        const dailyUrl = `https://graph.facebook.com/v24.0/${userId}/insights?metric=reach,profile_views,website_clicks&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${accessToken}`;
        const dailyRes = await fetch(dailyUrl);
        await capture(dailyRes, 'account_insights_daily_reach_views');

        if (dailyRes.ok) {
            const data = await dailyRes.json();
            const items = data.data || [];

            const getVal = (name: string) => {
                const m = items.find((i: any) => i.name === name);
                if (!m) return 0;
                if (m.total_value?.value !== undefined) return m.total_value.value;
                return (m.values || []).reduce((acc: number, v: any) => acc + (v.value || 0), 0);
            };

            reach = getVal('reach');
            profileViews = getVal('profile_views');
            websiteClicks = getVal('website_clicks');

            // Impressions proxy: Use reach if impressions is not allowed at account level for period=day
            impressions = reach;
        }

        // 3. Optional: Follows and Unfollows for growth metrics
        const growthUrl = `https://graph.facebook.com/v24.0/${userId}/insights?metric=follows_and_unfollows&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${accessToken}`;
        const growthRes = await fetch(growthUrl);
        await capture(growthRes, 'account_insights_daily_growth');
        // (Just capturing for debug/raw data for now)

        return {
            reach,
            impressions,
            profileViews,
            websiteClicks,
            followerCount,
            _rawResponses
        };
    } catch (error) {
        console.error('[Instagram] Error fetching account insights:', error);
        return { reach: 0, impressions: 0, profileViews: 0, websiteClicks: 0, followerCount: 0 };
    }
}
