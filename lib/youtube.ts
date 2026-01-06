interface YouTubeCredentials {
    accessToken: string;
    refreshToken?: string;
}

interface YouTubeMetadata {
    tags?: string[];
    privacy?: 'public' | 'private' | 'unlisted';
    isShort?: boolean; // For YouTube Shorts
    thumbnailUrl?: string; // Custom thumbnail URL
}

// Refresh YouTube access token using refresh token
export async function refreshYouTubeToken(refreshToken: string, clientId: string, clientSecret: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to refresh YouTube token: ${error}`);
    }

    const data: any = await response.json();
    return data; // Returns { access_token, refresh_token (optional), expires_in, scope, token_type }
}

// Upload video to YouTube using resumable upload
export async function postToYouTube(
    credentials: YouTubeCredentials,
    title: string,
    description: string,
    videoUrl: string,
    metadata?: YouTubeMetadata
) {
    const { accessToken } = credentials;

    const isShort = metadata?.isShort || false;
    console.log(`[YouTube] Starting video upload: ${title}, Is Short: ${isShort}`);

    try {
        // Step 1: Fetch the video file from URL (works with Vercel Blob)
        console.log(`[YouTube] Fetching video from: ${videoUrl}`);

        // Determine the full URL
        let fetchUrl = videoUrl;
        if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
            // Relative URL - convert to absolute
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
            fetchUrl = `${baseUrl}${videoUrl.startsWith('/') ? videoUrl : `/${videoUrl}`}`;
        }

        console.log(`[YouTube] Fetching from URL: ${fetchUrl}`);
        const videoResponse = await fetch(fetchUrl);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video file: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        const videoSize = videoBuffer.length;

        console.log(`[YouTube] Video size: ${videoSize} bytes`);

        // Step 2: Initialize resumable upload session
        const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Length': videoSize.toString(),
                'X-Upload-Content-Type': 'video/*',
            },
            body: JSON.stringify({
                snippet: {
                    title,
                    description,
                    tags: metadata?.tags || [],
                    categoryId: '22', // People & Blogs
                },
                status: {
                    privacyStatus: metadata?.privacy || 'public',
                    selfDeclaredMadeForKids: false,
                    madeForKids: false,
                },
            }),
        });

        if (!initResponse.ok) {
            const error = await initResponse.text();
            console.error('[YouTube] Init upload error:', error);

            // Check if it's an authentication error
            if (initResponse.status === 401) {
                throw new Error('YouTube access token expired. Please reconnect your YouTube account in Settings.');
            }

            throw new Error(`YouTube init upload failed: ${error}`);
        }

        // Get the upload URL from Location header
        const uploadUrl = initResponse.headers.get('location');
        if (!uploadUrl) {
            throw new Error('No upload URL received from YouTube');
        }

        console.log(`[YouTube] Upload session created, uploading video...`);

        // Step 3: Upload the video file
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Length': videoSize.toString(),
                'Content-Type': 'video/*',
            },
            body: videoBuffer,
        });

        if (!uploadResponse.ok) {
            const error = await uploadResponse.text();
            console.error('[YouTube] Video upload error:', error);
            throw new Error(`YouTube video upload failed: ${error}`);
        }

        const videoData: any = await uploadResponse.json();
        const videoId = videoData.id;
        console.log(`[YouTube] Video uploaded successfully: ${videoId}`);

        // Step 4: Upload custom thumbnail if provided
        if (metadata?.thumbnailUrl) {
            console.log(`[YouTube] Uploading custom thumbnail: ${metadata.thumbnailUrl}`);
            try {
                await uploadYouTubeThumbnail(accessToken, videoId, metadata.thumbnailUrl);
                console.log(`[YouTube] Thumbnail uploaded successfully`);
            } catch (thumbErr) {
                console.warn(`[YouTube] Thumbnail upload failed (non-blocking):`, thumbErr);
                // Don't fail the entire upload if thumbnail fails
            }
        }

        // Note: YouTube automatically detects Shorts based on:
        // - Aspect ratio (9:16 vertical)
        // - Duration (< 60 seconds)
        // We don't need to manually tag it
        if (isShort) {
            console.log(`[YouTube] Video marked as Short (auto-detected by YouTube based on format)`);
        }

        return { id: videoId, isShort };

    } catch (error) {
        console.error('YouTube video upload error:', error);
        throw error;
    }
}

// Upload custom thumbnail for YouTube video
async function uploadYouTubeThumbnail(
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

        const arrayBuffer = await thumbnailResponse.arrayBuffer();
        const thumbnailBuffer = Buffer.from(arrayBuffer);
        const thumbnailSize = thumbnailBuffer.length;

        console.log(`[YouTube] Thumbnail size: ${thumbnailSize} bytes`);

        // YouTube thumbnail limit is 2MB
        if (thumbnailSize > 2 * 1024 * 1024) {
            console.warn(`[YouTube] Thumbnail is too large (${(thumbnailSize / 1024 / 1024).toFixed(2)}MB). Max 2MB allowed.`);
            // Potentially we could resize here if we had a library, but for now just warn
            throw new Error(`Thumbnail too large (>2MB). Please upload a smaller image.`);
        }

        // Determine image type from URL or content-type
        const contentType = thumbnailResponse.headers.get('content-type') || 'image/jpeg';

        // Upload thumbnail using media upload
        const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': contentType,
                'Content-Length': thumbnailSize.toString()
            },
            body: thumbnailBuffer,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Thumbnail upload failed: ${error}`);
        }

        console.log(`[YouTube] Thumbnail set for video ${videoId}`);
    } catch (error) {
        console.error('YouTube thumbnail upload error:', error);
        throw error;
    }
}

