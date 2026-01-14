
import { prisma } from "@/lib/prisma";
import { PlatformType } from "@prisma/client";
import { getFacebookPagePosts, getFacebookPostInsights } from "./facebook";
import { getInstagramUserMedia, getInstagramPostInsights } from "./instagram";
import { getLinkedInUserPosts, getLinkedInPostInsights } from "./linkedin";
import { getYouTubeChannelVideos, getYouTubeVideoInsights } from "./youtube";
import { getPinterestUserPins, getPinterestPostInsights } from "./pinterest";

// Unified Metric Types
export type UnifiedMetricName = 
    | "amplification_count"  // Shares, Saves, Reposts
    | "engagement_count"     // Total interactions
    | "impression_count"     // Views, Impressions
    | "reach_count"          // Unique reach
    | "like_count"
    | "comment_count";

interface MetricPoint {
    metricName: UnifiedMetricName;
    value: number;
    rawMetricName: string;
}

export class SocialNormalizerService {

    /**
     * Fetch and store unified metrics for a specific user and their connected platforms
     */
    static async syncUserMetrics(clerkId: string) {
        console.log(`[SocialNormalizer] Starting sync for user: ${clerkId}`);

        const user = await prisma.user.findUnique({
            where: { clerkId },
            include: { organisation: true }
        });

        if (!user || !user.organisationId) {
            console.warn(`[SocialNormalizer] User or Organisation not found for ${clerkId}`);
            return;
        }

        const orgId = user.organisationId;

        // Process platforms concurrently
        const promises = [];

        // 1. Facebook
        if (user.facebookPageAccessToken && user.facebookPageId) {
            promises.push(this.syncFacebook(orgId, {
                accessToken: user.facebookPageAccessToken,
                pageId: user.facebookPageId
            }));
        }

        // 2. Instagram
        if (user.instagramAccessToken && user.instagramUserId) {
            promises.push(this.syncInstagram(orgId, {
                accessToken: user.instagramAccessToken,
                userId: user.instagramUserId
            }));
        }

        // 3. LinkedIn
        if (user.linkedInAccessToken && user.linkedInAuthUrn) {
            promises.push(this.syncLinkedIn(orgId, {
                accessToken: user.linkedInAccessToken,
                authorUrn: user.linkedInAuthUrn
            }));
        }

        // 4. YouTube
        if (user.youtubeAccessToken) {
            promises.push(this.syncYouTube(orgId, {
                accessToken: user.youtubeAccessToken
            }));
        }

        // 5. Pinterest
        if (user.pinterestAccessToken) {
            promises.push(this.syncPinterest(orgId, {
                accessToken: user.pinterestAccessToken
            }));
        }

        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`[SocialNormalizer] Platform sync failed:`, result.reason);
            }
        });

        console.log(`[SocialNormalizer] Sync complete for user: ${clerkId}`);
    }

    // --- Platform Specific Syncers ---

    private static async syncFacebook(orgId: number, creds: { accessToken: string, pageId: string }) {
        try {
            console.log(`[SocialNormalizer] Syncing Facebook...`);
            const posts = await getFacebookPagePosts(creds, 10); // Sync last 10 posts

            for (const post of posts) {
                try {
                    const insights = await getFacebookPostInsights(post.id, creds.accessToken);
                    if (insights.isDeleted) continue;

                    const metrics: MetricPoint[] = [
                        { metricName: "like_count", value: insights.likes, rawMetricName: "likes" },
                        { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                        { metricName: "impression_count", value: insights.impressions, rawMetricName: "post_impressions" },
                        { metricName: "reach_count", value: insights.reach, rawMetricName: "post_impressions_unique" },
                        // Amplification for FB is primarily Shares
                        // Note: Shares might be missing in basic insights, but usually part of engagement
                        // We don't have direct 'shares' in standard return of getFacebookPostInsights yet unless we add it,
                        // checking the lib, it does return `shares: postData.shares?.count || 0` inside but not in interface explicitly?
                        // Wait, looking at `getFacebookPostInsights`, it calculates engagementRate but doesn't return `shares` explicitly in the interface.
                        // I will approximate amplification if needed or update lib. For now, let's stick to what is exposed.
                        // Actually, looking at the code I read earlier:
                        // `return { likes, comments, impressions, reach, engagementRate, ... }`
                        // It does NOT return shares. I will skip amplification for FB for now or treat generic engagement.
                    ];

                    // Calculate total engagement
                    const engagementTotal = insights.likes + insights.comments; 
                    metrics.push({ metricName: "engagement_count", value: engagementTotal, rawMetricName: "likes+comments" });

                    await this.storeMetrics(orgId, "FACEBOOK", post.id, metrics);
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync FB post ${post.id}`, err);
                }
            }
        } catch (err) {
            console.error(`[SocialNormalizer] Facebook sync error`, err);
            throw err;
        }
    }

    private static async syncInstagram(orgId: number, creds: { accessToken: string, userId: string }) {
        try {
            console.log(`[SocialNormalizer] Syncing Instagram...`);
            const mediaItems = await getInstagramUserMedia(creds, 10);

            for (const item of mediaItems) {
                try {
                    const insights = await getInstagramPostInsights(item.id, creds.accessToken);
                    if (insights.isDeleted) continue;

                    const metrics: MetricPoint[] = [
                        { metricName: "like_count", value: insights.likes, rawMetricName: "likes" },
                        { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                        { metricName: "impression_count", value: insights.impressions, rawMetricName: "impressions" },
                        { metricName: "reach_count", value: insights.reach, rawMetricName: "reach" },
                        { metricName: "engagement_count", value: insights.likes + insights.comments, rawMetricName: "likes+comments" },
                        // IG Amplification = Saves (not always available in basic insights but useful if there)
                    ];
                    
                    await this.storeMetrics(orgId, "INSTAGRAM", item.id, metrics);
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync IG post ${item.id}`, err);
                }
            }
        } catch (err) {
            console.error(`[SocialNormalizer] Instagram sync error`, err);
            throw err;
        }
    }

    private static async syncLinkedIn(orgId: number, creds: { accessToken: string, authorUrn: string }) {
        try {
            console.log(`[SocialNormalizer] Syncing LinkedIn...`);
            const posts = await getLinkedInUserPosts(creds, 10);

            for (const post of posts) {
                try {
                    const insights = await getLinkedInPostInsights(post.id, creds.accessToken);
                    
                    const metrics: MetricPoint[] = [
                        { metricName: "like_count", value: insights.likes, rawMetricName: "likes" },
                        { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                        { metricName: "impression_count", value: insights.impressions, rawMetricName: "impressionCount" },
                        { metricName: "reach_count", value: insights.reach, rawMetricName: "uniqueImpressionsCount" },
                        { metricName: "engagement_count", value: insights.likes + insights.comments, rawMetricName: "likes+comments" },
                    ];

                    await this.storeMetrics(orgId, "LINKEDIN", post.id, metrics);
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync LinkedIn post ${post.id}`, err);
                }
            }
        } catch (err) {
            console.error(`[SocialNormalizer] LinkedIn sync error`, err);
            throw err;
        }
    }

    private static async syncYouTube(orgId: number, creds: { accessToken: string }) {
        try {
            console.log(`[SocialNormalizer] Syncing YouTube...`);
            // YouTube 'videos' are channel videos
            const videos = await getYouTubeChannelVideos(creds.accessToken, 10);

            for (const video of videos) {
                try {
                    const insights = await getYouTubeVideoInsights(video.id, creds.accessToken);
                     if (insights.isDeleted) continue;

                    const metrics: MetricPoint[] = [
                        { metricName: "like_count", value: insights.likes, rawMetricName: "likeCount" },
                        { metricName: "comment_count", value: insights.comments, rawMetricName: "commentCount" },
                        { metricName: "impression_count", value: insights.views, rawMetricName: "viewCount" }, // Views as proxy for impressions
                        { metricName: "reach_count", value: insights.views, rawMetricName: "viewCount" },      // Views as proxy for reach
                        { metricName: "engagement_count", value: insights.likes + insights.comments, rawMetricName: "likes+comments" },
                    ];

                    await this.storeMetrics(orgId, "YOUTUBE", video.id, metrics);
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync YT video ${video.id}`, err);
                }
            }
        } catch (err) {
            console.error(`[SocialNormalizer] YouTube sync error`, err);
            throw err;
        }
    }

    private static async syncPinterest(orgId: number, creds: { accessToken: string }) {
        try {
            console.log(`[SocialNormalizer] Syncing Pinterest...`);
            const pins = await getPinterestUserPins(creds.accessToken, 10);

            for (const pin of pins) {
                try {
                    const insights = await getPinterestPostInsights(pin.id, creds.accessToken);

                    const metrics: MetricPoint[] = [
                        { metricName: "like_count", value: insights.likes, rawMetricName: "reactions/saves" },
                        { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                        { metricName: "impression_count", value: insights.impressions, rawMetricName: "impressions" },
                        { metricName: "reach_count", value: insights.reach, rawMetricName: "outbound_click/reach" }, // Pin has pinClicks/outboundClicks too
                        { metricName: "amplification_count", value: insights.saves, rawMetricName: "saves" },
                        { metricName: "engagement_count", value: insights.saves + insights.pinClicks + insights.outboundClicks + insights.comments, rawMetricName: "total_engagement" },
                    ];

                    await this.storeMetrics(orgId, "PINTEREST", pin.id, metrics);
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync Pinterest pin ${pin.id}`, err);
                }
            }
        } catch (err) {
            console.error(`[SocialNormalizer] Pinterest sync error`, err);
            throw err;
        }
    }


    /**
     * Store metrics in the database
     */
    private static async storeMetrics(
        orgId: number, 
        platform: PlatformType, 
        postId: string, 
        metrics: MetricPoint[]
    ) {
        // We use a transaction or batch create to be efficient
        // Since we are recording history, we just insert new rows with default 'now()' timestamp.
        
        // TODO: Optimization - Don't insert if exact same value exists for recent time window? 
        // For time-series, usually we just insert.
        
        try {
           await prisma.socialMetricHistory.createMany({
               data: metrics.map(m => ({
                   organisationId: orgId,
                   platform: platform,
                   postId: postId,
                   metricName: m.metricName,
                   value: m.value,
                   rawMetricName: m.rawMetricName
               }))
           });
        } catch (err) {
            console.error(`[SocialNormalizer] Error storing metrics for ${platform} post ${postId}`, err);
        }
    }
}
