// BUG 1 FIX: Removed unused `prisma` import — it was imported but never used in this file.
import { validateMediaUrl, isVideoUrl } from './media-utils';

interface InstagramCredentials {
    accessToken: string;
    userId: string;
    connectionType?: 'FACEBOOK' | 'DIRECT';
}


function getBaseUrl(credentials: InstagramCredentials): string {
    if (credentials.connectionType === 'DIRECT') {
        return "https://graph.instagram.com/v18.0";
    }
    return "https://graph.facebook.com/v24.0";
}

export async function postToInstagram(
  credentials: InstagramCredentials,
  caption: string,
  media: string | string[],
  options?: {
    shareToFeed?: boolean;
    scheduledPublishTime?: number;
    isReel?: boolean;
    isVideo?: boolean;
    coverUrl?: string;
  }
) {
  const { accessToken, userId } = credentials;
  const baseUrl = getBaseUrl(credentials);

  const mediaList = Array.isArray(media) ? media : [media];
  const isCarousel = mediaList.length > 1;

  console.log(
    `[Instagram] User: ${userId} | Media Count: ${mediaList.length} | Carousel: ${isCarousel}`
  );

  try {
    // BUG 2 FIX: Initialize creationId to '' so TypeScript doesn't flag
    // "used before assigned" if the control flow analysis misses a branch.
    // Every live code path sets it before the publish step or returns/throws early.
    let creationId = '';

    // ============================================================
    // CAROUSEL FLOW
    // ============================================================
    if (isCarousel) {
      const childIds: string[] = [];

      for (const originalUrl of mediaList) {
        const isVideo = isVideoUrl(originalUrl); // Detect type using original URL
        const validation = validateMediaUrl(originalUrl);
        const mediaUrl = validation.url;

        console.log(`[Instagram] Carousel item: ${mediaUrl} | isVideo: ${isVideo}`);

        const params = new URLSearchParams({
          access_token: accessToken,
          is_carousel_item: "true",
          // For carousel items, VIDEO and IMAGE are valid and documented
          media_type: isVideo ? "VIDEO" : "IMAGE",
        });

        if (isVideo) {
          params.append("video_url", mediaUrl);
        } else {
          params.append("image_url", mediaUrl);
        }

        console.log(`[IG_DEBUG] Creating carousel child: ${mediaUrl} | isVideo: ${isVideo}`);
        const res = await fetch(
          `${baseUrl}/${userId}/media`,
          { method: "POST", body: params }
        );

        if (!res.ok) {
          const err = await res.json();
          console.error(`[IG_DEBUG] Carousel Child Failed:`, JSON.stringify(err, null, 2));
          throw new Error(
            `Carousel child creation failed: ${JSON.stringify(err)}`
          );
        }

        const data = await res.json();
        childIds.push(data.id);

        await waitForInstagramMediaProcessing(data.id, accessToken);
      }

      // Create carousel container
      const containerParams = new URLSearchParams({
        access_token: accessToken,
        media_type: "CAROUSEL",
        caption,
        children: childIds.join(","),
      });

      if (options?.scheduledPublishTime) {
        containerParams.append("publish", "false");
        containerParams.append(
          "scheduled_publish_time",
          options.scheduledPublishTime.toString()
        );
      }

      console.log(`[IG_DEBUG] Requesting Carousel Container. Children: ${childIds.join(',')}`);
      const containerRes = await fetch(
        `${baseUrl}/${userId}/media`,
        { method: "POST", body: containerParams }
      );

      if (!containerRes.ok) {
        const err = await containerRes.json();
        console.error(`[IG_DEBUG] Carousel Container Failed:`, JSON.stringify(err, null, 2));
        throw new Error(
          `Carousel container creation failed: ${JSON.stringify(err)}`
        );
      }

      const containerData = await containerRes.json();
      creationId = containerData.id;

      await waitForInstagramMediaProcessing(creationId, accessToken);
    }

    // ============================================================
    // SINGLE MEDIA FLOW
    // ============================================================
    else {
      const originalUrl = mediaList[0];
      const isVideo = options?.isVideo ?? isVideoUrl(originalUrl); // Detect type using original URL 
      const validation = validateMediaUrl(originalUrl);
      const mediaUrl = validation.url;

      console.log(`[Instagram] Posting single item. Original: ${originalUrl} | Public: ${mediaUrl} | isVideo: ${isVideo}`);

      const params = new URLSearchParams({
        access_token: accessToken,
        caption: caption || "",
      });

      if (isVideo) {
        // Modern Instagram Graph API treats all videos as REELS.
        // Even for "normal" posts, we use REELS and set share_to_feed: true to show it in the grid.
        params.append("media_type", "REELS");
        params.append("video_url", originalUrl);
        
        if (options?.coverUrl) {
          params.append("cover_url", options.coverUrl);
        }

        // share_to_feed defaults to false for Reels; we enable it to ensure it appears in the Main Grid.
        if (options?.shareToFeed !== false) {
          params.append("share_to_feed", "true");
        }
      } else {
        // For single IMAGE posts, media_type should be OMITTED as per Meta Docs example
        params.append("image_url", mediaUrl);
      }

      if (options?.scheduledPublishTime) {
        params.append("publish", "false");
        params.append(
          "scheduled_publish_time",
          options.scheduledPublishTime.toString()
        );
      }

      console.log(`[IG_DEBUG] Request: POST ${baseUrl}/${userId}/media`);
      console.log(`[IG_DEBUG] Params:`, Object.fromEntries(params.entries()));

      const res = await fetch(
        `${baseUrl}/${userId}/media`,
        { method: "POST", body: params }
      );

      if (!res.ok) {
        const err = await res.json();
        console.error(`[IG_DEBUG] Single Media Creation Failed:`, JSON.stringify(err, null, 2));
        throw new Error(
          `Media container creation failed: ${JSON.stringify(err)}`
        );
      }

      const data = await res.json();
      console.log(`[IG_DEBUG] Single Media Container Created: ${data.id}`);
      creationId = data.id;

      if (isVideo) {
        await waitForInstagramMediaProcessing(creationId, accessToken);
      }
    }

    // ============================================================
    // PUBLISH STEP
    // BUG 3 FIX: Skip the publish call when scheduledPublishTime is set.
    // The container was already created with publish=false and a scheduled_publish_time.
    // Calling media_publish immediately would override that and publish right now.
    // ============================================================
    if (options?.scheduledPublishTime) {
      console.log(`[Instagram] Post scheduled (container: ${creationId}). Skipping immediate publish.`);
      return { id: creationId };
    }

    console.log(`[Instagram] Publishing: ${creationId}`);

    console.log(`[IG_DEBUG] Requesting Media Publish. Container: ${creationId}`);
    const publishRes = await fetch(
      `${baseUrl}/${userId}/media_publish`,
      {
        method: "POST",
        body: new URLSearchParams({
          access_token: accessToken,
          creation_id: creationId,
        }),
      }
    );

    if (!publishRes.ok) {
      const err = await publishRes.json();
      console.error(`[IG_DEBUG] Media Publish Failed:`, JSON.stringify(err, null, 2));
      throw new Error(`Media publish failed: ${JSON.stringify(err)}`);
    }

    const publishData = await publishRes.json();
    console.log(`[IG_DEBUG] Successfully published: ${publishData.id}`);

    return { id: publishData.id };
  } catch (error) {
    console.error("[Instagram] Post failed:", error);
    throw error;
  }
}