// Create a YouTube Community Post (text + optional image)
export async function postYouTubeCommunity(
    credentials: YouTubeCredentials,
    text: string,
    imageUrl?: string
) {
    const { accessToken } = credentials;

    console.log(`[YouTube] Creating community post`);

    try {
        const postData: any = {
            snippet: {
                textMessageDetails: {
                    messageText: text,
                },
            },
        };

        // Add image if provided
        if (imageUrl) {
            postData.snippet.imageDetails = {
                url: imageUrl,
            };
        }

        const response = await fetch('https://www.googleapis.com/youtube/v3/communityPosts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[YouTube] Community post error:', error);

            // Check if it's an authentication error
            if (response.status === 401) {
                throw new Error('YouTube access token expired. Please reconnect your YouTube account in Settings.');
            }

            throw new Error(`YouTube Community Post error: ${JSON.stringify(error)}`);
        }

        const data: any = await response.json();
        console.log(`[YouTube] Community post created: ${data.id}`);

        return { id: data.id };

    } catch (error) {
        console.error('YouTube community post error:', error);
        throw error;
    }
}

// Create a YouTube Playlist
export async function createYouTubePlaylist(
    credentials: YouTubeCredentials,
    title: string,
    description: string,
    privacy: 'public' | 'private' | 'unlisted' = 'public'
) {
    const { accessToken } = credentials;

    console.log(`[YouTube] Creating playlist: ${title}`);

    try {
        const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                snippet: {
                    title,
                    description,
                    defaultLanguage: 'en',
                },
                status: {
                    privacyStatus: privacy,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[YouTube] Playlist creation error:', error);

            if (response.status === 401) {
                throw new Error('YouTube access token expired. Please reconnect your YouTube account in Settings.');
            }

            throw new Error(`YouTube playlist creation failed: ${JSON.stringify(error)}`);
        }

        const data: any = await response.json();
        console.log(`[YouTube] Playlist created successfully: ${data.id}`);
        return { id: data.id, title: data.snippet.title };

    } catch (error) {
        console.error('YouTube playlist creation error:', error);
        throw error;
    }
}

// Get YouTube Playlists
export async function getYouTubePlaylists(accessToken: string) {
    try {
        const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 401) {
                throw new Error('YouTube access token expired. Please reconnect your YouTube account.');
            }
            throw new Error(`YouTube API error: ${JSON.stringify(error)}`);
        }

        const data: any = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('YouTube playlists fetch error:', error);
        throw error;
    }
}

