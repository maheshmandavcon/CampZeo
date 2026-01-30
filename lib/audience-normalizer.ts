
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
    // Detailed follower demographics for Charts
    followerCity?: Record<string, number>;
    followerCountry?: Record<string, number>;
    followerGender?: Record<string, number>;
    followerAge?: Record<string, number>;
    // Per-platform cleaned demographics
    platformDemographics?: Record<string, {
        city: Record<string, number>;
        country: Record<string, number>;
        gender: Record<string, number>;
        age: Record<string, number>;
        devices?: Record<string, number>;
        interests?: Record<string, number>;
        trafficSources?: any[];
    }>;
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
                    // Merge _rawResponses to prevent overwriting demographic debug info
                    const mergedRaw = [
                        ...(data._rawResponses || []),
                        ...(accountData._rawResponses || [])
                    ];
                    return {
                        platform: 'YOUTUBE',
                        data: {
                            ...data,
                            ...accountData,
                            _rawResponses: mergedRaw
                        }
                    };
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
                postId: { in: allPlatformPostIds }
                // Removed isDeleted: false to include historical metrics for deleted content
            }
        });

        const engagementStats = await prisma.postInsight.groupBy({
            by: ['platform'],
            where: {
                postId: { in: allPlatformPostIds }
                // Removed isDeleted: false to include historical metrics for deleted content
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

    public static calculateRealHeatmap(transactions: { postId: string, publishedAt: Date | null }[], insights: any[]) {
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

        // Always return the grid, even if zero. The UI will handle mock fallback if needed.
        // Returning a zeroed grid allows us to show an empty heatmap for filtered views with no data.

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
            // Per-platform cleaned demographics
            platformDemographics: {} as Record<string, any>,
            // Debug data - always initialize
            debug: {
                facebook: {} as any,
                instagram: {} as any,
                youtube: {} as any,
                linkedin: {} as any,
                pinterest: {} as any
            } as any
        };

        results.forEach(res => {
            if (res.error) return;

            const platKey = res.platform.toLowerCase();
            // Initialize platform demographics object
            aggregated.platformDemographics[platKey] = {
                city: {},
                country: {},
                gender: {},
                age: {}
            };

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
                // Store platform demographics
                aggregated.platformDemographics[platKey].city = data.followerCity || data.audienceCity || {};
                aggregated.platformDemographics[platKey].country = data.followerCountry || data.audienceCountry || {};
                aggregated.platformDemographics[platKey].gender = data.followerGender || {};
                aggregated.platformDemographics[platKey].age = data.followerAge || {};

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

                // YouTube sends percentages, we need to map names for 'ALL'
                const ytCountryRaw = res.data?.demographics?.country || {};
                const ytCityRaw = res.data?.demographics?.city || {};

                // Map country codes to names for YouTube's platform tab
                Object.entries(ytCountryRaw).forEach(([code, pct]) => {
                    let name = code;
                    try { if (code.length === 2) name = countryNames.of(code) || code; } catch (e) { }
                    aggregated.platformDemographics[platKey].country[name] = (pct as number);
                });
                aggregated.platformDemographics[platKey].city = ytCityRaw;
                aggregated.platformDemographics[platKey].gender = res.data?.demographics?.gender || {};
                aggregated.platformDemographics[platKey].age = res.data?.demographics?.ageGroup || {};
                aggregated.platformDemographics[platKey].trafficSources = res.data?.trafficSources || [];

                Object.entries(res.data?.demographics?.country || {}).forEach(([k, v]) => {
                    const views = res.data?._rawResponses?.find((r: any) => r.label === 'demographics_country')?.data?.rows?.find((row: any) => row[0] === k)?.[1] || 0;
                    aggregated.countries[k] = (aggregated.countries[k] || 0) + views;
                    aggregated.reachByCountry[k] = (aggregated.reachByCountry[k] || 0) + views;
                });
                Object.entries(res.data?.demographics?.city || {}).forEach(([k, v]) => {
                    const views = res.data?._rawResponses?.find((r: any) => r.label === 'demographics_city')?.data?.rows?.find((row: any) => row[0] === k)?.[1] || 0;
                    aggregated.cities[k] = (aggregated.cities[k] || 0) + views;
                    aggregated.reachByCity[k] = (aggregated.reachByCity[k] || 0) + views;
                });
                res.accountReach = res.data?.views || 0;
                res.profileViews = res.data?.views || 0;
                // Add traffic sources to debug if available
                if (res.data?.trafficSources) {
                    if (!aggregated.debug.youtube) aggregated.debug.youtube = {};
                    aggregated.debug.youtube.trafficSources = res.data.trafficSources;
                }
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
                        aggregated.platformDemographics[platKey].country = data.demographics.locations;
                    }

                    // Metros/Cities
                    if (data.demographics.cities) {
                        Object.entries(data.demographics.cities).forEach(([k, v]) => {
                            const ratio = v as number;
                            aggregated.cities[k] = (aggregated.cities[k] || 0) + (ratio * (followers || 1000));
                            aggregated.reachByCity[k] = (aggregated.reachByCity[k] || 0) + (ratio * (followers || 1000));
                        });
                        aggregated.platformDemographics[platKey].city = data.demographics.cities;
                    }

                    // Genders
                    if (data.demographics.genders) {
                        Object.entries(data.demographics.genders).forEach(([k, v]) => {
                            const lowerK = k.toLowerCase();
                            const genderKey = lowerK.includes('female') ? 'female' :
                                lowerK.includes('male') ? 'male' : 'unknown';
                            const ratio = v as number;
                            aggregated.reachByGender[genderKey] = (aggregated.reachByGender[genderKey] || 0) + (ratio * (followers || 1000));
                        });
                        aggregated.platformDemographics[platKey].gender = data.demographics.genders;
                    }

                    // Ages
                    if (data.demographics.ages) {
                        aggregated.platformDemographics[platKey].age = data.demographics.ages;
                    }

                    // Devices
                    if (data.demographics.devices) {
                        const devices: Record<string, number> = {};
                        Object.entries(data.demographics.devices).forEach(([k, v]) => {
                            devices[k] = (v as number) * (followers || 1000);
                        });
                        aggregated.platformDemographics[platKey].devices = devices;
                    }

                    // Interests (Categories)
                    if (data.categories) {
                        const interests: Record<string, number> = {};
                        Object.entries(data.categories).forEach(([k, v]) => {
                            interests[k] = (v as number) * (followers || 1000);
                        });
                        aggregated.platformDemographics[platKey].interests = interests;
                    }
                }
            }

            // Collect raw responses for debugging - keyed by label
            if (res.data?._rawResponses && Array.isArray(res.data._rawResponses)) {
                const platKey = res.platform.toLowerCase();

                // Initialize as object if it doesn't exist or was initialized as array
                if (!aggregated.debug[platKey] || Array.isArray(aggregated.debug[platKey])) {
                    aggregated.debug[platKey] = {};
                }

                res.data._rawResponses.forEach((item: any) => {
                    if (item.label) {
                        aggregated.debug[platKey][item.label] = item;
                    } else {
                        // Fallback for unlabeled items
                        const idx = Object.keys(aggregated.debug[platKey]).length;
                        aggregated.debug[platKey][`item_${idx}`] = item;
                    }
                });
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

        const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
        const mappedCountries: Record<string, number> = {};

        // Map country codes to full names
        Object.entries(aggregated.countries).forEach(([code, value]) => {
            let name = code;
            try {
                if (code.length === 2 || code.length === 3) {
                    name = countryNames.of(code) || code;
                }
            } catch (e) {
                // Fallback
            }
            mappedCountries[name] = (mappedCountries[name] || 0) + (value as number);
        });

        const topCountries = Object.entries(mappedCountries)
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
            // Pass through aggregated raw demographics for the new UI tabs
            followerCity: aggregated.cities,
            followerCountry: mappedCountries, // Use the mapped country names
            // For gender/age, we might need a more complex aggregation if multiple platforms provide it, 
            // but for now, we'll try to aggregate what we can or pass the raw Instagram one if generic aggregation is hard.
            // Let's rely on the aggregated.reachBy... for now but mapped to the keys the UI expects?
            // Actually, the UI expects "M.18-24" format for the Age chart. 
            // Only Instagram provides this detailed breakdown easily. Facebook provides it too.
            // Let's try to pass an aggregated object.
            // Better approach: Use the explicit gender/age from Instagram since we just added it
            followerGender: this.aggregateGender(results),
            followerAge: this.aggregateAge(results),

            platformDemographics: aggregated.platformDemographics,
            debug: aggregated.debug
        };
    }

    private static aggregateGender(results: any[]): Record<string, number> {
        const aggregated: Record<string, number> = {};
        results.forEach(res => {
            if (res.error) return;
            let data = res.data;
            let source = {};
            if (res.platform === 'INSTAGRAM') {
                source = data.followerGender || {};
            } else if (res.platform === 'YOUTUBE') {
                // Map YouTube gender (female, male) to standard (F, M)
                const ytGender = data.demographics?.gender || {};
                const mapped: Record<string, number> = {};
                Object.entries(ytGender).forEach(([k, v]) => {
                    const lowerK = k.toLowerCase();
                    const key = lowerK === 'female' ? 'F' : lowerK === 'male' ? 'M' : 'U';
                    mapped[key] = (mapped[key] || 0) + (v as number / 100 * (res.data?.totalSubscribers || 1000));
                });
                source = mapped;
            } else if (res.platform === 'PINTEREST') {
                const pinGender = data.demographics?.genders || {};
                const mapped: Record<string, number> = {};
                Object.entries(pinGender).forEach(([k, v]) => {
                    const lowerK = k.toLowerCase();
                    const key = lowerK.includes('female') ? 'F' : lowerK.includes('male') ? 'M' : 'U';
                    mapped[key] = (mapped[key] || 0) + (v as number * (res.data?.totalFollowers || 1000));
                });
                source = mapped;
            }
            // Add to aggregate
            Object.entries(source).forEach(([k, v]) => aggregated[k] = (aggregated[k] || 0) + (v as number));
        });
        return aggregated;
    }

    private static aggregateAge(results: any[]): Record<string, number> {
        const aggregated: Record<string, number> = {};
        results.forEach(res => {
            if (res.error) return;
            let data = res.data;
            let source = {};
            if (res.platform === 'INSTAGRAM') {
                source = data.followerAge || {};
            } else if (res.platform === 'YOUTUBE') {
                // Map YouTube age (age13-17) to standard (13-17)
                const ytAge = data.demographics?.ageGroup || {};
                const mapped: Record<string, number> = {};
                Object.entries(ytAge).forEach(([k, v]) => {
                    const key = k.replace('age', '');
                    mapped[key] = (mapped[key] || 0) + (v as number / 100 * (res.data?.totalSubscribers || 1000));
                });
                source = mapped;
            } else if (res.platform === 'PINTEREST') {
                const pinAge = data.demographics?.ages || {};
                const mapped: Record<string, number> = {};
                Object.entries(pinAge).forEach(([k, v]) => {
                    // Pinterest ages are usually "18-24", "25-34" etc.
                    mapped[k] = (mapped[k] || 0) + (v as number * (res.data?.totalFollowers || 1000));
                });
                source = mapped;
            }
            Object.entries(source).forEach(([k, v]) => aggregated[k] = (aggregated[k] || 0) + (v as number));
        });
        return aggregated;
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
