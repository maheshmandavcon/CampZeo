import FormData from 'form-data';

interface PinterestCredentials {
    accessToken: string;
}

interface PinterestBoard {
    id: string;
    name: string;
    description: string;
    privacy: string;
}

export async function postToPinterest(
    credentials: PinterestCredentials,
    title: string,
    description: string,
    media: string | string[],
    metadata?: {
        boardId?: string;
        coverImageUrl?: string;
        coverImageKeyFrameTime?: number;
        isVideo?: boolean;
    }
) {
    const { accessToken } = credentials;

    console.log(`[Pinterest] Creating pin: ${title}`);

    if (!media || (Array.isArray(media) && media.length === 0)) {
        throw new Error('Pinterest requires an image or video');
    }

    try {
        let body: any = {
            title,
            description,
            board_id: metadata?.boardId || undefined,
        };

        const mediaList = Array.isArray(media) ? media : [media];

        // Check if multiple images (Carousel)
        if (mediaList.length > 1) {

            const hasVideo = mediaList.some(url => /\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i.test(url));
            if (hasVideo) {
                // Pinterest Organic API Limitations:
                // - Video Carousel: Not supported via standard organic endpoints (only ads).
                // - Mixed Media: Not supported.
                // - Multiple Videos: Not supported.
                throw new Error('Pinterest does not support multiple video posts or mixed media with video. Please use a single video or multiple images.');
            }

            body.media_source = {
                source_type: 'multiple_image_urls',
                items: mediaList.map(url => ({
                    url: url,
                    title: title, // Optional: can be set per image
                    description: description // Optional
                })),
                index: 0
            };
            console.log(`[Pinterest] Creating Carousel Pin with ${mediaList.length} images.`);

        } else {
            // Single Item
            const mediaUrl = mediaList[0];
            const isVideo = metadata?.isVideo ?? /\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i.test(mediaUrl);

            if (isVideo) {
                console.log(`[Pinterest] Video detected. Starting multi-phase upload for: ${mediaUrl}`);

                // 1. Register Media
                const registerRes = await fetch('https://api.pinterest.com/v5/media', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ media_type: 'video' }),
                });

                if (!registerRes.ok) {
                    const error = await registerRes.json();
                    throw new Error(`Pinterest Media Registration error: ${JSON.stringify(error)}`);
                }

                const registerData = await registerRes.json();
                const { media_id, upload_url, upload_parameters } = registerData;
                console.log(`[Pinterest] Media registered, ID: ${media_id}`);

                // 2. Download Video binary
                console.log(`[Pinterest] Downloading video for binary upload: ${mediaUrl}`);
                const videoRes = await fetch(mediaUrl);
                if (!videoRes.ok) throw new Error(`Failed to fetch video from URL: ${mediaUrl}`);
                const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

                // 3. Upload Binary to Pinterest's Amazon S3 bucket (via their upload_url)
                const form = new FormData();

                // Fields MUST be added in order
                Object.entries(upload_parameters).forEach(([key, value]) => {
                    form.append(key, value as string);
                });

                // The 'file' field MUST be the last field in the form for S3 POST
                console.log(`[Pinterest] Uploading video binary to ${upload_url}, length: ${videoBuffer.length} bytes`);
                form.append('file', videoBuffer, {
                    filename: 'video.mp4',
                    contentType: 'video/mp4'
                });

                const uploadRes = await fetch(upload_url, {
                    method: 'POST',
                    body: form.getBuffer() as any,
                    headers: form.getHeaders()
                });

                if (!uploadRes.ok) {
                    const errorText = await uploadRes.text();
                    console.error('[Pinterest] Video Binary Upload Error:', errorText);
                    throw new Error(`Pinterest Video Upload error: ${errorText}`);
                }

                console.log(`[Pinterest] Video uploaded. Waiting for processing...`);
                // Wait for media to be 'registered'
                await waitForPinterestMedia(media_id, accessToken);

                // 4. Create Pin using media_id
                body.media_source = {
                    source_type: 'video_id',
                    media_id: media_id,
                    cover_image_url: metadata?.coverImageUrl || undefined,
                    cover_image_key_frame_time: metadata?.coverImageUrl ? undefined : (metadata?.coverImageKeyFrameTime ?? 0)
                };

                // Note: We might need to wait for media to be processed, 
                // but Pinterest API allows creating Pin immediately; if processing fails, Pin stays 'processing' or fails later.
            } else {
                console.log(`[Pinterest] Image detected. Creating standard Pin.`);
                body.media_source = {
                    source_type: 'image_url',
                    url: mediaUrl,
                };
            }
        }

        // Create a Pin - Production URL
        console.log(`[Pinterest] Creating Pin with payload:`, JSON.stringify(body, null, 2));
        const response = await fetch('https://api.pinterest.com/v5/pins', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Pinterest API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        console.log(`[Pinterest] Pin created successfully: ${data.id}`);

        return { id: data.id };

    } catch (error) {
        console.error('Pinterest posting error:', error);
        throw error;
    }
}

