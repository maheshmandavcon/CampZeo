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

    // Ensure authorUrn is a valid URN
    if (authorUrn && !authorUrn.startsWith("urn:li:")) {
        authorUrn = `urn:li:person:${authorUrn}`;
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
    engagementRate: number;
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
            }
        });

        // Also fetch the post itself for text/media
        let postData = null;
        try {
            const postUrl = `https://api.linkedin.com/v2/posts/${encodedUrn}`;
            const postResponse = await fetch(postUrl, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                    "LinkedIn-Version": "202401",
                }
            });
            if (postResponse.ok) {
                postData = await postResponse.json();
            }
        } catch (e) {
            console.warn(`[LinkedIn] Could not fetch post metadata for ${urn}`, e);
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
                    engagementRate: 0,
                    isDeleted: true
                };
            }

            return { likes: 0, comments: 0, impressions: 0, reach: 0, engagementRate: 0, isDeleted: false };
        }

        const data = await response.json();

        const likes = data.likesSummary?.totalLikes || 0;
        const comments = data.commentsSummary?.totalComments || 0;

        // Fetch reach/impressions (statistics)
        let impressions = 0;
        let reach = 0;

        try {
            const authorUrn = postData?.author || '';
            // Check if author is person or organization
            const isOrg = authorUrn.includes(':organization:');
            let statsUrl = '';

            if (isOrg) {
                statsUrl = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?shares=List(${encodedUrn})`;
            } else {
                statsUrl = `https://api.linkedin.com/v2/memberShareStatistics?shares=List(${encodedUrn})`;
            }

            const statsResponse = await fetch(statsUrl, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                }
            });

            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                const element = statsData.elements?.[0];
                if (element) {
                    impressions = element.totalShareStatistics?.impressionCount || 0;
                    reach = element.totalShareStatistics?.uniqueImpressionsCount || impressions; // Fallback to impressions if unique is 0
                }
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
            engagementRate,
            isDeleted: false
        };

        if (postData?.commentary) {
            result.text = postData.commentary;
        }
        if (postData?.content?.multiImage?.images) {
            result.media = postData.content.multiImage.images;
        }

        return result;

    } catch (error) {
        console.error(`[LinkedIn] Error fetching insights for ${urn}:`, error);
        return {
            likes: 0,
            comments: 0,
            impressions: 0,
            reach: 0,
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
