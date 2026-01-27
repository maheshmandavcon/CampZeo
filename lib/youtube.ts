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
        console.log(`[YouTube] Sending tags to API:`, metadata?.tags || []);
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

            // Check for common permission errors
            if (error.includes('forbidden') || error.includes('permissionDenied')) {
                throw new Error(`YouTube channel does not have permission for custom thumbnails. Please ensure your channel is verified for "Advanced Features" (via phone verification) in YouTube Studio.`);
            }

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
        return null;
    }
}

export interface YouTubeVideoInsights {
    likes: number;
    comments: number;
    impressions: number;
    reach: number;
    engagement: number;
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
                engagement: 0,
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
            engagement: totalEngagements,
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

export interface YouTubeAudienceInsights {
    demographics: {
        ageGroup: Record<string, number>; // Percentage
        gender: Record<string, number>;   // Percentage
        country: Record<string, number>;  // Percentage
    };
    totalSubscribers?: number;
    _rawResponses?: any[];
}

export async function getYouTubeAudienceInsights(
    credentials: YouTubeCredentials
): Promise<YouTubeAudienceInsights> {
    const { accessToken } = credentials;

    try {
        // We want percentage of viewers by age, gender, country.
        // YouTube Analytics API
        // Note: This requires 'https://www.googleapis.com/auth/yt-analytics.readonly' scope

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

        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 90 days

        // 1. Age and Gender
        const ageGenderUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=viewerPercentage&dimensions=ageGroup,gender&sort=gender,ageGroup`;

        // 2. Country
        const countryUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views&dimensions=country&sort=-views&maxResults=10`;

        const ageGenderRes = await fetch(ageGenderUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        await capture(ageGenderRes, 'demographics_age_gender');

        const countryRes = await fetch(countryUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        await capture(countryRes, 'demographics_country');

        // Note: getYouTubeChannelInfo also makes an API call
        const channelInfo = await getYouTubeChannelInfo(accessToken);
        // We can't easily capture inside getYouTubeChannelInfo without modifying it too,
        // but for now let's focus on the main analytics calls.

        const result: YouTubeAudienceInsights = {
            demographics: { ageGroup: {}, gender: {}, country: {} },
            totalSubscribers: channelInfo ? parseInt(channelInfo.statistics?.subscriberCount || '0') : 0,
            _rawResponses
        };

        if (ageGenderRes.ok) {
            const data = await ageGenderRes.json();
            // rows: [[ageGroup, gender, viewerPercentage], ...]
            if (data.rows) {
                data.rows.forEach((row: any) => {
                    const age = row[0];
                    const gen = row[1];
                    const pct = row[2];

                    if (result.demographics.ageGroup[age]) result.demographics.ageGroup[age] += pct;
                    else result.demographics.ageGroup[age] = pct;

                    if (result.demographics.gender[gen]) result.demographics.gender[gen] += pct;
                    else result.demographics.gender[gen] = pct;
                });
            }
        } else {
            const err = await ageGenderRes.json();
            console.warn(`[YouTube] Failed to fetch age/gender analytics (Status ${ageGenderRes.status}):`, JSON.stringify(err));
        }

        if (countryRes.ok) {
            const data = await countryRes.json();
            // rows: [[country, views], ...]
            if (data.rows) {
                // Calculate total views first
                const totalViews = data.rows.reduce((acc: number, row: any) => acc + row[1], 0);

                data.rows.forEach((row: any) => {
                    const country = row[0];
                    const views = row[1];
                    // Convert to percentage
                    const pct = totalViews > 0 ? (views / totalViews) * 100 : 0;
                    result.demographics.country[country] = Number(pct.toFixed(2));
                });
            }
        } else {
            const err = await countryRes.json();
            console.warn(`[YouTube] Failed to fetch country analytics (Status ${countryRes.status}):`, JSON.stringify(err));
        }

        return result;

    } catch (error) {
        console.error('[YouTube] Error fetching audience insights:', error);
        return { demographics: { ageGroup: {}, gender: {}, country: {} } };
    }
}

export interface YouTubeAccountInsights {
    views: number;
    subscribersGained: number;
    estimatedMinutesWatched: number;
    averageViewDuration: number;
    engagement: number;
    _rawResponses?: any[];
}

export async function getYouTubeAccountInsights(
    credentials: YouTubeCredentials
): Promise<YouTubeAccountInsights> {
    const { accessToken } = credentials;
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

        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // last 28 days

        const metrics = 'views,subscribersGained,estimatedMinutesWatched,averageViewDuration,likes,comments';
        const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=${metrics}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        await capture(response, 'account_insights_28d');

        if (!response.ok) {
            const err = await response.json();
            console.warn(`[YouTube] Failed to fetch channel insights:`, JSON.stringify(err));
            return { views: 0, subscribersGained: 0, estimatedMinutesWatched: 0, averageViewDuration: 0, engagement: 0 };
        }

        const data = await response.json();
        // rows: [[views, subscribersGained, estimatedMinutesWatched, averageViewDuration, likes, comments]]
        if (data.rows && data.rows.length > 0) {
            const row = data.rows[0];
            return {
                views: row[0] || 0,
                subscribersGained: row[1] || 0,
                estimatedMinutesWatched: row[2] || 0,
                averageViewDuration: row[3] || 0,
                engagement: (row[4] || 0) + (row[5] || 0),
                _rawResponses
            };
        }

        return { views: 0, subscribersGained: 0, estimatedMinutesWatched: 0, averageViewDuration: 0, engagement: 0, _rawResponses };
    } catch (error) {
        console.error('[YouTube] Error fetching YouTube account insights:', error);
        return { views: 0, subscribersGained: 0, estimatedMinutesWatched: 0, averageViewDuration: 0, engagement: 0 };
    }
}
