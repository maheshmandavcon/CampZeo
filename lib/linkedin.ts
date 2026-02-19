import { prisma } from "@/lib/prisma";
import { Buffer } from 'buffer';

interface LinkedInCredentials {
    accessToken: string;
    authorUrn: string;
}

export async function postToLinkedIn(
    credentials: LinkedInCredentials,
    text: string,
    mediaUrls?: string | string[] | null
) {
    let { accessToken, authorUrn } = credentials;

    // Resolve authorUrn if missing or 'personal' or invalidly formatted
    if (!authorUrn || authorUrn === 'personal' || authorUrn === 'urn:li:person:personal') {
        console.log("[LinkedIn] Author URN invalid or 'personal'. Fetching profile to resolve...");
        try {
            const profileRes = await fetch("https://api.linkedin.com/v2/me", {
                headers: { 
                    "Authorization": `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0" 
                },
            });
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                authorUrn = `urn:li:person:${profileData.id}`;
                console.log(`[LinkedIn] Resolved Author URN to: ${authorUrn}`);
            } else {
                console.warn(`[LinkedIn] Failed to fetch profile: ${profileRes.status}`);
            }
        } catch (e) {
            console.error("[LinkedIn] Error resolving profile URN:", e);
        }
    }

    // Ensure authorUrn is a valid URN (fallback)
    if (authorUrn && !authorUrn.startsWith("urn:li:")) {
        authorUrn = `urn:li:person:${authorUrn}`;
    }

    if (!authorUrn) {
        throw new Error("Could not determine LinkedIn Author URN.");
    }

    // Normalize mediaUrls to array
    const mediaList = Array.isArray(mediaUrls) ? mediaUrls : (mediaUrls ? [mediaUrls] : []);

    console.log(`[LinkedIn] Posting with Author URN: ${authorUrn}, Media Count: ${mediaList.length}`);

    const commonHeaders = {
        "Authorization": `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202401",
    };

    try {
        const assets: { urn: string, isVideo: boolean }[] = [];

        // Upload all media files
        for (const mediaUrl of mediaList) {
            // Determine if image or video
            // Improved regex to handle URLs with query parameters (e.g. ?token=...)
            const isVideo = !!mediaUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i);

            // 1. Register Upload
            console.log(`[LinkedIn] Registering upload for ${mediaUrl} (Is Video: ${isVideo})...`);
            const registerResponse = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
                method: "POST",
                headers: {
                    ...commonHeaders,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    registerUploadRequest: {
                        recipes: [isVideo ? "urn:li:digitalmediaRecipe:feedshare-video" : "urn:li:digitalmediaRecipe:feedshare-image"],
                        owner: authorUrn,
                        serviceRelationships: [
                            {
                                relationshipType: "OWNER",
                                identifier: "urn:li:userGeneratedContent",
                            },
                        ],
                    },
                }),
            });

            if (!registerResponse.ok) {
                const errorText = await registerResponse.text();
                console.error(`[LinkedIn] Register Upload Failed: ${registerResponse.status} ${registerResponse.statusText}`);
                console.error(`[LinkedIn] Error Body: ${errorText}`);
                throw new Error(`Failed to register upload (${registerResponse.status}): ${errorText}`);
            }

            const registerData = await registerResponse.json();
            const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
            const assetUrn = registerData.value.asset;

            console.log(`[LinkedIn] Upload registered. Asset URN: ${assetUrn}`);

            // 2. Upload File
            // Fetch the media file from the URL (works with both Vercel Blob and local URLs)
            console.log(`[LinkedIn] Fetching media from: ${mediaUrl}`);

            // Determine the full URL
            let fetchUrl = mediaUrl;
            if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
                // Relative URL - convert to absolute
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
                fetchUrl = `${baseUrl}${mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`}`;
            }

            console.log(`[LinkedIn] Fetching from URL: ${fetchUrl}`);

            const fetchOptions: RequestInit = {};
            // If fetching from Vercel Blob and token is available, include it (User request)
            if (process.env.BLOB_READ_WRITE_TOKEN && fetchUrl.includes('vercel-storage.com')) {
                fetchOptions.headers = { 'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` };
            }

            const mediaResponse = await fetch(fetchUrl, fetchOptions);

            if (!mediaResponse.ok) {
                throw new Error(`Failed to fetch media file: ${mediaResponse.status} ${mediaResponse.statusText}`);
            }

            const fileBuffer = Buffer.from(await mediaResponse.arrayBuffer());

            console.log("[LinkedIn] Uploading file...");
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/octet-stream",
                },
                body: fileBuffer,
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error(`[LinkedIn] File Upload Failed: ${uploadResponse.status} ${uploadResponse.statusText}`, errorText);
                throw new Error(`Failed to upload file: ${errorText}`);
            }
            console.log("[LinkedIn] File uploaded successfully.");

            assets.push({ urn: assetUrn, isVideo });
        }

        // 3. Create Post
        console.log("[LinkedIn] Creating UGC post...");
        const shareBody: any = {
            author: authorUrn,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: {
                        text: text,
                    },
                    shareMediaCategory: "NONE",
                },
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
            },
        };

        if (assets.length > 0) {
            // LinkedIn API: supports single video OR multiple images, NOT mixed
            const videos = assets.filter(a => a.isVideo);
            const images = assets.filter(a => !a.isVideo);

            // Warn if mixed media is detected
            if (videos.length > 0 && images.length > 0) {
                console.warn(`[LinkedIn] Mixed video (${videos.length}) and image (${images.length}) media detected. LinkedIn supports single video OR multiple images.`);
                console.warn('[LinkedIn] Solution: Upload images as carousel OR post video separately. Proceeding with images only (dropping video).');
            }

            // Prioritize images if mixed, otherwise use video if available
            if (images.length > 0) {
                shareBody.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "IMAGE";
                shareBody.specificContent["com.linkedin.ugc.ShareContent"].media = images.map(asset => ({
                    status: "READY",
                    description: { text: "Image content" },
                    media: asset.urn,
                    title: { text: "Image content" },
                }));
                console.log(`[LinkedIn] Posting ${images.length} image(s)`);
            } else if (videos.length > 0) {
                // Only take the first video if no images
                shareBody.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "VIDEO";
                const videoAsset = videos[0];
                shareBody.specificContent["com.linkedin.ugc.ShareContent"].media = [
                    {
                        status: "READY",
                        description: { text: "Video content" },
                        media: videoAsset.urn,
                        title: { text: "Video content" },
                    }
                ];
                console.log(`[LinkedIn] Posting 1 video`);

                // Log if there are multiple videos
                if (videos.length > 1) {
                    console.warn(`[LinkedIn] Multiple videos provided (${videos.length}), but only 1 video can be posted. Posting first video only.`);
                }
            }
        }

        const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
            method: "POST",
            headers: {
                ...commonHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(shareBody),
        });

        if (!postResponse.ok) {
            const errorText = await postResponse.text();
            console.error(`[LinkedIn] Create Post Failed: ${postResponse.status} ${postResponse.statusText}`, errorText);
            throw new Error(`Failed to create post: ${errorText}`);
        }

        const postData = await postResponse.json();
        console.log("[LinkedIn] Post created successfully:", postData.id);
        return postData;

    } catch (error) {
        console.error("LinkedIn posting error:", error);
        throw error;
    }
}

