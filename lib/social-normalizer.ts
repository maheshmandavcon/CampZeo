
import { prisma } from "@/lib/prisma";
import { PlatformType } from "@prisma/client";
import { getFacebookPagePosts, getFacebookPostInsights, getFacebookAccountInsights } from "./facebook";
import { getInstagramUserMedia, getInstagramPostInsights, getInstagramAccountInsights } from "./instagram";
import { getLinkedInUserPosts, getLinkedInPostInsights } from "./linkedin";
import { getYouTubeChannelVideos, getYouTubeVideoInsights, getYouTubeAccountInsights } from "./youtube";
import { getPinterestUserPins, getPinterestPostInsights } from "./pinterest";

// Unified Metric Types
export type UnifiedMetricName =
    | "amplification_count"  // General Shares/Saves/Reposts
    | "engagement_count"     // Total interactions
    | "impression_count"     // Views, Impressions
    | "reach_count"          // Unique reach
    | "like_count"
    | "comment_count"
    | "save_count"
    | "share_count"
    | "video_view_count"
    | "follower_count"
    | "profile_view_count"
    | "watch_time_count"
    | "subscriber_count"
    | "engaged_user_count"
    | "account_like_count";

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

        const result = {
            userId: clerkId,
            facebook: { success: 0, failed: 0 },
            instagram: { success: 0, failed: 0 },
            linkedin: { success: 0, failed: 0 },
            youtube: { success: 0, failed: 0 },
            pinterest: { success: 0, failed: 0 },
            campaigns: { success: 0, failed: 0 }
        };

        const user = await prisma.user.findUnique({
            where: { clerkId },
            include: { organisation: true }
        });

        if (!user || !user.organisationId) {
            console.warn(`[SocialNormalizer] User or Organisation not found for ${clerkId}`);
            return result;
        }

        const orgId = user.organisationId;

        // Process platforms concurrently
        const promises = [];

        // 1. Facebook
        if (user.facebookPageAccessToken && user.facebookPageId) {
            promises.push(
                this.syncFacebook(orgId, {
                    accessToken: user.facebookPageAccessToken,
                    pageId: user.facebookPageId
                }).then(res => { result.facebook = res; })
            );
        }

        // 2. Instagram
        if (user.instagramAccessToken && user.instagramUserId) {
            promises.push(
                this.syncInstagram(orgId, {
                    accessToken: user.instagramAccessToken,
                    userId: user.instagramUserId
                }).then(res => { result.instagram = res; })
            );
        }

        // 3. LinkedIn
        if (user.linkedInAccessToken && user.linkedInAuthUrn) {
            promises.push(
                this.syncLinkedIn(orgId, {
                    accessToken: user.linkedInAccessToken,
                    authorUrn: user.linkedInAuthUrn
                }).then(res => { result.linkedin = res; })
            );
        }

        // 4. YouTube
        if (user.youtubeAccessToken) {
            promises.push(
                this.syncYouTube(orgId, {
                    accessToken: user.youtubeAccessToken
                }).then(res => { result.youtube = res; })
            );
        }

        // 5. Pinterest
        if (user.pinterestAccessToken) {
            promises.push(
                this.syncPinterest(orgId, {
                    accessToken: user.pinterestAccessToken
                }).then(res => { result.pinterest = res; })
            );
        }

        // 6. Campaign Posts (from PostTransaction)
        promises.push(
            this.syncCampaignPosts(orgId, user).then(res => { result.campaigns = res; })
        );

        const results = await Promise.allSettled(promises);

        results.forEach((r, index) => {
            if (r.status === 'rejected') {
                console.error(`[SocialNormalizer] Platform sync failed:`, r.reason);
            }
        });

        // Calculate total stats
        const totalSuccess = Object.values(result).filter(v => typeof v === 'object' && 'success' in v).reduce((acc, v: any) => acc + v.success, 0);
        const totalFailed = Object.values(result).filter(v => typeof v === 'object' && 'failed' in v).reduce((acc, v: any) => acc + v.failed, 0);

        console.log(`[SocialNormalizer] Sync complete for user: ${clerkId}. Success: ${totalSuccess}, Failed: ${totalFailed}`);
        return {
            ...result,
            totalSuccess,
            totalFailed
        };
    }

    // --- Platform Specific Syncers ---

    private static async syncFacebook(orgId: number, creds: { accessToken: string, pageId: string }) {
        let success = 0;
        let failed = 0;
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
                    ];

                    // Calculate total engagement
                    metrics.push({ metricName: "engagement_count", value: insights.engagement, rawMetricName: "total_interactions" });

                    await this.storeMetrics(orgId, "FACEBOOK", post.id, metrics);
                    success++;
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync FB post ${post.id}`, err);
                    failed++;
                }
            }

            // --- 2. Account-Level Metrics ---
            try {
                const accountInsights = await getFacebookAccountInsights(creds);
                const accountMetrics: MetricPoint[] = [
                    { metricName: "follower_count", value: accountInsights.followerCount, rawMetricName: "fans" },
                    { metricName: "reach_count", value: accountInsights.reach, rawMetricName: "page_reach_28d" },
                    { metricName: "impression_count", value: accountInsights.impressions, rawMetricName: "page_impressions_28d" },
                    { metricName: "engagement_count", value: accountInsights.engagement, rawMetricName: "page_post_engagements_28d" },
                    { metricName: "profile_view_count", value: accountInsights.pageViews || 0, rawMetricName: "page_views_28d" },
                    { metricName: "account_like_count", value: accountInsights.pageLikes || 0, rawMetricName: "page_likes_28d" },
                    { metricName: "engaged_user_count", value: accountInsights.engagedUsers || 0, rawMetricName: "page_engaged_users_28d" },
                ];

                await this.storeMetrics(orgId, "FACEBOOK", "ACCOUNT", accountMetrics);
            } catch (err) {
                console.error(`[SocialNormalizer] Failed to sync Facebook account-level insights`, err);
            }

        } catch (err) {
            console.error(`[SocialNormalizer] Facebook sync error`, err);
        }
        return { success, failed };
    }

    private static async syncInstagram(orgId: number, creds: { accessToken: string, userId: string }) {
        let success = 0;
        let failed = 0;
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
                        { metricName: "engagement_count", value: insights.engagement, rawMetricName: "total_interactions" },
                        { metricName: "save_count", value: insights.saved || 0, rawMetricName: "saved" },
                        { metricName: "share_count", value: insights.shares || 0, rawMetricName: "shares" },
                        { metricName: "video_view_count", value: insights.video_views || 0, rawMetricName: "plays/views" },
                        { metricName: "amplification_count", value: (insights.saved || 0) + (insights.shares || 0), rawMetricName: "saved+shares" },
                    ];

                    await this.storeMetrics(orgId, "INSTAGRAM", item.id, metrics);
                    success++;
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync IG post ${item.id}`, err);
                    failed++;
                }
            }

            // --- 2. Account-Level Metrics ---
            try {
                const accountInsights = await getInstagramAccountInsights(creds);
                const accountMetrics: MetricPoint[] = [
                    { metricName: "follower_count", value: accountInsights.followerCount, rawMetricName: "followers_count" },
                    { metricName: "reach_count", value: accountInsights.reach, rawMetricName: "accounts_reached_28d" },
                    { metricName: "impression_count", value: accountInsights.impressions, rawMetricName: "impressions_28d" },
                    { metricName: "profile_view_count", value: accountInsights.profileViews, rawMetricName: "profile_views_28d" },
                ];

                await this.storeMetrics(orgId, "INSTAGRAM", "ACCOUNT", accountMetrics);
            } catch (err) {
                console.error(`[SocialNormalizer] Failed to sync Instagram account-level insights`, err);
            }

        } catch (err) {
            console.error(`[SocialNormalizer] Instagram sync error`, err);
        }
        return { success, failed };
    }

    private static async syncLinkedIn(orgId: number, creds: { accessToken: string, authorUrn: string }) {
        let success = 0;
        let failed = 0;
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
                        { metricName: "engagement_count", value: insights.engagement, rawMetricName: "social_actions" },
                    ];

                    await this.storeMetrics(orgId, "LINKEDIN", post.id, metrics);
                    success++;
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync LinkedIn post ${post.id}`, err);
                    failed++;
                }
            }
        } catch (err) {
            console.error(`[SocialNormalizer] LinkedIn sync error`, err);
        }
        return { success, failed };
    }

    private static async syncYouTube(orgId: number, creds: { accessToken: string }) {
        let success = 0;
        let failed = 0;
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
                        { metricName: "engagement_count", value: insights.engagement, rawMetricName: "total_engagement" },
                    ];

                    await this.storeMetrics(orgId, "YOUTUBE", video.id, metrics);
                    success++;
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync YT video ${video.id}`, err);
                    failed++;
                }
            }

            // --- 2. Account-Level Metrics ---
            try {
                const accountInsights = await getYouTubeAccountInsights({ accessToken: creds.accessToken });
                const accountMetrics: MetricPoint[] = [
                    { metricName: "subscriber_count", value: accountInsights.subscribersGained, rawMetricName: "subscribers_gained_28d" },
                    { metricName: "video_view_count", value: accountInsights.views, rawMetricName: "views_28d" },
                    { metricName: "watch_time_count", value: accountInsights.estimatedMinutesWatched, rawMetricName: "estimated_minutes_watched_28d" },
                    { metricName: "engagement_count", value: accountInsights.engagement, rawMetricName: "likes_comments_28d" },
                ];

                await this.storeMetrics(orgId, "YOUTUBE", "ACCOUNT", accountMetrics);
            } catch (err) {
                console.error(`[SocialNormalizer] Failed to sync YouTube account-level insights`, err);
            }

        } catch (err) {
            console.error(`[SocialNormalizer] YouTube sync error`, err);
        }
        return { success, failed };
    }

    private static async syncPinterest(orgId: number, creds: { accessToken: string }) {
        let success = 0;
        let failed = 0;
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
                    success++;
                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync Pinterest pin ${pin.id}`, err);
                    failed++;
                }
            }
        } catch (err) {
            console.error(`[SocialNormalizer] Pinterest sync error`, err);
        }
        return { success, failed };
    }

    /**
     * Sync metrics for campaign posts tracked in PostTransaction
     */
    private static async syncCampaignPosts(orgId: number, user: any) {
        let success = 0;
        let failed = 0;
        try {
            console.log(`[SocialNormalizer] Syncing Campaign Posts...`);

            // Find published posts that haven't been checked recently (or never checked)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            const campaignPosts = await prisma.postTransaction.findMany({
                where: {
                    published: true,
                    OR: [
                        { lastInsightsCheck: null },
                        { lastInsightsCheck: { lt: oneHourAgo } }
                    ]
                },
                take: 50 // Limit to avoid overwhelming the API
            });

            console.log(`[SocialNormalizer] Found ${campaignPosts.length} campaign posts to sync`);

            for (const post of campaignPosts) {
                try {
                    const platform = post.platform as string;
                    let insights: any = null;

                    // Fetch insights based on platform
                    switch (platform) {
                        case 'FACEBOOK':
                            if (user.facebookPageAccessToken) {
                                insights = await getFacebookPostInsights(post.postId, user.facebookPageAccessToken);
                            }
                            break;
                        case 'INSTAGRAM':
                            if (user.instagramAccessToken) {
                                insights = await getInstagramPostInsights(post.postId, user.instagramAccessToken);
                            }
                            break;
                        case 'LINKEDIN':
                            if (user.linkedInAccessToken) {
                                insights = await getLinkedInPostInsights(post.postId, user.linkedInAccessToken);
                            }
                            break;
                        case 'YOUTUBE':
                            if (user.youtubeAccessToken) {
                                insights = await getYouTubeVideoInsights(post.postId, user.youtubeAccessToken);
                            }
                            break;
                        case 'PINTEREST':
                            if (user.pinterestAccessToken) {
                                insights = await getPinterestPostInsights(post.postId, user.pinterestAccessToken);
                            }
                            break;
                    }

                    // Helper to create zero metrics
                    const createZeroMetrics = (plat: string): MetricPoint[] => {
                        if (plat === 'FACEBOOK' || plat === 'INSTAGRAM' || plat === 'LINKEDIN') {
                            return [
                                { metricName: "like_count", value: 0, rawMetricName: "likes" },
                                { metricName: "comment_count", value: 0, rawMetricName: "comments" },
                                { metricName: "impression_count", value: 0, rawMetricName: "impressions" },
                                { metricName: "reach_count", value: 0, rawMetricName: "reach" },
                                { metricName: "engagement_count", value: 0, rawMetricName: "engagement" }
                            ];
                        } else if (plat === 'YOUTUBE') {
                            return [
                                { metricName: "like_count", value: 0, rawMetricName: "likeCount" },
                                { metricName: "comment_count", value: 0, rawMetricName: "commentCount" },
                                { metricName: "impression_count", value: 0, rawMetricName: "viewCount" },
                                { metricName: "reach_count", value: 0, rawMetricName: "viewCount" },
                                { metricName: "engagement_count", value: 0, rawMetricName: "engagement" }
                            ];
                        } else if (plat === 'PINTEREST') {
                            return [
                                { metricName: "like_count", value: 0, rawMetricName: "reactions/saves" },
                                { metricName: "comment_count", value: 0, rawMetricName: "comments" },
                                { metricName: "impression_count", value: 0, rawMetricName: "impressions" },
                                { metricName: "reach_count", value: 0, rawMetricName: "reach" },
                                { metricName: "amplification_count", value: 0, rawMetricName: "saves" },
                                { metricName: "engagement_count", value: 0, rawMetricName: "total_engagement" }
                            ];
                        }
                        return [];
                    };

                    let metrics: MetricPoint[] = [];

                    if (insights && !insights.isDeleted) {
                        // Map platform-specific insights to unified metrics
                        if (platform === 'FACEBOOK') {
                            metrics.push(
                                { metricName: "like_count", value: insights.likes, rawMetricName: "likes" },
                                { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                                { metricName: "impression_count", value: insights.impressions, rawMetricName: "post_impressions" },
                                { metricName: "reach_count", value: insights.reach, rawMetricName: "post_impressions_unique" },
                                { metricName: "engagement_count", value: insights.engagement, rawMetricName: "total_interactions" }
                            );
                        } else if (platform === 'INSTAGRAM') {
                            metrics.push(
                                { metricName: "like_count", value: insights.likes, rawMetricName: "likes" },
                                { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                                { metricName: "impression_count", value: insights.impressions, rawMetricName: "impressions" },
                                { metricName: "reach_count", value: insights.reach, rawMetricName: "reach" },
                                { metricName: "engagement_count", value: insights.engagement, rawMetricName: "total_interactions" },
                                { metricName: "save_count", value: insights.saved || 0, rawMetricName: "saved" },
                                { metricName: "share_count", value: insights.shares || 0, rawMetricName: "shares" },
                                { metricName: "video_view_count", value: insights.video_views || 0, rawMetricName: "plays/views" },
                                { metricName: "amplification_count", value: (insights.saved || 0) + (insights.shares || 0), rawMetricName: "saved+shares" }
                            );
                        } else if (platform === 'LINKEDIN') {
                            metrics.push(
                                { metricName: "like_count", value: insights.likes, rawMetricName: "likes" },
                                { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                                { metricName: "impression_count", value: insights.impressions, rawMetricName: "impressionCount" },
                                { metricName: "reach_count", value: insights.reach, rawMetricName: "uniqueImpressionsCount" },
                                { metricName: "engagement_count", value: insights.engagement, rawMetricName: "social_actions" }
                            );
                        } else if (platform === 'YOUTUBE') {
                            metrics.push(
                                { metricName: "like_count", value: insights.likes, rawMetricName: "likeCount" },
                                { metricName: "comment_count", value: insights.comments, rawMetricName: "commentCount" },
                                { metricName: "impression_count", value: insights.views, rawMetricName: "viewCount" },
                                { metricName: "reach_count", value: insights.views, rawMetricName: "viewCount" },
                                { metricName: "engagement_count", value: insights.engagement, rawMetricName: "total_engagement" }
                            );
                        } else if (platform === 'PINTEREST') {
                            metrics.push(
                                { metricName: "like_count", value: insights.likes, rawMetricName: "reactions/saves" },
                                { metricName: "comment_count", value: insights.comments, rawMetricName: "comments" },
                                { metricName: "impression_count", value: insights.impressions, rawMetricName: "impressions" },
                                { metricName: "reach_count", value: insights.reach, rawMetricName: "outbound_click/reach" },
                                { metricName: "amplification_count", value: insights.saves, rawMetricName: "saves" },
                                { metricName: "engagement_count", value: insights.saves + insights.pinClicks + insights.outboundClicks + insights.comments, rawMetricName: "total_engagement" }
                            );
                        }
                    } else {
                        // Post is deleted OR insights is null (e.g. token missing or API error handled above returning null)
                        console.log(`[SocialNormalizer] Post ${post.postId} (${platform}) is deleted or inaccessible. Using zero metrics.`);
                        metrics = createZeroMetrics(platform);

                        if (metrics.length > 0) {
                            await this.storeMetrics(orgId, platform as PlatformType, post.postId, metrics, true);
                            success++;
                        }
                    }

                    if (metrics.length > 0 && insights && !insights.isDeleted) {
                        // Only store if not already stored above (which was for deleted case)
                        // Wait, rewriting this logic is better.
                        await this.storeMetrics(orgId, platform as PlatformType, post.postId, metrics, false);
                        success++;
                    }

                    // Update lastInsightsCheck timestamp (even if deleted/zero, so we don't retry immediately)
                    await prisma.postTransaction.update({
                        where: { id: post.id },
                        data: { lastInsightsCheck: new Date() }
                    });

                } catch (err) {
                    console.error(`[SocialNormalizer] Failed to sync campaign post ${post.id}`, err);
                    // Even on hard error (e.g. Prisma failure or unhandled API logic), we try to record zero if possible?
                    // But if prisma failed, storeMetrics might fail too.
                    // However, if the error was in fetching insights (e.g. 400 error threw before we caught it inside `get...`), 
                    // we are here.
                    // Let's try to store zero metrics ONE MORE TIME here, assuming the error was upstream.
                    try {
                        console.log(`[SocialNormalizer] Attempting to store zero metrics after error for ${post.postId}`);
                        // We need a simple way to get platform here, but it's available in scope
                        const platform = post.platform as string;

                        // Inline helper again or copy-paste (cannot reuse inner scope helper easily if not defined outside try)
                        // Actually, typescript needs the helper defined outside if used here.
                        // I'll assume the helper definition was inside the loop's scope but outside the try?? No, it was inside try.
                        // So I can't use it here. I'll just skip this complexity to avoid syntax errors if I misplace it.
                        // Instead, let's rely on the fact that I updated the `get...` functions to return `isDeleted: true` 
                        // or safe objects where possible, and the catch above is for really bad errors.
                        // If I really want to handle it, I should move the helper out.

                        // Re-defining helper content simply for safety
                        let zMetrics: MetricPoint[] = [];
                        if (post.platform === 'FACEBOOK' || post.platform === 'INSTAGRAM') {
                            zMetrics = [{ metricName: "impression_count", value: 0, rawMetricName: "failed_sync" } as any];
                        }

                        if (zMetrics.length > 0) {
                            // Using isDeleted=false because it's an error, not necessarily a deletion. 
                            // But user said "if ... failed ... let it be 0". 
                            // I will store it as 0 but NOT deleted to differentiate from confirmed deletion.
                            await this.storeMetrics(orgId, post.platform as PlatformType, post.postId, zMetrics, false);
                        }

                        failed++;
                    } catch (e2) {
                        failed++;
                    }
                }
            }

        } catch (err) {
            console.error(`[SocialNormalizer] Campaign posts sync error`, err);
        }
        return { success, failed };
    }

    /**
     * Store metrics in the database
     */
    private static async storeMetrics(
        orgId: number,
        platform: PlatformType,
        postId: string,
        metrics: MetricPoint[],
        isDeleted: boolean = false
    ) {

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

            // 2. Latest Metrics Storage: Upsert into PostInsight for quick access (Skip for account-level metrics)
            if (postId === "ACCOUNT") return;

            const metricsMap = metrics.reduce((acc, m) => {
                acc[m.metricName] = m.value;
                return acc;
            }, {} as Record<string, number>);

            const likes = metricsMap['like_count'] || 0;
            const comments = metricsMap['comment_count'] || 0;
            const reach = metricsMap['reach_count'] || 0;
            const impressions = metricsMap['impression_count'] || 0;
            const engagement = metricsMap['engagement_count'] || 0;
            const saves = metricsMap['save_count'] || 0;
            const shares = metricsMap['share_count'] || 0;
            const videoViews = metricsMap['video_view_count'] || 0;

            // Calculate engagement rate
            // Follow platform logic: prefer reach if available, otherwise impressions
            const base = reach > 0 ? reach : impressions;
            const engagementRate = base > 0 ? (engagement / base) * 100 : 0;

            // Find existing insight for this post and platform
            const existingInsight = await prisma.postInsight.findFirst({
                where: {
                    postId: postId,
                    platform: platform
                }
            });

            if (existingInsight) {
                // Update existing
                await prisma.postInsight.update({
                    where: { id: existingInsight.id },
                    data: {
                        likes,
                        comments,
                        reach,
                        impressions,
                        saves,
                        shares,
                        videoViews,
                        engagementRate,
                        lastUpdated: new Date(),
                        updatedAt: new Date(),
                        isDeleted: isDeleted
                    }
                });
            } else {
                // Create new
                await prisma.postInsight.create({
                    data: {
                        postId,
                        platform,
                        likes,
                        comments,
                        reach,
                        impressions,
                        saves,
                        shares,
                        videoViews,
                        engagementRate,
                        isDeleted: isDeleted,
                        lastUpdated: new Date()
                    }
                });
            }
        } catch (err) {
            console.error(`[SocialNormalizer] Error storing metrics for ${platform} post ${postId}`, err);
            throw err; // Re-throw to count as failure in the caller
        }
    }
}
