
import { prisma } from "@/lib/prisma";
import { getFacebookPageAudience, getFacebookAccountInsights } from "./facebook";
import { getInstagramAudienceInsights, getInstagramAccountInsights } from "./instagram";
import { getLinkedInAudienceInsights } from "./linkedin";
import { getYouTubeAudienceInsights, getYouTubeAccountInsights } from "./youtube";
import { getPinterestAudienceInsights } from "./pinterest";
import { PlatformType } from "@prisma/client";

export interface PlatformDetail {
    platform: PlatformType;
    followers: number;
    reach: number;
    engagement: number;
    posts: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    videoViews: number;
    profileViews: number;
    followerReach?: number;
    nonFollowerReach?: number;
}

export interface UnifiedAudienceData {
    topCities: { name: string; value: number }[];
    topCountries: { name: string; code: string; value: number }[];
    activityHeatmap: { day: number; hour: number; value: number }[];
    platformBreakdown: PlatformDetail[];
    // Detailed reach breakdowns by demographics
    reachByCity: Record<string, number>;
    reachByCountry: Record<string, number>;
    reachByGender: Record<string, number>;
    // Debug: Raw API responses
    debug?: {
        facebook?: any;
        instagram?: any;
        youtube?: any;
        linkedin?: any;
        pinterest?: any;
        [key: string]: any;
    };
}

export class AudienceNormalizerService {

    static async getAggregatedAudience(organisationId: number): Promise<UnifiedAudienceData> {
        // Fetch organization users (admins) to get tokens
        const org = await prisma.organisation.findUnique({
            where: { id: organisationId },
            include: { users: true }
        });

        if (!org || !org.users.length) {
            throw new Error("Organisation not found or no users");
        }

        // Use the first user that has tokens (or iterate through all if needed, usually tokens are on the admin/user)
        // Optimization: pick the user with most tokens or just iterate.
        // Assuming single-user connection model or shared tokens on User model.
        // We'll use the *first* user that has tokens for each platform.
        const user = org.users[0]; // Simplified for now. In real app might need to check who connected what.

        const promises: Promise<any>[] = [];

        // 1. Facebook
        if (user.facebookPageAccessToken && user.facebookPageId) {
            const fbCreds = { accessToken: user.facebookPageAccessToken, pageId: user.facebookPageId };
            promises.push(getFacebookPageAudience(fbCreds)
                .then(async data => {
                    const accountData = await getFacebookAccountInsights(fbCreds);
                    return { platform: 'FACEBOOK', data: { ...data, ...accountData } };
                })
                .catch(e => ({ platform: 'FACEBOOK', error: e })));
        }

        // 2. Instagram
        if (user.instagramAccessToken && user.instagramUserId) {
            const igCreds = { accessToken: user.instagramAccessToken, userId: user.instagramUserId };
            promises.push(getInstagramAudienceInsights(igCreds)
                .then(async data => {
                    const accountData = await getInstagramAccountInsights(igCreds);
                    return { platform: 'INSTAGRAM', data: { ...data, ...accountData } };
                })
                .catch(e => ({ platform: 'INSTAGRAM', error: e })));
        }

        // 3. LinkedIn
        if (user.linkedInAccessToken && user.linkedInAuthUrn) {
            promises.push(getLinkedInAudienceInsights({ accessToken: user.linkedInAccessToken, authorUrn: user.linkedInAuthUrn })
                .then(data => ({ platform: 'LINKEDIN', data }))
                .catch(e => ({ platform: 'LINKEDIN', error: e })));
        }

        // 4. YouTube
        if (user.youtubeAccessToken) {
            const ytCreds = { accessToken: user.youtubeAccessToken };
            promises.push(getYouTubeAudienceInsights(ytCreds)
                .then(async data => {
                    const accountData = await getYouTubeAccountInsights(ytCreds);
                    return { platform: 'YOUTUBE', data: { ...data, ...accountData } };
                })
                .catch(e => ({ platform: 'YOUTUBE', error: e })));
        }

        // 5. Pinterest
        if (user.pinterestAccessToken) {
            promises.push(getPinterestAudienceInsights(user.pinterestAccessToken)
                .then(data => ({ platform: 'PINTEREST', data }))
                .catch(e => ({ platform: 'PINTEREST', error: e })));
        }

        // Fetch aggregate engagement stats for this organization's posts
        const campaignPostIds = await prisma.campaignPost.findMany({
            where: { campaign: { organisationId } },
            select: { id: true }
        }).then(posts => posts.map(p => p.id));

        const transactions = await prisma.postTransaction.findMany({
            where: {
                refId: { in: campaignPostIds },
                published: true
            },
            select: { postId: true, publishedAt: true }
        });
        const allPlatformPostIds = transactions.map(p => p.postId);

        // Fetch insights for these posts for heatmap calculation
        const allInsights = await prisma.postInsight.findMany({
            where: {
                postId: { in: allPlatformPostIds },
                isDeleted: false
            }
        });

        const engagementStats = await prisma.postInsight.groupBy({
            by: ['platform'],
            where: {
                isDeleted: false,
                postId: { in: allPlatformPostIds }
            },
            _sum: {
                likes: true,
                comments: true,
                saves: true,
                shares: true,
                reach: true,
                impressions: true,
                videoViews: true
            },
            _count: {
                postId: true
            }
        });

        const results = await Promise.all(promises);

        // Calculate Real Heatmap
        const realHeatmap = this.calculateRealHeatmap(transactions, allInsights);

        return this.normalizeResults(results, engagementStats, realHeatmap);
    }