// Add video to YouTube Playlist
export async function addVideoToPlaylist(
    credentials: YouTubeCredentials,
    playlistId: string,
    videoId: string,
    position?: number,
    metadata?: YouTubeMetadata
) {
    const { accessToken } = credentials;

    const isShort = metadata?.isShort || false;
    console.log(`[YouTube] Adding video ${videoId} to playlist ${playlistId}, Is Short: ${isShort}`);

    try {
        const response = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                snippet: {
                    playlistId,
                    resourceId: {
                        kind: 'youtube#video',
                        videoId,
                    },
                    ...(position !== undefined && { position }),
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[YouTube] Failed to add video to playlist:', error);
            throw new Error(`Failed to add video to playlist: ${JSON.stringify(error)}`);
        }

        const data: any = await response.json();
        console.log(`[YouTube] Video added to playlist successfully`);

        // YouTube automatically detects shorts based on video format
        if (isShort) {
            console.log(`[YouTube] Short video added to playlist (auto-detected by YouTube based on format)`);
        }

        // If thumbnail URL provided, update thumbnail
        if (metadata?.thumbnailUrl) {
            try {
                await uploadYouTubeThumbnail(accessToken, videoId, metadata.thumbnailUrl);
                console.log(`[YouTube] Thumbnail updated for video in playlist`);
            } catch (err) {
                console.warn(`[YouTube] Failed to update thumbnail (non-blocking):`, err);
            }
        }

        return { id: data.id, isShort };

    } catch (error) {
        console.error('YouTube add to playlist error:', error);
        throw error;
    }
}

// Get YouTube channel info
export async function getYouTubeChannelInfo(accessToken: string) {
    try {
        const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();

            if (response.status === 401) {
                throw new Error('YouTube access token expired. Please reconnect your YouTube account.');
            }

            throw new Error(`YouTube API error: ${JSON.stringify(error)}`);
        }

        const data: any = await response.json();
        return data.items?.[0] || null;

    } catch (error) {
        console.error('YouTube channel info error:', error);
        throw error;
    }
}

export interface YouTubeVideoInsights {
    likes: number;
    comments: number;
    impressions: number;
    reach: number;
    engagementRate: number;
    views: number;
    isDeleted?: boolean;
    title?: string;
    description?: string;
    thumbnails?: any;
}

export async function getYouTubeVideoInsights(
    videoId: string,
    accessToken: string
): Promise<YouTubeVideoInsights> {
    try {
        const part = 'statistics,snippet';
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=${part}&id=${videoId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            // 404 is rare for List endpoint, usually returns empty items
            throw new Error(`Failed to fetch video details: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const item = data.items?.[0];

        if (!item) {
            // If items array is empty, video is deleted or private/not accessible
            return {
                likes: 0,
                comments: 0,
                impressions: 0,
                reach: 0,
                engagementRate: 0,
                views: 0,
                isDeleted: true
            };
        }

        const stats = item.statistics;
        const likes = parseInt(stats.likeCount || '0');
        const comments = parseInt(stats.commentCount || '0');
        const views = parseInt(stats.viewCount || '0');

        // YouTube API doesn't provide reach/impressions via the public Data API for individual videos easily.
        // It requires YouTube Analytics API which is much more complex and requires meaningful reporting.
        // We will map 'views' to 'impressions' for now as a proxy.
        const impressions = views;
        const reach = views; // Proxy

        // Engagement rate
        const totalEngagements = likes + comments;
        const engagementRate = views > 0 ? (totalEngagements / views) * 100 : 0;

        return {
            likes,
            comments,
            impressions,
            reach,
            engagementRate,
            views,
            isDeleted: false,
            title: item.snippet?.title,
            description: item.snippet?.description,
            thumbnails: item.snippet?.thumbnails
        };

    } catch (error) {
        console.error(`[YouTube] Error fetching insights for ${videoId}:`, error);
        throw error;
    }
}

export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: any;
}

export async function getYouTubeChannelVideos(
    accessToken: string,
    limit: number = 20
): Promise<YouTubeVideo[]> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&mine=true&type=video&maxResults=${limit}&order=date`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                }
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch YouTube videos: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.items?.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails
        })) || [];
    } catch (error) {
        console.error('YouTube fetch videos error:', error);
        throw error;
    }
}