/**
 * Wait for Pinterest media processing to complete (reaches 'registered' state)
 */
async function waitForPinterestMedia(
    mediaId: string,
    accessToken: string,
    timeout: number = 60000 // 60 second timeout
): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds

    console.log(`[Pinterest] Waiting for media ${mediaId} to be registered...`);

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(`https://api.pinterest.com/v5/media/${mediaId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const status = data.status;

                console.log(`[Pinterest] Media ${mediaId} status: ${status}`);

                if (status === 'registered') {
                    console.log(`[Pinterest] Media ${mediaId} is registered and ready.`);
                    return;
                } else if (status === 'failed') {
                    throw new Error(`Pinterest media processing failed for ${mediaId}`);
                }
                // If status is 'processing', wait and poll again
            } else {
                console.warn(`[Pinterest] Media status check failed: ${response.status}`);
            }
        } catch (error) {
            console.error(`[Pinterest] Error polling media status:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Pinterest media processing timed out for ${mediaId}`);
}

export async function getPinterestBoards(accessToken: string): Promise<PinterestBoard[]> {
    try {
        // Production URL
        const response = await fetch('https://api.pinterest.com/v5/boards', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Pinterest API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            privacy: item.privacy,
        }));
    } catch (error) {
        console.error('Error fetching Pinterest boards:', error);
        return [];
    }
}

export async function createPinterestBoard(accessToken: string, name: string, description?: string, privacy: 'PUBLIC' | 'SECRET' = 'PUBLIC'): Promise<PinterestBoard> {
    try {
        const response = await fetch('https://api.pinterest.com/v5/boards', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                description: description || undefined,
                privacy
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Pinterest API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return {
            id: data.id,
            name: data.name,
            description: data.description,
            privacy: data.privacy,
        };
    } catch (error) {
        console.error('Error creating Pinterest board:', error);
        throw error;
    }
}

export interface PinterestPostInsights {
    likes: number; // 'saves' in Pinterest
    comments: number; // Not always available in API v5 standard analytics
    impressions: number;
    reach: number; // Not directly 'reach', usually 'impression' or 'outbound_click'
    engagement: number;
    engagementRate: number;
    saves: number;
    pinClicks: number;
    outboundClicks: number;
    isDeleted: boolean;
    title?: string;
    description?: string;
    message?: string;
    caption?: string;
    media?: any;
    paidStats?: {
        saves: number;
        impressions: number;
        clicks: number;
    } | null;
}

export async function getPinterestPostInsights(
    pinId: string,
    accessToken: string
): Promise<PinterestPostInsights> {
    try {
        let comments = 0;
        let likes = 0; // Initialize likes
        let impressions = 0; // Initialize impressions
        let saves = 0; // Initialize saves
        let pinClicks = 0; // Initialize pinClicks
        let outboundClicks = 0; // Initialize outboundClicks
        let pinMetadata: any = null;

        // 0. Fetch Ad Accounts to get combined organic + paid data
        const adAccounts = await getPinterestAdAccounts(accessToken);

        // 1. Get Pin Details (Organic baseline + Global totals)
        const detailsResponse = await fetch(`https://api.pinterest.com/v5/pins/${pinId}?pin_metrics=true`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (detailsResponse.ok) {
            pinMetadata = await detailsResponse.json();
            console.log(`[Pinterest] Pin Details for ${pinId}:`, JSON.stringify(pinMetadata, null, 2));

            // Try different nested metric objects (Pinterest API v5 variations)
            const pm = pinMetadata.pin_metrics || pinMetadata.all_pin_metrics || {};
            const lt = pm.lifetime_metrics || pm.lifetime || pm.all_time || {};

            // Pinterest v5 fields for interactions
            // Attempt to get from top level (sometimes available for real-time) or from lifetime metrics
            comments = pinMetadata.comment_count ?? lt.comment ?? lt.comments ?? 0;
            const reactionCount = pinMetadata.reaction_count ?? lt.reaction ?? lt.reactions ?? 0;
            const saveCount = pinMetadata.save_count ?? lt.save ?? lt.saves ?? 0;

            console.log(`[Pinterest] Extracted - Comments: ${comments}, Reactions: ${reactionCount}, Saves: ${saveCount}`);

            // In Pinterest app, "Hearts" are reactions. 
            // We use reactions as 'likes' if available, otherwise fallback to saves.
            likes = reactionCount > 0 ? reactionCount : saveCount;

            impressions = lt.impression ?? lt.impressions ?? pinMetadata.impressions ?? 0;
            saves = saveCount;
            pinClicks = lt.pin_click ?? lt.pin_clicks ?? 0;
            outboundClicks = lt.outbound_click ?? lt.outbound_clicks ?? 0;
        } else if (detailsResponse.status === 404) {
            return {
                likes: 0, comments: 0, impressions: 0, reach: 0, engagement: 0, engagementRate: 0,
                saves: 0, pinClicks: 0, outboundClicks: 0, isDeleted: true
            };
        }

        // 2. Fetch Analytics across all Ad Accounts to find the true "Combined" total
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const metricsParam = 'IMPRESSION,PIN_CLICK,SAVE,OUTBOUND_CLICK';

        // Fetch organic analytics as additional source
        const orgUrl = `https://api.pinterest.com/v5/pins/${pinId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=${metricsParam}`;
        const orgRes = await fetch(orgUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (orgRes.ok) {
            const orgData = await orgRes.json();
            const summary = orgData.all?.summary_metrics || orgData.organic?.summary_metrics || {};
            impressions = Math.max(impressions, summary.IMPRESSION || 0);
            saves = Math.max(saves, summary.SAVE || 0);
            pinClicks = Math.max(pinClicks, summary.PIN_CLICK || 0);
            outboundClicks = Math.max(outboundClicks, summary.OUTBOUND_CLICK || 0);
            if (likes === 0 && summary.SAVE > 0) likes = summary.SAVE;
        }

        // Loop through ad accounts to get the highest reported "Combined" totals (or sum if appropriate)
        for (const account of adAccounts) {
            try {
                const adUrl = `https://api.pinterest.com/v5/pins/${pinId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=${metricsParam}&ad_account_id=${account.id}`;
                const adRes = await fetch(adUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                if (adRes.ok) {
                    const adData = await adRes.json();
                    const summary = adData.all?.summary_metrics || {};
                    // Update if ad-account context shows higher numbers (includes paid data)
                    impressions = Math.max(impressions, summary.IMPRESSION || 0);
                    saves = Math.max(saves, summary.SAVE || 0);
                    pinClicks = Math.max(pinClicks, summary.PIN_CLICK || 0);
                    outboundClicks = Math.max(outboundClicks, summary.OUTBOUND_CLICK || 0);
                    if (likes < saves) likes = saves;
                }
            } catch (e) {
                console.warn(`[Pinterest] Ad stats fetch failed for account ${account.id}`);
            }
        }

        // 3. Final Fallback/Paid check (using the ads/analytics endpoint which is even more specific)
        const paidStats = await getPinterestPinAdAnalytics(pinId, accessToken);
        impressions += (paidStats?.impressions || 0);
        saves += (paidStats?.saves || 0);
        pinClicks += (paidStats?.clicks || 0);
        // 3. Final Aggregation for reach and ER
        const reach = impressions;
        const totalEngagements = saves + pinClicks + outboundClicks + comments + (likes > saves ? likes - saves : 0);
        const engagementRate = impressions > 0 ? (totalEngagements / impressions) * 100 : 0;

        const result: PinterestPostInsights = {
            likes,
            comments,
            impressions,
            reach,
            engagement: totalEngagements,
            engagementRate,
            saves,
            pinClicks,
            outboundClicks,
            isDeleted: false
        };

        if (pinMetadata?.title) result.title = pinMetadata.title;
        if (pinMetadata?.description) result.description = pinMetadata.description;
        if (pinMetadata?.title || pinMetadata?.description) {
            result.message = pinMetadata.title || pinMetadata.description;
            result.caption = pinMetadata.description || "";
        }
        if (pinMetadata?.media) result.media = pinMetadata.media;

        return result;

    } catch (error) {
        console.error(`[Pinterest] Error fetching insights for ${pinId}:`, error);
        return {
            likes: 0,
            comments: 0,
            impressions: 0,
            reach: 0,
            engagement: 0,
            engagementRate: 0,
            saves: 0,
            pinClicks: 0,
            outboundClicks: 0,
            isDeleted: false
        };
    }
}

