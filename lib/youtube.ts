import { getSocialMediaUrl } from '@/lib/media-utils';

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

        // Determine the full URL using proper media routing
        const fetchUrl = getSocialMediaUrl(videoUrl);

        console.log(`[YouTube] Fetching from URL: ${fetchUrl}`);
        const videoResponse = await fetch(fetchUrl);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video file: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        const contentLengthHeader = videoResponse.headers.get('content-length');
        if (!contentLengthHeader) {
            console.warn('[YouTube] Warning: Missing content-length header, falling back to buffering');
        }
        const videoSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
        
        let videoBuffer: Buffer | null = null;
        if (!videoSize) {
           videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        }

        const actualVideoSize = videoSize || (videoBuffer ? videoBuffer.length : 0);
        console.log(`[YouTube] Video size: ${actualVideoSize} bytes`);

        // Step 2: Initialize resumable upload session
        console.log(`[YouTube] Sending tags to API:`, metadata?.tags || []);
        
        const initHeaders: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'video/*',
        };
        if (actualVideoSize > 0) {
            initHeaders['X-Upload-Content-Length'] = actualVideoSize.toString();
        }

        const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
            method: 'POST',
            headers: initHeaders,
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

        console.log(`[YouTube] Upload session created, uploading video in chunks...`);

        // Step 3: Upload the video file (chunked stream)
        let videoId: string;
        
        if (videoBuffer) {
            // Fallback for when content-length was missing
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Length': actualVideoSize.toString(),
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
            videoId = videoData.id;
        } else {
            if (!videoResponse.body) {
                throw new Error('Response body is null');
            }
            
            let buffer = Buffer.alloc(0);
            let uploadedBytes = 0;
            let finalVideoData: any = null;
            
            const uploadChunk = async (chunk: Buffer, start: number) => {
                const end = start + chunk.length - 1;
                console.log(`[YouTube] Uploading chunk: bytes ${start}-${end}/${actualVideoSize}`);
                const res = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Length': chunk.length.toString(),
                        'Content-Range': `bytes ${start}-${end}/${actualVideoSize}`,
                        'Content-Type': 'video/*',
                    },
                    body: chunk,
                });
                
                if (res.status === 308) {
                    return null; // Incomplete, expected
                }
                if (!res.ok && res.status !== 200 && res.status !== 201) {
                    const err = await res.text();
                    throw new Error(`Chunk upload failed with status ${res.status}: ${err}`);
                }
                return await res.json();
            };

            const reader = videoResponse.body.getReader();
            const chunkSize = 50 * 1024 * 1024; // 50MB chunks (YouTube requires multiple of 256KB)
            
            while (true) {
                const { done, value } = await reader.read();
                if (value) {
                    buffer = Buffer.concat([buffer, Buffer.from(value)]);
                }
                
                // Only upload a chunk if it's not the last one, and ensures multiple of 256KB
                while (buffer.length >= chunkSize && !done) {
                    const chunk = buffer.subarray(0, chunkSize);
                    buffer = buffer.subarray(chunkSize);
                    const data = await uploadChunk(chunk, uploadedBytes);
                    if (data) finalVideoData = data;
                    uploadedBytes += chunkSize;
                }
                
                if (done) {
                    if (buffer.length > 0) {
                        const data = await uploadChunk(buffer, uploadedBytes);
                        if (data) finalVideoData = data;
                    }
                    break;
                }
            }
            
            if (!finalVideoData || !finalVideoData.id) {
                throw new Error("Upload completed but didn't receive video ID from YouTube API");
            }
            videoId = finalVideoData.id;
        }

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
    estimatedMinutesWatched: number;
    averageViewDuration: number;
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
            throw new Error(`Failed to fetch video details: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const item = data.items?.[0];

        if (!item) {
            return {
                likes: 0,
                comments: 0,
                impressions: 0,
                reach: 0,
                engagement: 0,
                engagementRate: 0,
                views: 0,
                estimatedMinutesWatched: 0,
                averageViewDuration: 0,
                isDeleted: true
            };
        }

        const stats = item.statistics;
        const likes = parseInt(stats.likeCount || '0');
        const comments = parseInt(stats.commentCount || '0');
        const views = parseInt(stats.viewCount || '0');

        // Fetch Analytics Data (Watch Time, Average Duration)
        let estimatedMinutesWatched = 0;
        let averageViewDuration = 0;

        try {
            // Analytics API requires a date range. We'll use a broad range (lifetime proxy)
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = '2005-01-01'; // Beginning of YouTube

            const analyticsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=estimatedMinutesWatched,averageViewDuration&dimensions=video&filters=video==${videoId}`;
            const analyticsRes = await fetch(analyticsUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (analyticsRes.ok) {
                const analyticsData = await analyticsRes.json();
                if (analyticsData.rows && analyticsData.rows.length > 0) {
                    estimatedMinutesWatched = analyticsData.rows[0][1] || 0;
                    averageViewDuration = analyticsData.rows[0][2] || 0;
                }
            }
        } catch (e) {
            console.warn(`[YouTube] Analytics fetch failed for video ${videoId}:`, e);
        }

        const impressions = views;
        const reach = views;

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
            estimatedMinutesWatched,
            averageViewDuration,
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

/**
 * Fetch traffic sources for a video
 */
export async function getYouTubeTrafficSources(
    videoId: string,
    accessToken: string
) {
    try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 30 days

        const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views&dimensions=insightTrafficSourceType&filters=video==${videoId}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const error = await response.json();
            console.warn(`[YouTube] Traffic sources fetch failed:`, error);
            return [];
        }

        const data = await response.json();
        return data.rows || [];
    } catch (error) {
        console.error(`[YouTube] Traffic sources error:`, error);
        return [];
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
        city: Record<string, number>;     // Percentage
    };
    totalSubscribers: number;
    _rawResponses?: any[];
}