async function waitForInstagramMediaProcessing(
    containerId: string,
    accessToken: string,
    timeout: number = 300000 // 5 minute timeout for video processing
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
                const statusCode = data.status_code;
                const statusDetail = data.status || 'No additional details provided by Meta.';
                
                console.log(`[Instagram] Container ${containerId} status: ${statusCode}${statusCode === 'ERROR' ? ` | Reason: ${statusDetail}` : ''}`);

                if (statusCode === 'FINISHED') return;
                
                if (statusCode === 'ERROR') {
                    console.error(`[Instagram] Container ${containerId} processing failed. Detail: ${statusDetail}`);
                    throw new Error(`Instagram Processing Error: ${statusDetail}`);
                }
                // If IN_PROGRESS or PUBLISHED, keep waiting (though PUBLISHED shouldn't happen before publish step)
            } else {
                console.warn(`[Instagram] Status check failed for ${containerId}: ${response.status}`);
            }
        } catch (e: any) {
            // Re-throw processing failures immediately to stop the polling loop
            if (e.message?.includes('Media processing failed')) {
                throw e;
            }
            console.error(`[Instagram] Error checking status for ${containerId}`, e);

            return;
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
    accessToken: string,
    connectionType?: 'FACEBOOK' | 'DIRECT'
): Promise<InstagramPostInsights> { 
    const mediaFields = 'like_count,comments_count,media_type,caption,media_url,permalink';
    const baseUrl = "https://graph.facebook.com/v24.0";
    const mediaResponse = await fetch(
        `${baseUrl}/${mediaId}?fields=${mediaFields}&access_token=${accessToken}`
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
                likes: 0, comments: 0, impressions: 0, reach: 0, saved: 0,
                shares: 0, video_views: 0, engagement: 0, engagementRate: 0, isDeleted: true
            };
        }
        // Genuine API error — throw so callers know something went wrong
        throw new Error(`Failed to fetch media details for ${mediaId}: ${JSON.stringify(error)}`);
    }

    const mediaData = await mediaResponse.json();
    const likes = mediaData.like_count || 0;
    const comments = mediaData.comments_count || 0;

    let impressions = 0;
    let reach = 0;
    let saved = 0;
    let video_views = 0;
    let totalInteractions = likes + comments;

    try {
        const isVideo = mediaData.media_type === 'VIDEO';

        const metricsArr = ['impressions', 'reach', 'saved', 'engagement'];
        if (isVideo) {
            metricsArr.push('plays');
            metricsArr.push('total_interactions');
        }

        const metrics = metricsArr.join(',');

        const insightsResponse = await fetch(
            `${baseUrl}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
        );

        if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json();
            const data = insightsData.data || [];

            // BUG 5 FIX: v24 media insights returns `total_value.value` (not `values[0]?.value`)
            // when no period param is provided. Use total_value.value with a fallback to values[0].value
            // for backwards compatibility with any period-scoped responses.
            const extractValue = (metric: any): number => {
                if (!metric) return 0;
                if (metric.total_value?.value !== undefined) return metric.total_value.value;
                return metric.values?.[0]?.value || 0;
            };

            const reachMetric = data.find((m: any) => m.name === 'reach');
            const savedMetric = data.find((m: any) => m.name === 'saved');
            const impressionsMetric = data.find((m: any) => m.name === 'impressions');
            const playsMetric = data.find((m: any) => m.name === 'plays');
            const interactionsMetric = data.find((m: any) => m.name === 'total_interactions');
            const engagementMetric = data.find((m: any) => m.name === 'engagement');

            reach = extractValue(reachMetric);
            saved = extractValue(savedMetric);
            impressions = extractValue(impressionsMetric);
            video_views = extractValue(playsMetric);

            if (interactionsMetric) {
                totalInteractions = extractValue(interactionsMetric) || totalInteractions;
                if (impressions === 0) impressions = video_views;
            } else if (engagementMetric) {
                totalInteractions = extractValue(engagementMetric) || totalInteractions;
            }

        } else {
            const fallbackResponse = await fetch(
                `${baseUrl}/${mediaId}/insights?metric=impressions,reach,saved&access_token=${accessToken}`
            );
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                const fData = fallbackData.data || [];

                const extractValue = (metric: any): number => {
                    if (!metric) return 0;
                    if (metric.total_value?.value !== undefined) return metric.total_value.value;
                    return metric.values?.[0]?.value || 0;
                };

                impressions = extractValue(fData.find((m: any) => m.name === 'impressions'));
                reach = extractValue(fData.find((m: any) => m.name === 'reach'));
                saved = extractValue(fData.find((m: any) => m.name === 'saved'));
            }
        }
    } catch (insightError) {
        console.warn(`[Instagram] Could not fetch insights for media ${mediaId}`, insightError);
    }

    // BUG 4 FIX: The previous `shares = totalInteractions - (likes + comments + saved)` formula
    // was unreliable because Meta's total_interactions includes profile visits, story replies,
    // and other actions — not just shares. This produced wildly incorrect share counts.
    // Instagram's Graph API does not expose a standalone `shares` metric for feed posts.
    // We default to 0 rather than report a meaningless number.
    const shares = 0;

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
    const baseUrl = getBaseUrl(credentials);
    try {
        const fields = 'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url';
        const response = await fetch(
            `${baseUrl}/${userId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`
        );
        if (!response.ok) throw new Error('Failed to fetch Instagram media');
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Instagram fetch media error:', error);
        throw error;
    }
}

// BUG 6 FIX: Removed _rawResponses from public interface types.
// Internal debug state should not be part of the production return contract.
export interface InstagramAudienceInsights {
    audienceCity: Record<string, number>;
    audienceCountry: Record<string, number>;
    audienceGenderAge: Record<string, number>;
    audienceLocale: Record<string, number>;
    totalFollowers: number;
    followerCity: Record<string, number>;
    followerCountry: Record<string, number>;
    followerGender: Record<string, number>;
    followerAge: Record<string, number>;
    followerReach: number;
    nonFollowerReach: number;
}

export async function getInstagramAudienceInsights(
    credentials: InstagramCredentials
): Promise<InstagramAudienceInsights> {
    const _rawResponses: any[] = []; // Internal only — not returned
    const capture = async (res: Response, label: string) => {
        try {
            const clone = res.clone();
            const data = await clone.json();
            _rawResponses.push({ label, url: res.url, status: res.status, data });
        } catch (e) {
            _rawResponses.push({ label, url: res.url, status: res.status, error: 'Failed to parse JSON' });
        }
    };

    const baseUrl = getBaseUrl(credentials);
    const { accessToken, userId } = credentials;
    try {
        // Fetch total followers count
        const profileRes = await fetch(`${baseUrl}/${userId}?fields=followers_count&access_token=${accessToken}`);
        await capture(profileRes, 'profile');
        let totalFollowers = 0;
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            totalFollowers = profileData.followers_count || 0;
        }

        // 1. Follower Demographics (Strict v24 - split calls)
        const followerCity: Record<string, number> = {};
        const followerCountry: Record<string, number> = {};
        const followerGender: Record<string, number> = {};
        const followerAge: Record<string, number> = {};

        const breakdowns = ['city', 'country', 'gender', 'age'];
        for (const breakdown of breakdowns) {
            try {
                const url = `${baseUrl}/${userId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${accessToken}`;
                const res = await fetch(url);
                await capture(res, `follower_demographics_${breakdown}`);

                if (res.ok) {
                    const data = await res.json();
                    const results = data.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];

                    results.forEach((item: any) => {
                        const label = item.dimension_values?.[0] || 'Unknown';
                        const val = item.value || 0;

                        if (breakdown === 'city') followerCity[label] = val;
                        else if (breakdown === 'country') followerCountry[label] = val;
                        else if (breakdown === 'gender') followerGender[label] = val;
                        else if (breakdown === 'age') followerAge[label] = val;
                    });
                }
            } catch (e) {
                console.error(`[Instagram] Error fetching follower demographics (${breakdown}):`, e);
            }
        }

        // Audience demographics (legacy/mapped from followers for UI stability)
        const audienceCity = followerCity;
        const audienceCountry = followerCountry;
        const audienceGenderAge = { ...followerGender, ...followerAge };
        const audienceLocale: Record<string, number> = {};

        // Reach breakdown not supported for IG accounts
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
            followerGender,
            followerAge,
            followerReach,
            nonFollowerReach,
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
            followerGender: {},
            followerAge: {},
            followerReach: 0,
            nonFollowerReach: 0
        };
    }
}

// BUG 6 FIX: Removed _rawResponses from public interface
export interface InstagramAccountInsights {
    reach: number;
    impressions: number;
    profileViews: number;
    websiteClicks: number;
    followerCount: number;
}

export async function getInstagramAccountInsights(
    credentials: InstagramCredentials
): Promise<InstagramAccountInsights> {
    const { accessToken, userId } = credentials;
    try {
        const _rawResponses: any[] = []; // Internal only — not returned
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
        const baseUrl = "https://graph.facebook.com/v24.0";

        // 1. Fetch Follower Count via profile field (verified working)
        const profileRes = await fetch(`${baseUrl}/${userId}?fields=followers_count&access_token=${accessToken}`);
        await capture(profileRes, 'profile_followers_direct');
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            followerCount = profileData.followers_count || 0;
        }

        // 2. Fetch Daily Metrics (Reach, Profile Views, Website Clicks)
        const until = Math.floor(Date.now() / 1000);
        const since = until - (30 * 24 * 60 * 60);

        const dailyUrl = `${baseUrl}/${userId}/insights?metric=reach,profile_views,website_clicks&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${accessToken}`;
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
        const growthUrl = `${baseUrl}/${userId}/insights?metric=follows_and_unfollows&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${accessToken}`;
        const growthRes = await fetch(growthUrl);
        await capture(growthRes, 'account_insights_daily_growth');

        return {
            reach,
            impressions,
            profileViews,
            websiteClicks,
            followerCount,
        };
    } catch (error) {
        console.error('[Instagram] Error fetching account insights:', error);
        return { reach: 0, impressions: 0, profileViews: 0, websiteClicks: 0, followerCount: 0 };
    }
}