    private static calculateRealHeatmap(transactions: { postId: string, publishedAt: Date | null }[], insights: any[]) {
        const heatmap = Array(7).fill(0).map(() => Array(24).fill(0));
        let totalEngagementFound = 0;

        transactions.forEach(t => {
            if (!t.publishedAt) return;

            const insight = insights.find(i => i.postId === t.postId);
            if (!insight) return;

            const engagement = (insight.likes || 0) + (insight.comments || 0) + (insight.shares || 0) + (insight.saves || 0) + (insight.videoViews || 0);
            if (engagement > 0) {
                const date = new Date(t.publishedAt);
                const day = date.getDay(); // 0-6 (Sun-Sat)
                const hour = date.getHours(); // 0-23

                heatmap[day][hour] += engagement;
                totalEngagementFound += engagement;
            }
        });

        if (totalEngagementFound === 0) return null;

        // Convert grid to array format
        const result = [];
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                result.push({ day: d, hour: h, value: heatmap[d][h] });
            }
        }
        return result;
    }

    private static normalizeResults(results: any[], engagementStats: any[], realHeatmap: { day: number; hour: number; value: number }[] | null): UnifiedAudienceData {
        console.log('[AudienceNormalizer] Normalizing results...');
        const aggregated = {
            cities: {} as Record<string, number>,
            countries: {} as Record<string, number>,
            platforms: [] as PlatformDetail[],
            // Track reach breakdowns by demographics
            reachByCity: {} as Record<string, number>,
            reachByCountry: {} as Record<string, number>,
            reachByGender: {} as Record<string, number>,
            // Debug data - always initialize
            debug: {
                facebook: [] as any[],
                instagram: [] as any[],
                youtube: [] as any[],
                linkedin: [] as any[],
                pinterest: [] as any[]
            } as any
        };

        results.forEach(res => {
            if (res.error) return;

            let followers = 0;
            if (res.platform === 'FACEBOOK') {
                const data = res.data;
                // Use reached audience demographics as primary for aggregate charts
                Object.entries(data.reachedByCity || {}).forEach(([k, v]) => {
                    aggregated.cities[k] = (aggregated.cities[k] || 0) + (v as number);
                    aggregated.reachByCity[k] = (aggregated.reachByCity[k] || 0) + (v as number);
                });
                Object.entries(data.reachedByCountry || {}).forEach(([k, v]) => {
                    aggregated.countries[k] = (aggregated.countries[k] || 0) + (v as number);
                    aggregated.reachByCountry[k] = (aggregated.reachByCountry[k] || 0) + (v as number);
                });
                // Extract gender from reachedByGenderAge (format: "M.25-34", "F.18-24", etc.)
                Object.entries(data.reachedByGenderAge || {}).forEach(([k, v]) => {
                    const gender = k.split('.')[0]; // Extract 'M' or 'F'
                    if (gender === 'M' || gender === 'F') {
                        const genderKey = gender === 'M' ? 'male' : 'female';
                        aggregated.reachByGender[genderKey] = (aggregated.reachByGender[genderKey] || 0) + (v as number);
                    }
                });

                // Fallback to fan demographics if reached is empty
                if (Object.keys(data.reachedByCity || {}).length === 0) {
                    Object.entries(data.fansByCity || {}).forEach(([k, v]) => {
                        aggregated.cities[k] = (aggregated.cities[k] || 0) + (v as number);
                        aggregated.reachByCity[k] = (aggregated.reachByCity[k] || 0) + (v as number);
                    });
                    Object.entries(data.fansByCountry || {}).forEach(([k, v]) => {
                        aggregated.countries[k] = (aggregated.countries[k] || 0) + (v as number);
                        aggregated.reachByCountry[k] = (aggregated.reachByCountry[k] || 0) + (v as number);
                    });
                    // Also extract gender from fansByGenderAge if using fallback
                    Object.entries(data.fansByGenderAge || {}).forEach(([k, v]) => {
                        const gender = k.split('.')[0];
                        if (gender === 'M' || gender === 'F') {
                            const genderKey = gender === 'M' ? 'male' : 'female';
                            aggregated.reachByGender[genderKey] = (aggregated.reachByGender[genderKey] || 0) + (v as number);
                        }
                    });
                }

                followers = data.followerCount || data.totalFollowers || 0;
                res.accountReach = data.reach || 0;
                res.accountEngagement = data.engagement || 0;
                res.profileViews = data.pageViews || 0;
                res.followerReach = data.fanReach || 0;
                res.nonFollowerReach = data.nonFanReach || 0;
            } else if (res.platform === 'INSTAGRAM') {
                const data = res.data;
                // Instagram already has audience metrics
                Object.entries(data.audienceCity || {}).forEach(([k, v]) => {
                    aggregated.cities[k] = (aggregated.cities[k] || 0) + (v as number);
                    aggregated.reachByCity[k] = (aggregated.reachByCity[k] || 0) + (v as number);
                });
                Object.entries(data.audienceCountry || {}).forEach(([k, v]) => {
                    aggregated.countries[k] = (aggregated.countries[k] || 0) + (v as number);
                    aggregated.reachByCountry[k] = (aggregated.reachByCountry[k] || 0) + (v as number);
                });
                // Extract gender from audienceGenderAge (format: "M.13-17", "F.25-34", etc.)
                Object.entries(data.audienceGenderAge || {}).forEach(([k, v]) => {
                    const gender = k.split('.')[0]; // Extract 'M' or 'F'
                    if (gender === 'M' || gender === 'F') {
                        const genderKey = gender === 'M' ? 'male' : 'female';
                        aggregated.reachByGender[genderKey] = (aggregated.reachByGender[genderKey] || 0) + (v as number);
                    }
                });
                followers = data.followerCount || data.totalFollowers || 0;
                res.accountReach = data.reach || 0;
                res.profileViews = data.profileViews || 0;
                res.accountEngagement = 0; // Instagram engagement at account level is often a manual sum or total_interactions proxy
                // If accountInsights has engagement, use it
                res.followerReach = data.followerReach || 0;
                res.nonFollowerReach = data.nonFollowerReach || 0;
            } else if (res.platform === 'LINKEDIN') {
                followers = res.data?.followerCounts?.total || 0;
                Object.entries(res.data?.followerGeography || {}).forEach(([k, v]) => {
                    const code = k.startsWith('urn:li:country:') ? k.replace('urn:li:country:', '').toUpperCase() : k;
                    aggregated.countries[code] = (aggregated.countries[code] || 0) + (v as number);
                });
            } else if (res.platform === 'YOUTUBE') {
                followers = res.data?.totalSubscribers || 0;
                Object.entries(res.data?.demographics?.country || {}).forEach(([k, v]) => {
                    aggregated.countries[k] = (aggregated.countries[k] || 0) + ((v as number / 100) * (followers || 1000));
                });
                res.accountReach = res.data?.views || 0;
                res.profileViews = res.data?.views || 0;
            } else if (res.platform === 'PINTEREST') {
                const data = res.data;

                // Raw data is now collected in the debug object below

                console.log('[AudienceNormalizer] Pinterest raw data:', {
                    totalFollowers: data?.totalFollowers,
                    hasCategories: !!data?.categories,
                    hasDemographics: !!data?.demographics,
                    hasRawResponses: !!data?._rawApiResponses
                });

                // Extract follower count with multiple fallbacks
                followers = data?.totalFollowers || data?.followerCount || 0;
                console.log('[AudienceNormalizer] Pinterest followers extracted:', followers);

                // Process demographics if available
                if (data?.demographics) {
                    // Countries/Locations
                    if (data.demographics.locations) {
                        Object.entries(data.demographics.locations).forEach(([k, v]) => {
                            const ratio = v as number;
                            aggregated.countries[k] = (aggregated.countries[k] || 0) + (ratio * (followers || 1000));
                            aggregated.reachByCountry[k] = (aggregated.reachByCountry[k] || 0) + (ratio * (followers || 1000));
                        });
                    }

                    // Genders
                    if (data.demographics.genders) {
                        Object.entries(data.demographics.genders).forEach(([k, v]) => {
                            const genderKey = k.toLowerCase().includes('female') ? 'female' :
                                k.toLowerCase().includes('male') ? 'male' : 'unknown';
                            const ratio = v as number;
                            aggregated.reachByGender[genderKey] = (aggregated.reachByGender[genderKey] || 0) + (ratio * (followers || 1000));
                        });
                    }
                }
            }

            // Collect raw responses for debugging
            if (res.data?._rawResponses && Array.isArray(res.data._rawResponses)) {
                const platKey = res.platform.toLowerCase();
                if (aggregated.debug[platKey]) {
                    aggregated.debug[platKey].push(...res.data._rawResponses);
                } else {
                    aggregated.debug[platKey] = [...res.data._rawResponses];
                }
            }

            aggregated.platforms.push({
                platform: res.platform as PlatformType,
                followers,
                reach: 0,
                engagement: 0,
                posts: 0,
                likes: 0,
                comments: 0,
                shares: 0,
                saves: 0,
                videoViews: 0,
                profileViews: res.profileViews || 0,
                followerReach: res.followerReach || 0,
                nonFollowerReach: res.nonFollowerReach || 0
            });
        });

        // Merge engagement stats
        aggregated.platforms = aggregated.platforms.map(p => {
            const stats = engagementStats.find(s => s.platform === p.platform);
            if (!stats) return p;

            return {
                ...p,
                posts: stats._count.postId || 0,
                likes: stats._sum.likes || 0,
                comments: stats._sum.comments || 0,
                shares: stats._sum.shares || 0,
                saves: stats._sum.saves || 0,
                videoViews: stats._sum.videoViews || 0,
                reach: (p.platform === 'INSTAGRAM' || p.platform === 'FACEBOOK' || p.platform === 'YOUTUBE')
                    ? (results.find(r => r.platform === p.platform)?.accountReach || stats._sum.reach || 0)
                    : (stats._sum.reach || 0),
                followerReach: results.find(r => r.platform === p.platform)?.followerReach || 0,
                nonFollowerReach: results.find(r => r.platform === p.platform)?.nonFollowerReach || 0,
                engagement: (p.platform === 'INSTAGRAM' || p.platform === 'FACEBOOK' || p.platform === 'YOUTUBE')
                    ? (results.find(r => r.platform === p.platform)?.accountEngagement || (stats._sum.likes || 0) + (stats._sum.comments || 0) + (stats._sum.shares || 0) + (stats._sum.saves || 0))
                    : ((stats._sum.likes || 0) + (stats._sum.comments || 0) + (stats._sum.shares || 0) + (stats._sum.saves || 0))
            };
        });

        const topCities = Object.entries(aggregated.cities)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        const topCountries = Object.entries(aggregated.countries)
            .map(([name, value]) => ({ name, code: name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        return {
            topCities,
            topCountries,
            activityHeatmap: realHeatmap || this.generateMockHeatmap(),
            platformBreakdown: aggregated.platforms,
            reachByCity: aggregated.reachByCity,
            reachByCountry: aggregated.reachByCountry,
            reachByGender: aggregated.reachByGender,
            debug: aggregated.debug
        };
    }

    private static generateMockHeatmap() {
        // Generate a 7x24 grid with some "peaks"
        const data = [];
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                // Peak around 9am-11am and 6pm-9pm
                let base = Math.random() * 20;
                if ((h >= 9 && h <= 11) || (h >= 18 && h <= 21)) base += 50;
                // Weekends higher?
                if (d === 0 || d === 6) base += 20;

                data.push({ day: d, hour: h, value: Math.floor(base) });
            }
        }
        return data;
    }
}