export async function getYouTubeAudienceInsights(
    credentials: YouTubeCredentials
): Promise<YouTubeAudienceInsights> {
    const { accessToken } = credentials;

    // Default result
    const result: YouTubeAudienceInsights = {
        demographics: { ageGroup: {}, gender: {}, country: {}, city: {} },
        totalSubscribers: 0,
        _rawResponses: []
    };

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
        result._rawResponses = _rawResponses;

        const channelInfo = await getYouTubeChannelInfo(accessToken);
        result.totalSubscribers = channelInfo ? parseInt(channelInfo.statistics?.subscriberCount || '0') : 0;

        const endDate = new Date().toISOString().split('T')[0];
        const startDate28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const startDate90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // fallback range

        // Helper to fetch report with fallback
        const fetchReport = async (label: string, urlFunc: (start: string) => string) => {
            let res = await fetch(urlFunc(startDate28), { headers: { 'Authorization': `Bearer ${accessToken}` } });
            await capture(res, label);
            let data = res.ok ? await res.json() : null;

            // If no data in 28 days, try 90 days
            if (res.ok && (!data.rows || data.rows.length === 0)) {
                console.log(`[YouTube] No data for ${label} in 28d, trying 90d...`);
                res = await fetch(urlFunc(startDate90), { headers: { 'Authorization': `Bearer ${accessToken}` } });
                await capture(res, `${label}_90d`);
                if (res.ok) data = await res.json();
            }
            return { ok: res.ok, status: res.status, data };
        };

        try {
            // 1. Age and Gender
            const { ok, status, data } = await fetchReport('demographics_age_gender', (start) =>
                `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${endDate}&metrics=viewerPercentage&dimensions=ageGroup,gender&sort=ageGroup,gender`
            );

            if (ok && data?.rows) {
                data.rows.forEach((row: any) => {
                    const age = row[0] || 'Unknown';
                    const gen = row[1] ? row[1].toLowerCase() : 'unknown';
                    const pct = row[2] || 0;

                    if (result.demographics.ageGroup[age]) result.demographics.ageGroup[age] += pct;
                    else result.demographics.ageGroup[age] = pct;

                    if (result.demographics.gender[gen]) result.demographics.gender[gen] += pct;
                    else result.demographics.gender[gen] = pct;
                });
            } else if (!ok) {
                console.warn(`[YouTube] Age/Gender analytics fetch failed (${status})`);
            }
        } catch (e) {
            console.warn('[YouTube] Error fetching Age/Gender:', e);
        }

        try {
            // 2. Country
            const { ok, status, data } = await fetchReport('demographics_country', (start) =>
                `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${endDate}&metrics=views&dimensions=country&sort=-views&maxResults=10`
            );

            if (ok && data?.rows) {
                const totalViews = data.rows.reduce((acc: number, row: any) => acc + (row[1] || 0), 0);
                data.rows.forEach((row: any) => {
                    const country = row[0] || 'Unknown';
                    const views = row[1] || 0;
                    const pct = totalViews > 0 ? (views / totalViews) * 100 : 0;
                    result.demographics.country[country] = Number(pct.toFixed(2));
                });
            }
        } catch (e) {
            console.warn('[YouTube] Error fetching Country analytics:', e);
        }

        try {
            // 3. City
            // Removed sort/maxResults for base baseline if failing
            const { ok, status, data } = await fetchReport('demographics_city', (start) =>
                `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${endDate}&metrics=views&dimensions=city&sort=-views&maxResults=25`
            );

            if (ok && data?.rows) {
                const totalViews = data.rows.reduce((acc: number, row: any) => acc + (row[1] || 0), 0);
                data.rows.forEach((row: any) => {
                    const city = row[0] || 'Unknown';
                    const views = row[1] || 0;
                    const pct = totalViews > 0 ? (views / totalViews) * 100 : 0;
                    result.demographics.city[city] = Number(pct.toFixed(2));
                });
            }
        } catch (e) {
            console.warn('[YouTube] Error fetching City analytics:', e);
        }

        return result;

    } catch (error) {
        console.error('[YouTube] Error fetching audience insights:', error);
        return result; // Return empty/partial structure
    }
}