export interface LinkedInPostInsights {
    likes: number;
    comments: number;
    impressions: number;
    reach: number;
    engagement: number;
    engagementRate: number;
    shares?: number;
    isDeleted?: boolean;
    text?: string;
    media?: any[];
}

export async function getLinkedInPostInsights(
    urn: string,
    accessToken: string
): Promise<LinkedInPostInsights> {
    try {
        // LinkedIn URN format: urn:li:share:123 or urn:li:ugcPost:123
        // Social Actions API supports both.

        const encodedUrn = encodeURIComponent(urn);
        const url = `https://api.linkedin.com/v2/socialActions/${encodedUrn}`;

        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "X-Restli-Protocol-Version": "2.0.0",
                "LinkedIn-Version": "202401",
            }
        });

        // Also fetch the post itself for text/media
        let postData = null;
        const endpoints = [
            `https://api.linkedin.com/v2/posts/${encodedUrn}`,
            `https://api.linkedin.com/v2/ugcPosts/${encodedUrn}`
        ];

        for (const endpoint of endpoints) {
            try {
                const postResponse = await fetch(endpoint, {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "X-Restli-Protocol-Version": "2.0.0",
                        "LinkedIn-Version": "202401",
                    }
                });
                if (postResponse.ok) {
                    postData = await postResponse.json();
                    console.log(`[LinkedIn] Post Metadata from ${endpoint}:`, JSON.stringify(postData, null, 2));
                    break;
                }
            } catch (e) {
                console.warn(`[LinkedIn] Could not fetch from ${endpoint}`, e);
            }
        }

        if (!response.ok) {
            // If the post is old or not found, it might 404.
            console.warn(`[LinkedIn] Failed to fetch social actions for ${urn}: ${response.status}`);

            if (response.status === 404) {
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

            return { likes: 0, comments: 0, impressions: 0, reach: 0, engagement: 0, engagementRate: 0, isDeleted: false };
        }

        const data = await response.json();
        console.log(`[LinkedIn] Social Actions Response for ${urn}:`, JSON.stringify(data, null, 2));

        let likes = data.likesSummary?.totalLikes || data.likesSummary?.aggregatedTotalLikes || 0;
        let comments = data.commentsSummary?.totalComments || data.commentsSummary?.aggregatedTotalComments || data.commentsSummary?.totalFirstLevelComments || 0;

        // Fallback: If comments are 0, try activity URN if this is a share/ugcPost
        if (comments === 0 && (urn.includes(':share:') || urn.includes(':ugcPost:'))) {
            const activityUrn = urn.replace(':share:', ':activity:').replace(':ugcPost:', ':activity:');
            console.log(`[LinkedIn] Comments are 0, trying with activity URN: ${activityUrn}`);
            try {
                const altResponse = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(activityUrn)}`, {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "X-Restli-Protocol-Version": "2.0.0",
                        "LinkedIn-Version": "202401",
                    }
                });
                if (altResponse.ok) {
                    const altData = await altResponse.json();
                    console.log(`[LinkedIn] Alt Social Actions Response:`, JSON.stringify(altData, null, 2));
                    likes = altData.likesSummary?.totalLikes || altData.likesSummary?.aggregatedTotalLikes || likes;
                    comments = altData.commentsSummary?.totalComments || altData.commentsSummary?.aggregatedTotalComments || altData.commentsSummary?.totalFirstLevelComments || comments;
                }
            } catch (e) {
                console.warn(`[LinkedIn] Failed to fetch alt social actions`, e);
            }
        }

        console.log(`[LinkedIn] Final Parsed - Likes: ${likes}, Comments: ${comments}`);

        // Fetch reach/impressions (statistics)
        let impressions = 0;
        let reach = 0;
        let shares = 0;

        try {
            const authorUrn = postData?.author || '';
            const isOrg = authorUrn.includes(':organization:');
            let statsUrl = '';

            if (isOrg) {
                statsUrl = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?shares=List(${encodedUrn})`;
            } else {
                statsUrl = `https://api.linkedin.com/v2/memberShareStatistics?shares=List(${encodedUrn})`;
            }

            console.log(`[LinkedIn] Fetching stats from: ${statsUrl}`);
            const statsResponse = await fetch(statsUrl, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                    "LinkedIn-Version": "202401",
                }
            });

            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                console.log(`[LinkedIn] Stats Data for ${urn}:`, JSON.stringify(statsData, null, 2));
                const element = statsData.elements?.[0];
                if (element) {
                    impressions = element.totalShareStatistics?.impressionCount || 0;
                    reach = element.totalShareStatistics?.uniqueImpressionsCount || impressions;
                    shares = element.totalShareStatistics?.shareCount || 0;
                } else {
                    console.log(`[LinkedIn] No stats elements found in response for ${urn}`);
                }
            } else {
                const errText = await statsResponse.text();
                console.warn(`[LinkedIn] Stats API failed for ${urn}: ${statsResponse.status} ${statsResponse.statusText}`, errText);
            }
        } catch (e) {
            console.warn(`[LinkedIn] Could not fetch statistics for ${urn}`, e);
        }

        // Engagement rate
        const totalEngagements = likes + comments;
        const base = reach > 0 ? reach : impressions;
        const engagementRate = base > 0 ? (totalEngagements / base) * 100 : 0;

        const result: LinkedInPostInsights = {
            likes,
            comments,
            impressions,
            reach,
            shares,
            engagement: totalEngagements,
            engagementRate,
            isDeleted: false
        };

        if (postData?.commentary) {
            result.text = postData.commentary;
        }

        // Extract media URNs
        let mediaUrns: string[] = [];
        if (postData?.content?.multiImage?.images) {
            mediaUrns = postData.content.multiImage.images.map((img: any) => img.media || img.id).filter(Boolean);
        } else if (postData?.content?.media) {
            mediaUrns = postData.content.media.map((m: any) => m.media || m.id).filter(Boolean);
        } else if (postData?.specificContent?.['com.linkedin.ugc.ShareContent']?.media) {
            mediaUrns = postData.specificContent['com.linkedin.ugc.ShareContent'].media.map((m: any) => m.media).filter(Boolean);
        }

        // Resolve URNs to actual CDN URLs
        if (mediaUrns.length > 0) {
            console.log(`[LinkedIn] Resolving ${mediaUrns.length} media asset(s) for ${urn}`);
            try {
                const resolvedMedia = await Promise.all(mediaUrns.map(async (assetUrn) => {
                    if (!assetUrn.startsWith('urn:li:digitalmediaAsset:')) return { url: assetUrn };

                    const assetUrl = `https://api.linkedin.com/v2/assets/${encodeURIComponent(assetUrn)}`;
                    const assetRes = await fetch(assetUrl, {
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "X-Restli-Protocol-Version": "2.0.0",
                            "LinkedIn-Version": "202401",
                        }
                    });

                    if (assetRes.ok) {
                        const assetData = await assetRes.json();
                        const mediaAsset = assetData?.['com.linkedin.digitalmedia.asset.DigitalMediaAsset'] || assetData?.['digitalmediaAsset'] || assetData;
                        const thumbnails = mediaAsset?.thumbnails || [];
                        // Get the highest resolution thumbnail (usually the last or biggest)
                        if (thumbnails.length > 0) {
                            return { url: thumbnails[thumbnails.length - 1].url, originalUrn: assetUrn };
                        }
                    }
                    return { originalUrn: assetUrn };
                }));
                result.media = resolvedMedia.filter(m => m.url).map(m => m.url);
                console.log(`[LinkedIn] Resolved media URLs:`, result.media);
            } catch (e) {
                console.warn(`[LinkedIn] Failed to resolve assets for ${urn}:`, e);
            }
        }

        return result;

    } catch (error) {
        console.error(`[LinkedIn] Error fetching insights for ${urn}:`, error);
        return {
            likes: 0,
            comments: 0,
            impressions: 0,
            reach: 0,
            engagement: 0,
            engagementRate: 0,
            isDeleted: false
        };
    }
}