export interface PinterestPin {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    media: any;
}

/**
 * Fetch Ad Accounts associated with the user (v5 API)
 */
export async function getPinterestAdAccounts(accessToken: string) {
    try {
        const response = await fetch('https://api.pinterest.com/v5/ad_accounts', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            console.warn(`[Pinterest] Failed to fetch ad accounts: ${JSON.stringify(error)}`);
            return [];
        }

        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('[Pinterest] Error fetching ad accounts:', error);
        return [];
    }
}

/**
 * Fetch Ad Analytics for a specific Pin across all ad accounts
 */
export async function getPinterestPinAdAnalytics(pinId: string, accessToken: string) {
    try {
        const adAccounts = await getPinterestAdAccounts(accessToken);
        if (adAccounts.length === 0) return null;

        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        let totalPaidSaves = 0;
        let totalPaidImpressions = 0;
        let totalPaidClicks = 0;

        for (const account of adAccounts) {
            // Fetch analytics for this pin in this ad account
            // Note: This requires filtering by pin_ids in the ad analytics endpoint
            const url = `https://api.pinterest.com/v5/ad_accounts/${account.id}/ads/analytics?start_date=${startDate}&end_date=${endDate}&pin_ids=${pinId}&columns=SPEND_IN_MICRO_DOLLAR,PAID_IMPRESSION,PAID_CLICK,SAVE&granularity=TOTAL`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    const stats = data[0];
                    totalPaidSaves += stats.SAVE || 0;
                    totalPaidImpressions += stats.PAID_IMPRESSION || 0;
                    totalPaidClicks += stats.PAID_CLICK || 0;
                }
            }
        }

        return {
            saves: totalPaidSaves,
            impressions: totalPaidImpressions,
            clicks: totalPaidClicks
        };
    } catch (error) {
        console.error('[Pinterest] Error fetching pin ad analytics:', error);
        return null;
    }
}