export interface YouTubeAccountInsights {
    views: number;
    subscribersGained: number;
    estimatedMinutesWatched: number;
    averageViewDuration: number;
    engagement: number;
    trafficSources?: any[];
    _rawResponses?: any[];
}

export async function getYouTubeAccountInsights(
    credentials: YouTubeCredentials
): Promise<YouTubeAccountInsights> {
    const { accessToken } = credentials;
    const defaultResult = { views: 0, subscribersGained: 0, estimatedMinutesWatched: 0, averageViewDuration: 0, engagement: 0 };

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

        // Note: 'averageViewDuration' is in seconds
        const metrics = 'views,subscribersGained,estimatedMinutesWatched,averageViewDuration,likes,comments';
        const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=${metrics}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        await capture(response, 'account_insights_28d');

        if (!response.ok) {
            const err = await response.text(); // Use text() to avoid JSON parse error on empty/HTML response
            console.warn(`[YouTube] Failed to fetch channel insights (${response.status}):`, err);
            return { ...defaultResult, _rawResponses };
        }

        const data = await response.json();
        const result: YouTubeAccountInsights = { ...defaultResult, _rawResponses };

        if (data.rows && data.rows.length > 0) {
            const row = data.rows[0];
            result.views = row[0] || 0;
            result.subscribersGained = row[1] || 0;
            result.estimatedMinutesWatched = row[2] || 0;
            result.averageViewDuration = row[3] || 0;
            result.engagement = (row[4] || 0) + (row[5] || 0);
        }

        // Fetch Traffic Sources for Channel
        try {
            const trafficUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views&dimensions=insightTrafficSourceType`;
            const trafficRes = await fetch(trafficUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            await capture(trafficRes, 'channel_traffic_sources');
            if (trafficRes.ok) {
                const trafficData = await trafficRes.json();
                result.trafficSources = trafficData.rows || [];
            }
        } catch (e) {
            console.warn('[YouTube] Error fetching channel traffic sources:', e);
        }

        return result;

    } catch (error) {
        console.error('[YouTube] Error fetching YouTube account insights:', error);
        return defaultResult;
    }
}