export interface LinkedInPost {
    id: string;
    text: string;
    createdAt: string;
    media?: any[];
}

export async function getLinkedInUserPosts(
    credentials: LinkedInCredentials,
    limit: number = 20
): Promise<LinkedInPost[]> {
    const { accessToken, authorUrn } = credentials;
    let urn = authorUrn;
    if (urn && !urn.startsWith("urn:li:")) {
        urn = `urn:li:person:${urn}`;
    }

    try {
        // LinkedIn uses 'posts' or 'ugcPosts' endpoint. v2/posts is newer.
        const response = await fetch(
            `https://api.linkedin.com/v2/posts?author=${encodeURIComponent(urn)}&count=${limit}`,
            {
                method: 'GET',
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                    "LinkedIn-Version": "202401",
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch LinkedIn posts: ${errorText}`);
        }

        const data = await response.json();
        return data.elements?.map((el: any) => ({
            id: el.id,
            text: el.commentary || '',
            createdAt: el.createdAt || new Date().toISOString(),
            media: el.content?.multiImage?.images || []
        })) || [];
    } catch (error) {
        console.error('LinkedIn fetch posts error:', error);
        throw error;
    }
}

export interface LinkedInAudienceInsights {
    followerCounts: {
        organic: number;
        paid: number;
        total: number;
    };
    followerGeography: Record<string, number>;
    followerIndustry: Record<string, number>;
    followerSeniority: Record<string, number>;
    followerFunction: Record<string, number>;
    _rawResponses?: any[];
}

export async function getLinkedInAudienceInsights(
    credentials: LinkedInCredentials
): Promise<LinkedInAudienceInsights> {
    const { accessToken, authorUrn } = credentials;

    // Verify it is an organization
    if (!authorUrn || !authorUrn.includes('organization')) {
        console.log('[LinkedIn] Fetching basic network metrics for personal profile:', authorUrn);
        try {
            // For personal profiles, we can try to get network sizes (followers)
            // v2/networkSizes/urn:li:person:{id}?edgeType=COMPANY_FOLLOWED_BY_MEMBER is for pages
            // For personal connections/followers: v2/networkSizes/urn:li:person:{id} 
            const response = await fetch(
                `https://api.linkedin.com/v2/networkSizes/${encodeURIComponent(authorUrn)}`,
                {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "X-Restli-Protocol-Version": "2.0.0",
                        "LinkedIn-Version": "202401",
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                const total = data.firstDegreeSize || 0; // Connections/Followers
                return {
                    followerCounts: { organic: total, paid: 0, total: total },
                    followerGeography: {},
                    followerIndustry: {},
                    followerSeniority: {},
                    followerFunction: {}
                };
            }
        } catch (e) {
            console.error('[LinkedIn] Failed to fetch personal network size:', e);
        }

        return {
            followerCounts: { organic: 0, paid: 0, total: 0 },
            followerGeography: {},
            followerIndustry: {},
            followerSeniority: {},
            followerFunction: {}
        };
    }

    // Extract ID if needed, but we can pass urn directly if format is correct
    // q=organizationalEntity&organizationalEntity={urn}

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

        const response = await fetch(
            `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(authorUrn)}`,
            {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                    "LinkedIn-Version": "202401",
                }
            }
        );
        await capture(response, 'follower_stats');

        if (!response.ok) {
            // 403 means permission denied (needs rw_organization_admin or similar)
            // 404 means not found
            const errorText = await response.text();
            console.warn(`[LinkedIn] Failed to fetch follower stats: ${response.status} - ${errorText}`);
            return {
                followerCounts: { organic: 0, paid: 0, total: 0 },
                followerGeography: {},
                followerIndustry: {},
                followerSeniority: {},
                followerFunction: {}
            };
        }

        const data = await response.json();
        const element = data.elements?.[0]; // Usually returns one aggregated object for the queried entity

        if (element) {
            const organic = element.followerCountsByAssociationType?.organicFollowerCount || 0;
            const paid = element.followerCountsByAssociationType?.paidFollowerCount || 0;

            // 2. Fetch Demographic Statistics using versioned API
            let followerGeography: Record<string, number> = {};
            let followerIndustry: Record<string, number> = {};
            let followerSeniority: Record<string, number> = {};
            let followerFunction: Record<string, number> = {};

            // Map demographic types to their API enum values
            const demographicTypes = [
                { type: 'GEOGRAPHIC_AREA', label: 'follower_geography', target: followerGeography, fieldName: 'geographicArea' },
                { type: 'INDUSTRY', label: 'follower_industry', target: followerIndustry, fieldName: 'industry' },
                { type: 'SENIORITY', label: 'follower_seniority', target: followerSeniority, fieldName: 'seniority' },
                { type: 'FUNCTION', label: 'follower_function', target: followerFunction, fieldName: 'function' }
            ];

            for (const demo of demographicTypes) {
                try {
                    const dimResponse = await fetch(
                        `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=followerDemographics&organizationalEntity=${encodeURIComponent(authorUrn)}&followerDemographicType=${demo.type}`,
                        {
                            headers: {
                                "Authorization": `Bearer ${accessToken}`,
                                "X-Restli-Protocol-Version": "2.0.0",
                                "LinkedIn-Version": "202401",
                            }
                        }
                    );
                    await capture(dimResponse, demo.label);

                    if (dimResponse.ok) {
                        const dimData = await dimResponse.json();
                        if (dimData.elements) {
                            dimData.elements.forEach((el: any) => {
                                // The field name matches the demographic type (e.g., geographicArea, industry, etc.)
                                const urn = el[demo.fieldName];
                                if (urn) {
                                    const code = urn.split(':').pop() || 'Unknown';
                                    const count = el.followerCountsByAssociationType?.organicFollowerCount || 0;
                                    demo.target[code] = (demo.target[code] || 0) + count;
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`[LinkedIn] ${demo.label} fetch failed:`, err);
                }
            }

            return {
                followerCounts: {
                    organic,
                    paid,
                    total: organic + paid
                },
                followerGeography,
                followerIndustry,
                followerSeniority,
                followerFunction,
                _rawResponses
            };
        }

        return {
            followerCounts: { organic: 0, paid: 0, total: 0 },
            followerGeography: {},
            followerIndustry: {},
            followerSeniority: {},
            followerFunction: {},
            _rawResponses
        };

    } catch (error) {
        console.error('[LinkedIn] Error fetching audience insights:', error);
        return {
            followerCounts: { organic: 0, paid: 0, total: 0 },
            followerGeography: {},
            followerIndustry: {},
            followerSeniority: {},
            followerFunction: {}
        };
    }
}
/**
 * Refresh LinkedIn access token using refresh token
 */
export async function refreshLinkedInToken(refreshToken: string, clientId: string, clientSecret: string) {
    const tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to refresh LinkedIn token: ${error}`);
    }

    const data: any = await response.json();
    return data; // Returns { access_token, refresh_token (optional), expires_in, scope, token_type }
}
/**
 * Get all LinkedIn organizations where the user is an administrator
 */
export async function getLinkedInUserOrganizations(accessToken: string): Promise<{ id: string, name: string }[]> {
    try {
        const response = await fetch("https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "X-Restli-Protocol-Version": "2.0.0",
                "LinkedIn-Version": "202401",
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[LinkedIn] Failed to fetch organizations: ${response.status}`, errorText);
            return [];
        }

        const data = await response.json();
        const organizations: { id: string, name: string }[] = [];

        if (data.elements && data.elements.length > 0) {
            for (const element of data.elements) {
                const orgUrn = element.organizationalTarget;
                const orgId = orgUrn.split(":").pop();

                // Get org details
                try {
                    const orgRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, {
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "X-Restli-Protocol-Version": "2.0.0",
                            "LinkedIn-Version": "202401",
                        }
                    });
                    if (orgRes.ok) {
                        const orgData = await orgRes.json();
                        organizations.push({
                            id: orgUrn,
                            name: orgData.localizedName
                        });
                    }
                } catch (e) {
                    console.warn(`[LinkedIn] Failed to fetch details for org ${orgId}`, e);
                }
            }
        }
        return organizations;
    } catch (error) {
        console.error("[LinkedIn] Error in getLinkedInUserOrganizations:", error);
        return [];
    }
}