export async function getPinterestUserPins(
    accessToken: string,
    limit: number = 20
): Promise<PinterestPin[]> {
    try {
        const response = await fetch(
            `https://api.pinterest.com/v5/pins?limit=${limit}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                }
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch Pinterest pins: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.items?.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            createdAt: item.created_at,
            media: item.media
        })) || [];
    } catch (error) {
        console.error('Pinterest fetch pins error:', error);
        throw error;
    }
}

/**
 * Refresh Pinterest access token using refresh token (v5 API)
 */
export async function refreshPinterestToken(refreshToken: string, clientId: string, clientSecret: string) {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const response = await fetch("https://api.pinterest.com/v5/oauth/token", {
        method: "POST",
        headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to refresh Pinterest token: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data;
}

export interface PinterestAudienceInsights {
    categories: Record<string, number>;
    demographics: {
        ages: Record<string, number>;
        genders: Record<string, number>;
        locations: Record<string, number>; // Metro/Country
        devices: Record<string, number>;
    };
    totalFollowers?: number;
}

export async function getPinterestAudienceInsights(
    accessToken: string
): Promise<any> {
    console.log('[Pinterest] 🔍 Starting audience insights fetch...');

    let totalFollowers = 0;
    let categories: Record<string, number> = {};
    let demographics = { ages: {}, genders: {}, locations: {}, devices: {} };

    // Store raw API responses for debugging
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

    // STEP 1: Fetch follower count (CRITICAL - must succeed)
    try {
        console.log('[Pinterest] 📊 Fetching user account...');
        const userResponse = await fetch('https://api.pinterest.com/v5/user_account', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (userResponse.ok) {
            const userData = await userResponse.json();
            await capture(userResponse.clone(), 'user_account'); // Using clone because json() might have been consumed if we weren't careful, but capture does it correctly too.
            totalFollowers = userData.follower_count || 0;
            console.log(`[Pinterest] ✅ Follower count: ${totalFollowers}`);
        } else {
            const errorText = await userResponse.text();
            console.error(`[Pinterest] ❌ User account fetch failed (${userResponse.status}):`, errorText);
        }
    } catch (error) {
        console.error('[Pinterest] ❌ Exception in user account fetch:', error);
    }

    // STEP 2: Fetch ad accounts (needed for demographics)
    let adAccounts: any[] = [];
    try {
        console.log('[Pinterest] 🏢 Fetching ad accounts...');
        adAccounts = await getPinterestAdAccounts(accessToken);
        console.log(`[Pinterest] Found ${adAccounts.length} ad account(s)`);

        if (adAccounts.length === 0) {
            console.warn('[Pinterest] ⚠️ No ad accounts - demographics unavailable');
        }
    } catch (error) {
        console.error('[Pinterest] ❌ Exception fetching ad accounts:', error);
    }

    // STEP 3: Fetch audience insights (optional demographics)
    if (adAccounts.length > 0) {
        try {
            const adAccountId = adAccounts[0].id;
            console.log(`[Pinterest] 📈 Fetching insights for account: ${adAccountId}`);

            const params = new URLSearchParams({
                audience_insight_type: 'YOUR_TOTAL_AUDIENCE'
            });

            const insightsResponse = await fetch(
                `https://api.pinterest.com/v5/ad_accounts/${adAccountId}/audience_insights?${params}`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                }
            );

            if (insightsResponse.ok) {
                const data = await insightsResponse.json();
                await capture(insightsResponse, 'audience_insights');

                // Pinterest API returns demographics as arrays with {key, name, ratio}
                // Convert to our expected format: Record<string, number>

                // Categories (if present)
                if (data.categories && Array.isArray(data.categories)) {
                    categories = data.categories.reduce((acc: Record<string, number>, cat: any) => {
                        acc[cat.name || cat.key] = cat.ratio || 0;
                        return acc;
                    }, {});
                }

                // Demographics
                if (data.demographics) {
                    // Ages: [{key: "18-24", name: "18-24", ratio: 0.259}, ...]
                    if (Array.isArray(data.demographics.ages)) {
                        demographics.ages = data.demographics.ages.reduce((acc: Record<string, number>, age: any) => {
                            acc[age.key || age.name] = age.ratio || 0;
                            return acc;
                        }, {});
                    }

                    // Genders: [{key: "Female", name: "Female", ratio: 0.68}, ...]
                    if (Array.isArray(data.demographics.genders)) {
                        demographics.genders = data.demographics.genders.reduce((acc: Record<string, number>, gender: any) => {
                            acc[gender.key || gender.name] = gender.ratio || 0;
                            return acc;
                        }, {});
                    }

                    // Countries: [{key: "us", name: "United States", ratio: 0.666}, ...]
                    if (Array.isArray(data.demographics.countries)) {
                        demographics.locations = data.demographics.countries.reduce((acc: Record<string, number>, country: any) => {
                            acc[country.key || country.name] = country.ratio || 0;
                            return acc;
                        }, {});
                    }

                    // Devices: [{key: "IPHONE", name: "iPhone", ratio: 0.61}, ...]
                    if (Array.isArray(data.demographics.devices)) {
                        demographics.devices = data.demographics.devices.reduce((acc: Record<string, number>, device: any) => {
                            acc[device.key || device.name] = device.ratio || 0;
                            return acc;
                        }, {});
                    }
                }

                console.log('[Pinterest] ✅ Demographics fetched and parsed successfully');
            } else {
                const errorText = await insightsResponse.text();
                console.warn(`[Pinterest] ⚠️ Insights fetch failed (${insightsResponse.status}):`, errorText);
            }
        } catch (error) {
            console.error('[Pinterest] ❌ Exception fetching insights:', error);
        }
    }

    // FINAL: Return all collected data including raw responses
    const result = {
        categories,
        demographics,
        totalFollowers,
        _rawResponses
    };

    console.log('[Pinterest] 📦 Final result captured with raw responses');

    return result;
}

