'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, MapPin, Clock, Globe, BarChart3, TrendingUp, ThumbsUp, MessageSquare, Eye, AlertCircle, TrendingDown, Target, Zap, Archive, Activity, ChevronsLeft, ChevronsRight, LayoutList, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    LabelList
} from 'recharts';
import { UnifiedAudienceData } from '@/lib/audience-normalizer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface PostAnalyticsData {
    campaigns: { id: number; name: string }[];
    campaignMetrics: {
        id: number;
        name: string;
        likes: number;
        comments: number;
        reach: number;
        impressions: number;
        engagement: number;
        isDeleted?: boolean;
    }[];
    totalStats: {
        likes: number;
        comments: number;
        reach: number;
        impressions: number;
        saves: number;
        shares: number;
        videoViews: number;
    };
    posts: { // Renamed from postData to posts
        id: number;
        postId: string;
        platform: string;
        message: string;
        campaignName: string;
        campaignId?: string | number;
        likes: number;
        comments: number;
        reach: number;
        impressions: number;
        saves: number;
        shares: number;
        videoViews: number;
        engagementRate: number;
        publishedAt: string;
        isDeleted?: boolean;
        mediaUrls?: string | string[] | null;
    }[];
    trends: { date: string; engagement: number }[];
    activityHeatmap?: { day: number; hour: number; value: number }[];
    totalCount: number;
    totalPages: number;
    lastSync: string;
}

const PLATFORM_COLORS: Record<string, string> = {
    FACEBOOK: '#1877F2',
    INSTAGRAM: '#E4405F',
    LINKEDIN: '#0A66C2',
    YOUTUBE: '#FF0000',
    PINTEREST: '#BD081C',
    all: '#3b82f6'
};

export default function ReportsPage() {
    const [data, setData] = useState<UnifiedAudienceData | null>(null);
    const [loading, setLoading] = useState(true);

    // Post Performance State
    const [postData, setPostData] = useState<PostAnalyticsData | null>(null);
    const [campaignId, setCampaignId] = useState<string>('all');
    const [platform, setPlatform] = useState<string>('all');
    const [postsLoading, setPostsLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    // Sorting State
    const [sortBy, setSortBy] = useState<string>('engagement');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Nested Performance Mode
    const [perfSubMode, setPerfSubMode] = useState<'overview' | 'campaigns'>('overview');
    const [battleA, setBattleA] = useState<string>('all');
    const [battleB, setBattleB] = useState<string>('all');

    // Split View State
    const [selectedPostId, setSelectedPostId] = useState<string | number | null>(null);
    const [postGraphType, setPostGraphType] = useState<'pie' | 'bar'>('pie');
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
    const [selectedLinkedInOrg, setSelectedLinkedInOrg] = useState<string>('all');

    // Demographics State
    const [demoCategory, setDemoCategory] = useState<'country' | 'city' | 'gender' | 'age' | 'trafficSources'>('country');
    const [demoPlatform, setDemoPlatform] = useState<string>('ALL');

    const demoSourceData = useMemo(() => {
        let sourceData: Record<string, number> = {};

        const platformKey = demoPlatform.toLowerCase();
        const pDemo = (data as any)?.platformDemographics?.[platformKey];

        if (demoPlatform !== 'ALL' && pDemo) {
            if (demoCategory === 'trafficSources') {
                const mapping: Record<string, string> = {
                    'SHORTS': 'YouTube Shorts', 'YT_SEARCH': 'YouTube Search', 'YT_CHANNEL': 'Channel Page',
                    'SUBSCRIBER': 'Subscribers Feed', 'EXT_URL': 'External Source', 'PLAYLIST': 'YouTube Playlist',
                    'NO_LINK_OTHER': 'Direct / Other', 'RELATED_VIDEO': 'Related Videos', 'BROWSE_FEATURE': 'Home / Browse',
                    'ANNOTATION': 'Annotations'
                };
                (pDemo.trafficSources || []).forEach((row: any) => {
                    const key = mapping[row[0]] || row[0];
                    sourceData[key] = (sourceData[key] || 0) + (row[1] || 0);
                });
            } else {
                if (platformKey === 'linkedin' && selectedLinkedInOrg !== 'all') {
                    const orgData = (data as any)?.platformDemographics?.linkedin?.organizations?.find((o: any) => o.urn === selectedLinkedInOrg);
                    if (orgData) {
                        const orgStats = orgData.data || {};
                        if (demoCategory === 'country') {
                            const rawGeo = orgStats.followerGeography || {};
                            const normalizedGeo: Record<string, number> = {};
                            Object.entries(rawGeo).forEach(([k, v]) => {
                                const code = k.startsWith('urn:li:country:') ? k.replace('urn:li:country:', '').toUpperCase() : k;
                                normalizedGeo[code] = Number(v) || 0;
                            });
                            sourceData = normalizedGeo;
                        } else if (demoCategory === 'industry') {
                            sourceData = orgStats.followerIndustry || {};
                        } else if (demoCategory === 'seniority') {
                            sourceData = orgStats.followerSeniority || {};
                        } else if (demoCategory === 'function') {
                            sourceData = orgStats.followerFunction || {};
                        } else {
                            sourceData = pDemo[demoCategory] || {};
                        }
                    } else {
                        sourceData = pDemo[demoCategory] || {};
                    }
                } else {
                    sourceData = pDemo[demoCategory] || {};
                }
            }
        } else if (demoPlatform === 'ALL') {
            if (demoCategory === 'country') sourceData = data?.followerCountry || {};
            else if (demoCategory === 'city') sourceData = data?.followerCity || {};
            else if (demoCategory === 'gender') sourceData = data?.followerGender || {};
            else if (demoCategory === 'age') sourceData = data?.followerAge || {};
        }

        const total = Object.values(sourceData).reduce((a, b) => a + (Number(b) || 0), 0);
        const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

        const rows = Object.entries(sourceData)
            .map(([key, val]) => {
                let label = key;
                if (demoCategory === 'country') {
                    try { if (key.length === 2) label = countryNames.of(key) || key; } catch (e) { }
                }
                if (demoCategory === 'gender') {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey === 'f' || lowerKey === 'female') label = 'Female';
                    else if (lowerKey === 'm' || lowerKey === 'male') label = 'Male';
                    else if (lowerKey === 'u' || lowerKey === 'unknown' || lowerKey === 'gender_other') label = 'Other';
                }
                if (demoCategory === 'age' && key.startsWith('age')) {
                    label = key.replace('age', '');
                }
                return { key, label, val: demoPlatform === 'all' ? (Math.floor(Number(val)) || 0) : (Number(val) || 0) };
            })
            .sort((a, b) => b.val - a.val);

        return { rows, total };
    }, [data, demoCategory, demoPlatform, selectedLinkedInOrg]);

    const filteredPlatformBreakdown = useMemo(() => {
        if (!data?.platformBreakdown) return [];
        return data.platformBreakdown.map(p => {
            if (p.platform === 'LINKEDIN' && selectedLinkedInOrg !== 'all') {
                const orgData = (data as any)?.platformDemographics?.linkedin?.organizations?.find((o: any) => o.urn === selectedLinkedInOrg);
                if (orgData) {
                    return {
                        ...p,
                        followers: orgData.data?.followerCounts?.total || 0,
                        likes: orgData.projectEngagement?.likes || 0,
                        comments: orgData.projectEngagement?.comments || 0,
                        posts: orgData.projectEngagement?.posts || 0,
                        reach: orgData.projectEngagement?.reach || 0,
                        impressions: orgData.projectEngagement?.impressions || 0,
                        engagement: (orgData.projectEngagement?.likes || 0) + (orgData.projectEngagement?.comments || 0)
                    };
                }
            }
            return p;
        });
    }, [data, selectedLinkedInOrg]);

    const campaignStats = useMemo(() => {
        if (!postData?.campaignMetrics) return [];
        return [...postData.campaignMetrics].sort((a, b) => b.impressions - a.impressions);
    }, [postData]);

    const contenders = useMemo(() => {
        if (campaignStats.length < 2) return null;

        if (campaignId === 'all') {
            const activeStats = campaignStats.filter(c => !c.isDeleted);
            if (activeStats.length < 2) return null;
            return {
                a: activeStats[0],
                b: activeStats[activeStats.length - 1],
                labelA: 'Top Performer',
                labelB: 'Needs Attention',
                subA: 'Highest Impression Velocity',
                subB: 'Low Audience Retention'
            };
        }

        const selectedIndex = campaignStats.findIndex((c: any) => String(c.id) === String(campaignId) || c.name === campaignId);
        if (selectedIndex === -1) return null;

        if (selectedIndex === 0) {
            return {
                a: campaignStats[0],
                b: campaignStats[1],
                labelA: 'Selected Leader',
                labelB: 'Closest Rival',
                subA: 'Current Rank: #1',
                subB: 'Runner-up Performance'
            };
        } else if (selectedIndex === campaignStats.length - 1) {
            return {
                a: campaignStats[selectedIndex],
                b: campaignStats[selectedIndex - 1],
                labelA: 'Selected Context',
                labelB: 'Next Target',
                subA: 'Current Bottom Rank',
                subB: 'Aspirational Benchmark'
            };
        } else {
            return {
                a: campaignStats[selectedIndex],
                b: campaignStats[0],
                labelA: 'Selected Status',
                labelB: 'Industry Best',
                subA: `Ranked #${selectedIndex + 1}`,
                subB: 'Target Efficiency Level'
            };
        }
    }, [campaignStats, campaignId]);

    const platformShareData = useMemo(() => {
        if (!postData?.posts) return [];
        const platforms: Record<string, { name: string, value: number, fill: string }> = {};

        postData.posts.forEach(p => {
            if (!platforms[p.platform]) {
                platforms[p.platform] = {
                    name: p.platform,
                    value: 0,
                    fill: PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.all
                };
            }
            // Use Reach as primary volume metric for Omni-channel share
            platforms[p.platform].value += (p.reach || 0);
        });

        return Object.values(platforms).sort((a, b) => b.value - a.value);
    }, [postData]);

    useEffect(() => {
        const refreshToken = async () => {
            try {
                console.log('[Reports] Triggering automatic token refresh...');
                const response = await fetch('/api/socialmedia/refresh', { method: 'POST' });
                if (!response.ok) {
                    console.warn('[Reports] Token refresh failed');
                } else {
                    console.log('[Reports] Tokens refreshed successfully');
                }
            } catch (error) {
                console.error('[Reports] Error during token refresh:', error);
            }
        };

        refreshToken();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/analytics/audience');
                if (!response.ok) throw new Error('Failed to fetch audience data');
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error('Error fetching reports:', error);
                toast.error('Failed to load audience reports');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const fetchPostPerformance = async (page: number = 1) => {
        setPostsLoading(true);
        try {
            const params = new URLSearchParams();
            if (campaignId !== 'all') params.append('campaignId', campaignId);
            if (platform !== 'all') params.append('platform', platform);
            if (platform === 'LINKEDIN' && selectedLinkedInOrg !== 'all') params.append('accountId', selectedLinkedInOrg);
            params.append('page', page.toString());
            params.append('limit', itemsPerPage.toString());
            params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);

            const response = await fetch(`/api/analytics/reports/posts?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch post analytics');
            const result = await response.json();
            setPostData(result);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error fetching post performance:', error);
            toast.error('Failed to load post performance data');
        } finally {
            setPostsLoading(false);
        }
    };

    const handleManualSync = async () => {
        setSyncing(true);
        toast.info("Syncing metrics from all platforms...");
        try {
            const response = await fetch('/api/analytics/sync-all');
            if (!response.ok) throw new Error('Sync failed');
            toast.success("Metrics synchronized successfully!");
            fetchPostPerformance(1);
        } catch (error) {
            console.error('Sync error:', error);
            toast.error("Failed to sync metrics");
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchPostPerformance(1);
    }, [campaignId, platform, sortBy, sortOrder, selectedLinkedInOrg]);

    const paginatedPosts = postData?.posts || [];
    const totalPages = postData?.totalPages || 0;

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading audience intelligence...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-6">
                <h1 className="text-3xl font-bold tracking-tight mb-6">Audience Reports</h1>
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        No data available. Please connect your social accounts.
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Heatmap formatting
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmapGrid = Array(7).fill(0).map(() => Array(24).fill(0));

    // Use filtered heatmap from postData if available, otherwise fallback to global audience data
    const activeHeatmapData = postData?.activityHeatmap || data.activityHeatmap;

    activeHeatmapData.forEach(p => {
        if (heatmapGrid[p.day]) heatmapGrid[p.day][p.hour] = p.value;
    });

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50/50  space-y-6 md:space-y-8 animate-in fade-in duration-500">
            {/* Header with Glassmorphism Effect */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 p-4 md:p-6 rounded-3xl bg-white/70  backdrop-blur-xl border border-white/20 ">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500  bg-clip-text text-transparent">
                        Social Intelligence
                    </h1>
                    <p className="text-slate-500  mt-2 font-medium flex items-center gap-2">
                        <Clock className="size-4" />
                        Last synced: {postData?.lastSync ? new Date(postData.lastSync).toLocaleString() : 'Just now'}
                    </p>
                </div>
                <button
                    onClick={handleManualSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900  text-white  font-bold hover:scale-105 transition-all active:scale-95 disabled:opacity-50 border border-white/20 "
                >
                    {syncing ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
                    {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
            </div>

            <Tabs defaultValue="performance" className="space-y-6 md:space-y-8">
                <div className="w-full overflow-x-auto overflow-y-hidden pb-2 -mb-2 no-scrollbar">
                    <TabsList className="p-1 h-auto min-h-[48px] bg-white/50  backdrop-blur-md rounded-2xl border border-slate-200 flex w-max md:inline-flex">
                        <TabsTrigger value="performance" className="flex gap-2 rounded-xl px-4 md:px-6 py-2 data-[state=active]:bg-white  data-[state=active]:shadow-md transition-all whitespace-nowrap text-xs md:text-sm"><BarChart3 className="size-4" /> Post Performance</TabsTrigger>
                        <TabsTrigger value="activity" className="flex gap-2 rounded-xl px-4 md:px-6 py-2 data-[state=active]:bg-white  data-[state=active]:shadow-md transition-all whitespace-nowrap text-xs md:text-sm"><Clock className="size-4" /> Activity Patterns</TabsTrigger>
                        <TabsTrigger value="networks" className="flex gap-2 rounded-xl px-4 md:px-6 py-2 data-[state=active]:bg-white  data-[state=active]:shadow-md transition-all whitespace-nowrap text-xs md:text-sm"><Users className="size-4" /> Network Insights</TabsTrigger>
                        <TabsTrigger value="demographics" className="flex gap-2 rounded-xl px-4 md:px-6 py-2 data-[state=active]:bg-white  data-[state=active]:shadow-md transition-all whitespace-nowrap text-xs md:text-sm"><Globe className="size-4" /> Demographics</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="networks" className="space-y-8 animate-in fade-in duration-500">
                    {/* Platform Legend & Intelligence Highlights */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-white/50  rounded-3xl backdrop-blur-sm border border-slate-100  shadow-md flex-1">
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                                <div className="flex items-center gap-3">
                                    <div className="size-3 rounded-full bg-slate-400 opacity-60" /> Reach (Audience)
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="size-3 rounded-full bg-slate-400" /> Impact (Engagement)
                                </div>
                                <div className="w-px h-6 bg-slate-200  hidden sm:block" />
                                <div className="flex flex-wrap items-center gap-5">
                                    {Object.entries(PLATFORM_COLORS).filter(([k]) => k !== 'all').map(([name, color]) => (
                                        <div key={name} className="flex items-center gap-2 px-3 py-1 bg-white/50  rounded-full border border-slate-100 ">
                                            <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                                            <span>{name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Top Platform', val: filteredPlatformBreakdown[0]?.platform || 'N/A', icon: Globe, color: 'text-indigo-500' },
                                { label: 'Avg Efficiency', val: '8.4%', icon: TrendingUp, color: 'text-emerald-500' },
                                { label: 'Peak Growth', val: '+12%', icon: Users, color: 'text-blue-500' },
                                { label: 'Sync Status', val: 'Active', icon: Clock, color: 'text-amber-500' }
                            ].map((h, i) => (
                                <Card key={i} className="rounded-2xl border-none shadow-sm bg-indigo-500/5 p-4 flex flex-col justify-center gap-1 min-w-[120px]">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{h.label}</p>
                                    <div className="flex items-center gap-2">
                                        <h.icon className={`size-3 ${h.color}`} />
                                        <p className="text-sm font-black text-slate-900 ">{h.val}</p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* LinkedIn Organization Selector */}
                    {/* {(data as any)?.platformDemographics?.linkedin?.organizations?.length > 1 && (
                        <div className="flex items-center gap-4 p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                                <Users className="size-4" />
                                LinkedIn Focus:
                            </div>
                            <Select value={selectedLinkedInOrg} onValueChange={setSelectedLinkedInOrg}>
                                <SelectTrigger className="w-[280px] h-10 rounded-xl bg-white border-slate-200">
                                    <SelectValue placeholder="Select Organization" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-100">
                                    <SelectItem value="all">All LinkedIn (Aggregate)</SelectItem>
                                    {(data as any).platformDemographics.linkedin.organizations.map((org: any) => (
                                        <SelectItem key={org.urn} value={org.urn}>
                                            {org.name || (org.isDefault ? 'Personal Account' : 'Other Organization')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )} */}

                    <div className="grid gap-8">
                        {/* Platform Distribution Card - Full Width */}
                        <Card className="rounded-3xl border-md shadow-md bg-white/80  backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    <BarChart3 className="size-6 text-indigo-500" /> Platform Distribution
                                </CardTitle>
                                <CardDescription>Audience size and engagement across connected networks</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                {data.platformBreakdown.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={filteredPlatformBreakdown}
                                            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis
                                                dataKey="platform"
                                                tick={{ fontSize: 12, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => val.charAt(0) + val.slice(1).toLowerCase()}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <RechartsTooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                                            <Bar dataKey="followers" name="Audience (Followers)" radius={[6, 6, 0, 0]}>
                                                {filteredPlatformBreakdown.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-aud-${index}`}
                                                        fill={PLATFORM_COLORS[entry.platform]}
                                                        fillOpacity={0.6}
                                                    />
                                                ))}
                                            </Bar>
                                            <Bar dataKey="engagement" name="Engagement (Interactions)" radius={[6, 6, 0, 0]}>
                                                {filteredPlatformBreakdown.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-eng-${index}`}
                                                        fill={PLATFORM_COLORS[entry.platform]}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <Users className="size-12 text-slate-300 mb-4" />
                                        <p className="text-sm text-slate-500">No platform data available</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Platform Wise Detail Cards */}
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredPlatformBreakdown.map((platform) => (
                                <Card key={platform.platform} className="rounded-3xl border-md shadow-md bg-white/90  overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                    <CardHeader className="p-6 pb-2" style={{ backgroundColor: `${PLATFORM_COLORS[platform.platform]}10` }}>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                                                <div className="size-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform.platform] }} />
                                                {platform.platform}
                                            </CardTitle>
                                            {platform.platform === 'LINKEDIN' && (data as any)?.platformDemographics?.linkedin?.organizations?.length > 1 ? (
                                                <Select value={selectedLinkedInOrg} onValueChange={setSelectedLinkedInOrg}>
                                                    <SelectTrigger className="w-[120px] h-7 text-[9px] font-bold rounded-lg bg-white/80 border-slate-200 uppercase tracking-tighter">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-slate-100">
                                                        <SelectItem value="all" className="text-[10px]">Aggregate</SelectItem>
                                                        {(data as any).platformDemographics.linkedin.organizations.map((org: any) => (
                                                            <SelectItem key={org.urn} value={org.urn} className="text-[10px]">
                                                                {org.name || (org.isDefault ? 'Personal' : 'Org')}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest border-slate-200">Live</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Followers</p>
                                                <p className="text-2xl font-black">{platform.followers?.toLocaleString() ?? 0}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Posts</p>
                                                <p className="text-2xl font-black">{platform.posts?.toLocaleString() ?? 0}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-100 " />

                                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                            <div className="flex items-center gap-2">
                                                <ThumbsUp className="size-3.5 text-blue-500" />
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{platform.platform === 'PINTEREST' ? 'Saves' : 'Likes'}</p>
                                                    <p className="text-sm font-bold">{platform.likes?.toLocaleString() ?? 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="size-3.5 text-emerald-500" />
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Comments</p>
                                                    <p className="text-sm font-bold">{platform.comments?.toLocaleString() ?? 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="size-3.5 text-indigo-500" />
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{platform.platform === 'PINTEREST' ? 'Views' : 'Reach'}</p>
                                                    <p className="text-sm font-bold">{platform.reach?.toLocaleString() ?? 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Eye className="size-3.5 text-amber-500" />
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Profile Views</p>
                                                    <p className="text-sm font-bold">{platform.profileViews?.toLocaleString() ?? 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <BarChart3 className="size-3.5 text-purple-500" />
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Video Views</p>
                                                    <p className="text-sm font-bold">{platform.videoViews?.toLocaleString() ?? 0}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {(platform.followerReach !== undefined || platform.nonFollowerReach !== undefined) && (
                                            <div className="pt-2">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-bold text-slate-500">Reach Split (Followers vs Non-Followers)</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100  rounded-full overflow-hidden flex">
                                                    <div
                                                        className="h-full bg-slate-900  transition-all duration-1000"
                                                        style={{
                                                            width: `${(platform.followerReach || 0) + (platform.nonFollowerReach || 0) > 0
                                                                ? ((platform.followerReach || 0) / ((platform.followerReach || 0) + (platform.nonFollowerReach || 0))) * 100
                                                                : 0}%`
                                                        }}
                                                        title={`Followers: ${platform.followerReach?.toLocaleString()}`}
                                                    />
                                                    <div
                                                        className="h-full bg-slate-300  transition-all duration-1000"
                                                        style={{ width: '100%' }}
                                                        title={`Non-Followers: ${platform.nonFollowerReach?.toLocaleString()}`}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-[9px] font-bold text-slate-400">Fans: {platform.followerReach?.toLocaleString() || 0}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">Non-Fans: {platform.nonFollowerReach?.toLocaleString() || 0}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[10px] font-bold text-slate-500">Engagement</span>
                                                <span className="text-[10px] font-black text-indigo-600">{(platform.engagement || 0).toLocaleString()} total</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100  rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000"
                                                    style={{
                                                        width: `${Math.min(((platform.engagement || 0) / (platform.followers || 1)) * 100, 100)}%`,
                                                        backgroundColor: PLATFORM_COLORS[platform.platform]
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </TabsContent>


                {/* Activity Tab */}
                <TabsContent value="activity">
                    <Card className="rounded-3xl border-md shadow-md bg-white/80  backdrop-blur-md overflow-hidden">
                        <CardHeader className="p-8">
                            <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                                <Clock className="size-7 text-red-500" /> Best Time to Post
                            </CardTitle>
                            <CardDescription className="text-base">Activity heatmap showing when your audience is most active across the week</CardDescription>
                        </CardHeader>
                        <CardContent className="px-8 pb-8">
                            {/* Legend */}
                            <div className="flex items-center justify-end gap-3 mb-6">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Less Interaction</span>
                                <div className="flex gap-1 bg-slate-100  p-1 rounded-lg">
                                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((op) => (
                                        <div
                                            key={op}
                                            className="w-6 h-4 rounded-md"
                                            style={{ backgroundColor: `rgb(220 38 38 / ${op})` }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Most Interaction</span>
                            </div>

                            <TooltipProvider>
                                <div className="overflow-x-auto pb-4 scrollbar-thin  lg:overflow-x-hidden">
                                    <div className="min-w-[800px] lg:min-w-full">
                                        {/* Hour Headers */}
                                        <div className="flex mb-4">
                                            <div className="w-20"></div>
                                            {Array.from({ length: 24 }).map((_, i) => (
                                                <div key={i} className="flex-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    {i === 0 ? '12am' : i === 12 ? '12pm' : i > 12 ? `${i - 12}p` : `${i}a`}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Grid */}
                                        {days.map((day, dIndex) => (
                                            <div key={day} className="flex items-center mb-2">
                                                <div className="w-20 text-xs font-bold text-slate-500">{day}</div>
                                                {heatmapGrid[dIndex].map((val, hIndex) => {
                                                    const opacity = Math.min(Math.max(val / 80, 0.05), 1);
                                                    return (
                                                        <Tooltip key={`${dIndex}-${hIndex}`} delayDuration={0}>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className="flex-1 h-10 mx-[2px] rounded-lg transition-all hover:scale-110 hover:shadow-lg hover:z-10 relative cursor-pointer"
                                                                    style={{
                                                                        backgroundColor: `rgb(220 38 38 / ${opacity})`,
                                                                        boxShadow: val > 50 ? `0 0 15px rgb(220 38 38 / ${opacity * 0.5})` : 'none'
                                                                    }}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="bg-slate-950 text-white border-white/10">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-xs font-bold">{day}, {hIndex}:00</span>
                                                                    <span className="text-red-400 font-extrabold">{val} Engagements</span>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </TooltipProvider>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Post Performance Tab */}
                <TabsContent value="performance" className="space-y-8">
                    <div className="flex gap-2 p-1 bg-slate-100/50  rounded-xl w-fit">
                        <button
                            onClick={() => setPerfSubMode('overview')}
                            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${perfSubMode === 'overview' ? 'bg-white  shadow-sm text-slate-900 ' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setPerfSubMode('campaigns')}
                            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${perfSubMode === 'campaigns' ? 'bg-white  shadow-sm text-slate-900 ' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Campaigns
                        </button>
                    </div>

                    {perfSubMode === 'overview' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                            {/* System Intelligence: Contextual Battle Header */}
                            {contenders && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                    {/* Top Performer Card */}
                                    <div className="relative group">
                                        <Card className="rounded-[2.5rem] border-none bg-gradient-to-br from-indigo-500/20 via-blue-500/10 to-transparent p-[2px] shadow-2xl shadow-indigo-500/10 overflow-hidden">
                                            <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))]  " />
                                            <div className="relative bg-white/90  backdrop-blur-xl rounded-[2.4rem] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-white/20">
                                                <div className="space-y-4 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-emerald-500/10 text-emerald-600  border-none text-[10px] font-black uppercase tracking-widest px-3 py-1 flex gap-1.5 items-center">
                                                            <Zap className="size-3" />
                                                            {contenders.labelA}
                                                        </Badge>
                                                        <div className="flex -space-x-1">
                                                            {[1, 2, 3].map(i => (
                                                                <div key={i} className="size-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <Select value={battleA === 'all' ? String(contenders.a.id) : battleA} onValueChange={setBattleA}>
                                                        <SelectTrigger className="w-full h-auto p-0 border-none shadow-none bg-transparent font-black text-3xl text-slate-900  text-left focus:ring-0 hover:text-indigo-600  transition-colors">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-2xl border border-slate-200  shadow-2xl bg-white  backdrop-blur-3xl">
                                                            <SelectItem value="all" className="font-bold">✨ AI Suggested Best</SelectItem>
                                                            {campaignStats.map(s => <SelectItem key={s.id} value={String(s.id)} className="font-medium">{s.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex items-center gap-2">
                                                        <Target className="size-4 text-slate-400" />
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                            {battleA === 'all' ? contenders.subA : 'Manual Analysis Mode'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 bg-slate-50  p-4 rounded-3xl border border-slate-100 ">
                                                    <p className="text-4xl font-black bg-gradient-to-br from-indigo-600 to-blue-500 bg-clip-text text-transparent">
                                                        {(() => {
                                                            const active = battleA === 'all' ? contenders.a : campaignStats.find((s: any) => String(s.id) === String(battleA));
                                                            if (!active || active.impressions === 0) return 0;
                                                            return Math.min(Math.round((active.engagement / active.impressions) * 100), 100);
                                                        })()}%
                                                    </p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Impact Velocity</p>
                                                </div>
                                            </div>
                                        </Card>
                                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-slate-900  text-white  flex items-center justify-center font-black text-sm shadow-2xl z-20 border-4 border-slate-50  hidden md:flex scale-110">
                                            VS
                                        </div>
                                    </div>

                                    {/* Needs Attention Card */}
                                    <Card className="rounded-[2.5rem] border-none bg-gradient-to-br from-rose-500/20 via-orange-500/10 to-transparent p-[2px] shadow-2xl shadow-rose-500/10 overflow-hidden">
                                        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))]  " />
                                        <div className="relative bg-white/90  backdrop-blur-xl rounded-[2.4rem] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-white/20">
                                            <div className="space-y-4 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-rose-500/10 text-rose-600  border-none text-[10px] font-black uppercase tracking-widest px-3 py-1 flex gap-1.5 items-center">
                                                        <AlertCircle className="size-3" />
                                                        {contenders.labelB}
                                                    </Badge>
                                                    <TrendingDown className="size-4 text-rose-500 animate-bounce" />
                                                </div>
                                                <Select value={battleB === 'all' ? String(contenders.b.id) : battleB} onValueChange={setBattleB}>
                                                    <SelectTrigger className="w-full h-auto p-0 border-none shadow-none bg-transparent font-black text-3xl text-slate-900  text-left focus:ring-0 hover:text-rose-600  transition-colors">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl border border-slate-200  shadow-2xl bg-white  backdrop-blur-3xl">
                                                        <SelectItem value="all" className="font-bold">⚠️ Contextual Focus</SelectItem>
                                                        {campaignStats.map(s => <SelectItem key={s.id} value={String(s.id)} className="font-medium">{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="size-4 text-slate-400" />
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                        {battleB === 'all' ? contenders.subB : 'Rival Benchmark'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 bg-slate-50  p-4 rounded-3xl border border-slate-100 ">
                                                <p className="text-4xl font-black bg-gradient-to-br from-rose-600 to-orange-500 bg-clip-text text-transparent">
                                                    {(() => {
                                                        const active = battleB === 'all' ? contenders.b : campaignStats.find((s: any) => String(s.id) === String(battleB));
                                                        if (!active || active.impressions === 0) return 0;
                                                        return Math.min(Math.round((active.engagement / active.impressions) * 100), 100);
                                                    })()}%
                                                </p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Efficiency Gap</p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* Summary Stats Cards */}
                            <TooltipProvider>
                                <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
                                    {[
                                        { label: platform === 'PINTEREST' ? 'Total Saves' : 'Total Likes', val: postData?.totalStats.likes, icon: ThumbsUp, color: 'text-blue-500', bg: 'bg-blue-50', tip: platform === 'PINTEREST' ? 'Total saves across Pinterest posts' : 'Total likes across all filtered posts' },
                                        { label: 'Comments', val: postData?.totalStats.comments, icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-50', tip: 'Total comments and replies' },
                                        { label: 'Impressions', val: postData?.totalStats.impressions, icon: Eye, color: 'text-amber-500', bg: 'bg-amber-50', tip: 'Number of times your content was displayed' },
                                        { label: platform === 'PINTEREST' ? 'Avg Views' : 'Avg Reach', val: postData && postData.posts.length > 0 ? Math.round(postData.totalStats.reach / Math.max(postData.totalCount, 1)) : 0, icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50', tip: platform === 'PINTEREST' ? 'Average views per Pinterest post' : 'Average unique users reached per post' }
                                    ].map((stat, i) => (
                                        <Tooltip key={i} delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <Card className="rounded-3xl border-md shadow-md bg-white border-l-4 overflow-hidden cursor-pointer transition-all hover:shadow-lg" style={{ borderLeftColor: i === 0 ? '#3b82f6' : i === 1 ? '#10b981' : i === 2 ? '#f59e0b' : '#6366f1' }}>
                                                    <CardHeader className="pb-2">
                                                        <div className="flex items-center justify-between">
                                                            <stat.icon className={`size-5 ${stat.color}`} />
                                                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight">Total</Badge>
                                                        </div>
                                                        <CardTitle className="text-sm font-bold text-slate-500  pt-2 uppercase tracking-wide">
                                                            {stat.label}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="text-3xl font-black text-slate-900 ">
                                                            {stat.val?.toLocaleString() || 0}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </TooltipTrigger>
                                            <TooltipContent className="rounded-xl bg-slate-900 text-white font-bold p-3 border-none shadow-2xl">
                                                {stat.tip}
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </div>
                            </TooltipProvider>

                            {/* Filters & Actions */}
                            <div className="flex flex-col lg:flex-row gap-6">
                                <Card className="flex-1 rounded-3xl border-md shadow-md bg-white/80  backdrop-blur-md">
                                    <CardContent className="p-4 md:p-6 flex flex-wrap items-start md:items-end gap-4 md:gap-6">
                                        <div className="space-y-2 flex-1 min-w-[240px]">
                                            <label className="text-sm font-bold text-slate-700  ml-1">Filter by Campaign</label>
                                            <Select value={campaignId} onValueChange={setCampaignId}>
                                                <SelectTrigger className="h-12 rounded-2xl bg-slate-50  border-1 border shadow-inner ring-offset-2 focus:ring-2 focus:ring-slate-900 ">
                                                    <SelectValue placeholder="All Campaigns" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-none shadow-md max-h-[400px]">
                                                    <SelectItem value="all" className="font-bold">Total Organisation View</SelectItem>

                                                    {postData?.campaigns.some((c: any) => !c.isDeleted) && (
                                                        <>
                                                            <div className="px-2 py-1.5 text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-50  my-1 rounded-md">
                                                                Active Campaigns
                                                            </div>
                                                            {postData?.campaigns.filter((c: any) => !c.isDeleted).map(c => (
                                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                            ))}
                                                        </>
                                                    )}

                                                    {postData?.campaigns.some((c: any) => c.isDeleted) && (
                                                        <>
                                                            <div className="px-2 py-1.5 text-xs font-black uppercase tracking-widest text-rose-400 bg-rose-50/50  my-1 rounded-md mt-4">
                                                                Archived / Deleted
                                                            </div>
                                                            {postData?.campaigns.filter((c: any) => c.isDeleted).map(c => (
                                                                <SelectItem key={c.id} value={c.id.toString()} className="text-slate-400 italic">
                                                                    {c.name} (Deleted)
                                                                </SelectItem>
                                                            ))}
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 flex-1 min-w-[240px]">
                                            <label className="text-sm font-bold text-slate-700  ml-1">Filter by Platform</label>
                                            <Select value={platform} onValueChange={setPlatform}>
                                                <SelectTrigger className="h-12 rounded-2xl bg-slate-50  border-1 border shadow-inner">
                                                    <SelectValue placeholder="All Platforms" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-none shadow-md">
                                                    <SelectItem value="all">Omnichannel Overview</SelectItem>
                                                    <SelectItem value="FACEBOOK">Facebook</SelectItem>
                                                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                                                    <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                                                    <SelectItem value="YOUTUBE">YouTube</SelectItem>
                                                    <SelectItem value="PINTEREST">Pinterest</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 flex-1 min-w-[240px]">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Sort By</label>
                                            <Select value={sortBy} onValueChange={(val) => setSortBy(val)}>
                                                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-1 border shadow-inner ring-offset-2 focus:ring-2 focus:ring-slate-900">
                                                    <SelectValue placeholder="Sort Order" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-none shadow-md">
                                                    <SelectItem value="engagement" className="font-bold">🔥 Highest Impact</SelectItem>
                                                    <SelectItem value="publishedAt" className="font-bold">🕒 Newest First</SelectItem>
                                                    <SelectItem value="likes" className="font-medium">👍 Most Likes</SelectItem>
                                                    <SelectItem value="reach" className="font-medium">👀 Highest Reach</SelectItem>
                                                    <SelectItem value="impressions" className="font-medium">📊 Most Impressions</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Performance Split View (70/30) */}
                            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                                {/* 70% Column: Content Table */}
                                <Card className="lg:col-span-7 rounded-4xl border-md shadow-xl bg-white  overflow-hidden flex flex-col">
                                    <CardHeader className="p-8 border-b border-slate-50 ">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-2xl font-bold">Content Deep-Dive</CardTitle>
                                                <CardDescription>Click a row to analyze specific performance</CardDescription>
                                            </div>
                                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                                <button
                                                    onClick={() => setViewMode('table')}
                                                    className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                                                    title="List View"
                                                >
                                                    <LayoutList className="size-4" />
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('card')}
                                                    className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                                                    title="Card View"
                                                >
                                                    <LayoutGrid className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 flex-1">
                                        {postsLoading ? (
                                            <div className="flex h-[400px] items-center justify-center">
                                                <Loader2 className="h-10 w-10 animate-spin text-slate-900 " />
                                            </div>
                                        ) : postData && postData.posts.length > 0 ? (
                                            <div className="flex flex-col h-full">
                                                <div className="overflow-x-auto border-t border-slate-50 ">
                                                    {viewMode === 'table' ? (
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-slate-50/50  border-none hover:bg-slate-50/50">
                                                                    <TableHead className="px-8 py-5 text-slate-500 font-bold uppercase text-[10px] tracking-widest min-w-[300px]">Content</TableHead>
                                                                    <TableHead className="py-5 text-slate-500 font-bold uppercase text-[10px] tracking-widest">Network</TableHead>
                                                                    <TableHead className="py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">{platform === 'PINTEREST' ? 'Views' : 'Reach'}</TableHead>
                                                                    <TableHead className="px-8 py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Impact</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {paginatedPosts.map((post) => (
                                                                    <TableRow
                                                                        key={post.id}
                                                                        className={`border-slate-50  transition-colors cursor-pointer group ${selectedPostId === post.id ? 'bg-indigo-50/50 ' : 'hover:bg-slate-50/80 '}`}
                                                                        onClick={() => setSelectedPostId(selectedPostId === post.id ? null : post.id)}
                                                                    >
                                                                        <TableCell className="px-8 py-5">
                                                                            <div className="flex flex-col gap-1 max-w-[400px]">
                                                                                <span className={`font-bold transition-colors ${selectedPostId === post.id ? 'text-indigo-600' : 'text-slate-900 '} line-clamp-1`}>
                                                                                    {post.message || 'Media Content'}
                                                                                </span>
                                                                                <div className="flex items-center gap-2">
                                                                                    <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0 rounded-md uppercase shrink-0">
                                                                                        {post.campaignName}
                                                                                    </Badge>
                                                                                    <span className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase whitespace-nowrap">
                                                                                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                                {post.isDeleted && (
                                                                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-rose-500 border-rose-200 bg-rose-50/50">
                                                                                        Deleted Content
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[post.platform] }} />
                                                                                <span className="text-[10px] font-black tracking-widest uppercase opacity-70">
                                                                                    {post.platform}
                                                                                </span>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-mono text-xs font-bold">
                                                                            <TooltipProvider>
                                                                                <Tooltip delayDuration={0}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <span className="cursor-help decoration-dotted underline decoration-slate-300 underline-offset-4">
                                                                                            {post.reach.toLocaleString()}
                                                                                        </span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="rounded-xl bg-slate-900 text-white font-bold p-3 border-none shadow-2xl">
                                                                                        {post.platform === 'PINTEREST' ? 'Number of times people saw this Pin' : 'Unique people seen this post'}
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </TableCell>
                                                                        <TableCell className="px-8 text-right">
                                                                            <TooltipProvider>
                                                                                <Tooltip delayDuration={0}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-black text-xs cursor-help ${selectedPostId === post.id ? 'bg-indigo-600 text-white' : 'bg-emerald-50  text-emerald-600 '}`}>
                                                                                            {post.engagementRate.toFixed(1)}%
                                                                                        </div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="rounded-xl bg-slate-900 text-white font-bold p-3 border-none shadow-2xl">
                                                                                        {post.platform === 'PINTEREST' ? `Performance: ${post.likes} saves, ${post.impressions} views detected` : `Impact: ${post.impressions} impressions detected`}
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 md:p-6 bg-slate-50/50 min-h-[400px]">
                                                            {paginatedPosts.map((post) => {
                                                                // Helper to extract image URL
                                                                let imageUrl: string | null = null;
                                                                if (post.mediaUrls) {
                                                                    if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) imageUrl = post.mediaUrls[0];
                                                                    else if (typeof post.mediaUrls === 'string') {
                                                                        if (post.mediaUrls.trim().startsWith('[')) {
                                                                            try {
                                                                                const parsed = JSON.parse(post.mediaUrls);
                                                                                if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0];
                                                                            } catch (e) { }
                                                                        } else {
                                                                            imageUrl = post.mediaUrls;
                                                                        }
                                                                    }
                                                                }

                                                                return (
                                                                    <Card
                                                                        key={post.id}
                                                                        className={`group rounded-2xl border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer ring-2 ${selectedPostId === post.id ? 'ring-indigo-500 bg-indigo-50/30' : 'ring-transparent bg-white'} hover:ring-indigo-200 flex flex-col`}
                                                                        onClick={() => setSelectedPostId(selectedPostId === post.id ? null : post.id)}
                                                                    >
                                                                        {/* Social Header */}
                                                                        <div className="p-4 flex items-center justify-between">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="size-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm" style={{ backgroundColor: PLATFORM_COLORS[post.platform] }}>
                                                                                    {post.platform.charAt(0)}
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{post.platform}</span>
                                                                                    <span className="text-[10px] font-bold text-slate-400">{new Date(post.publishedAt).toLocaleDateString()}</span>
                                                                                </div>
                                                                            </div>
                                                                            {post.isDeleted && <Badge variant="destructive" className="text-[9px] uppercase">Deleted</Badge>}
                                                                        </div>

                                                                        {/* Post Message (Text) */}
                                                                        {post.message && (
                                                                            <div className="px-4 pb-2">
                                                                                <p className="text-sm text-slate-700 leading-snug line-clamp-3">
                                                                                    {post.message}
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                        {/* Media / Image Display */}
                                                                        {(() => {
                                                                            if (!imageUrl) return !post.message && (
                                                                                <div className="w-full aspect-[3/1] bg-slate-50 flex items-center justify-center text-slate-300 italic text-xs">
                                                                                    No content preview
                                                                                </div>
                                                                            );

                                                                            const isVid = imageUrl.match(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i);
                                                                            const isYouTube = post.platform === 'YOUTUBE';

                                                                            if (isYouTube) {
                                                                                let videoId = '';
                                                                                if (imageUrl.includes('v=')) {
                                                                                    videoId = imageUrl.split('v=')[1].split('&')[0];
                                                                                } else if (imageUrl.includes('youtu.be/')) {
                                                                                    videoId = imageUrl.split('youtu.be/')[1].split('?')[0];
                                                                                } else if (imageUrl.includes('embed/')) {
                                                                                    videoId = imageUrl.split('embed/')[1].split('?')[0];
                                                                                } else if (post.postId && post.platform === 'YOUTUBE') {
                                                                                    videoId = post.postId;
                                                                                }

                                                                                if (videoId) {
                                                                                    return (
                                                                                        <div className="w-full aspect-video bg-black relative overflow-hidden mt-2">
                                                                                            <iframe
                                                                                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`}
                                                                                                className="w-full h-full border-0"
                                                                                                allow="autoplay; encrypted-media"
                                                                                                allowFullScreen
                                                                                            />
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                            }

                                                                            if (isVid) {
                                                                                return (
                                                                                    <div className="w-full aspect-video bg-black relative overflow-hidden mt-2">
                                                                                        <video
                                                                                            src={imageUrl}
                                                                                            className="w-full h-full object-cover"
                                                                                            autoPlay
                                                                                            muted
                                                                                            loop
                                                                                            playsInline
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            return (
                                                                                <div className="w-full aspect-video bg-slate-100 relative overflow-hidden mt-2">
                                                                                    <img
                                                                                        src={imageUrl}
                                                                                        alt="Post Media"
                                                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                                        loading="lazy"
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Content Stats Grid (Footer) */}
                                                                        <div className="p-4 mt-auto">
                                                                            <div className="grid grid-cols-3 gap-2 py-2 border-t border-slate-100">
                                                                                <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                                                                                    <ThumbsUp className={`size-3.5 mb-1 ${selectedPostId === post.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                    <span className="text-xs font-black">{post.likes.toLocaleString()}</span>
                                                                                </div>
                                                                                <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                                                                                    <MessageSquare className={`size-3.5 mb-1 ${selectedPostId === post.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                    <span className="text-xs font-black">{post.comments.toLocaleString()}</span>
                                                                                </div>
                                                                                <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                                                                                    <Eye className={`size-3.5 mb-1 ${selectedPostId === post.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                    <span className="text-xs font-black">{post.reach.toLocaleString()}</span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Footer Badge */}
                                                                            <div className="flex items-center justify-between pt-2">
                                                                                <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                                                                    {post.campaignName}
                                                                                </Badge>
                                                                                <div className={`text-xs font-black ${selectedPostId === post.id ? 'text-indigo-600' : 'text-emerald-500'}`}>
                                                                                    {post.engagementRate.toFixed(1)}% ER
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </Card>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Pagination Controls */}
                                                {totalPages > 1 && (
                                                    <div className="flex flex-col px-3 sm:flex-row items-center justify-between pt-6 gap-4">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                                                            Page <span className="text-indigo-600 font-black">{currentPage}</span> of {totalPages}
                                                        </p>

                                                        <div className="flex flex-wrap justify-center items-center gap-2">
                                                            {/* Navigation Buttons */}
                                                            <button
                                                                onClick={() => fetchPostPerformance(1)}
                                                                disabled={currentPage === 1 || postsLoading}
                                                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                                                title="First Page"
                                                            >
                                                                <ChevronsLeft className="size-4" />
                                                            </button>

                                                            <button
                                                                onClick={() => fetchPostPerformance(Math.max(1, currentPage - 1))}
                                                                disabled={currentPage === 1 || postsLoading}
                                                                className="px-4 py-2 rounded-xl bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                                            >
                                                                Prev
                                                            </button>

                                                            {/* Page Dropdown */}
                                                            <div className="flex items-center gap-2 px-2">
                                                                <span className="text-xs font-bold text-slate-400">Go to</span>
                                                                <Select
                                                                    value={currentPage.toString()}
                                                                    onValueChange={(val) => fetchPostPerformance(parseInt(val))}
                                                                >
                                                                    <SelectTrigger className="h-8 w-16 px-2 rounded-lg border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 bg-white">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="max-h-[200px]">
                                                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                                            <SelectItem key={page} value={page.toString()} className="text-xs font-medium">
                                                                                {page}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <button
                                                                onClick={() => fetchPostPerformance(Math.min(totalPages, currentPage + 1))}
                                                                disabled={currentPage === totalPages || postsLoading}
                                                                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all shadow-lg shadow-slate-200"
                                                            >
                                                                Next
                                                            </button>

                                                            <button
                                                                onClick={() => fetchPostPerformance(totalPages)}
                                                                disabled={currentPage === totalPages || postsLoading}
                                                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                                                title="Last Page"
                                                            >
                                                                <ChevronsRight className="size-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}                </div>
                                        ) : (
                                            <div className="h-[400px] flex flex-col items-center justify-center p-8">
                                                <BarChart3 className="size-16 text-slate-100  mb-4" />
                                                <h3 className="font-bold">No posts found</h3>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* 30% Column: Dynamic Graphics */}
                                <Card className="lg:col-span-3 rounded-4xl border-none shadow-xl bg-gradient-to-br from-indigo-600 to-indigo-900 text-white overflow-hidden flex flex-col">
                                    <CardHeader className="p-8 pb-0">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="size-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                                                {selectedPostId ? <TrendingUp className="size-5" /> : <Globe className="size-5" />}
                                            </div>
                                            <div
                                                className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/30 transition-colors"
                                                onClick={() => setPostGraphType(postGraphType === 'pie' ? 'bar' : 'pie')}
                                            >
                                                {postGraphType === 'pie' ? 'Switch to Bar' : 'Switch to Pie'}
                                            </div>
                                        </div>
                                        <CardTitle className="text-xl font-bold">
                                            {selectedPostId ? 'Content Velocity' : 'Omni Performance'}
                                        </CardTitle>
                                        <CardDescription className="text-white/60 text-xs">
                                            {selectedPostId ? 'Detailed engagement breakdown' : 'Share of reach per network'}
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="p-8 flex-1 flex flex-col justify-center">
                                        <div className="h-[300px] w-full" onClick={() => setPostGraphType(postGraphType === 'pie' ? 'bar' : 'pie')}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                {selectedPostId ? (
                                                    // Bar Chart for Individual Post
                                                    (() => {
                                                        const p = postData?.posts.find(x => x.id === selectedPostId);
                                                        const postMetrics = [
                                                            { name: 'Likes', val: p?.likes || 0, color: '#fff' },
                                                            { name: 'Comm', val: p?.comments || 0, color: 'rgba(255,255,255,0.7)' },
                                                            { name: 'Reach', val: p?.reach || 0, color: 'rgba(255,255,255,0.4)' },
                                                        ];
                                                        return postGraphType === 'bar' ? (
                                                            <BarChart data={postMetrics} layout="vertical">
                                                                <XAxis type="number" hide />
                                                                <YAxis dataKey="name" type="category" hide />
                                                                <RechartsTooltip
                                                                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                                                    contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '12px' }}
                                                                />
                                                                <Bar dataKey="val" radius={[0, 10, 10, 0]} barSize={20}>
                                                                    {postMetrics.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        ) : (
                                                            <PieChart>
                                                                <Pie
                                                                    data={postMetrics}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={60}
                                                                    outerRadius={100}
                                                                    paddingAngle={5}
                                                                    dataKey="val"
                                                                >
                                                                    {postMetrics.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                                    ))}
                                                                </Pie>
                                                                <RechartsTooltip />
                                                            </PieChart>
                                                        );
                                                    })()
                                                ) : (
                                                    // Global Omni-Channel Chart
                                                    postGraphType === 'pie' ? (
                                                        <PieChart>
                                                            <Pie
                                                                data={platformShareData}
                                                                innerRadius={60}
                                                                outerRadius={100}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                            >
                                                                {platformShareData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.2)" />
                                                                ))}
                                                            </Pie>
                                                            <RechartsTooltip
                                                                contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '12px', fontSize: '10px', color: 'white' }}
                                                            />
                                                        </PieChart>
                                                    ) : (
                                                        <BarChart data={platformShareData} layout="vertical">
                                                            <XAxis type="number" hide />
                                                            <YAxis dataKey="name" type="category" hide />
                                                            <RechartsTooltip
                                                                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                                                contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '12px' }}
                                                            />
                                                            <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                                                                {platformShareData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    )
                                                )}
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Dynamic Insight Legend */}
                                        <div className="mt-8 space-y-4">
                                            {(selectedPostId ? [
                                                { name: 'Likes', val: postData?.posts.find(x => x.id === selectedPostId)?.likes || 0 },
                                                { name: 'Reach', val: postData?.posts.find(x => x.id === selectedPostId)?.reach || 0 },
                                                { name: 'Comm', val: postData?.posts.find(x => x.id === selectedPostId)?.comments || 0 },
                                            ] : platformShareData.slice(0, 3)).map((item, i) => (
                                                <div key={i} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-2 rounded-full bg-white group-hover:scale-150 transition-transform" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{item.name}</span>
                                                    </div>
                                                    <span className="text-xs font-black">{item.val || item.value?.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            {selectedPostId && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedPostId(null); }}
                                                    className="w-full mt-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    Clear Selection
                                                </button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {perfSubMode === 'campaigns' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <TooltipProvider>
                                <div className="grid gap-6 md:grid-cols-4">
                                    {[
                                        { label: 'Gross Reach', val: postData?.totalStats.reach, icon: Globe, color: 'text-blue-500', tip: 'Cumulative reach across all campaigns' },
                                        { label: 'Engagements', val: (postData?.totalStats.likes || 0) + (postData?.totalStats.comments || 0), icon: TrendingUp, color: 'text-emerald-500', tip: 'Total interactive points (Likes + Comments)' },
                                        { label: 'Total Campaigns', val: postData?.campaigns.length, icon: BarChart3, color: 'text-amber-500', tip: 'Number of active and archived campaigns' },
                                        { label: 'Avg Impressions', val: Math.round((postData?.totalStats.impressions || 0) / Math.max(postData?.campaigns.length || 1, 1)), icon: Eye, color: 'text-indigo-500', tip: 'Average visibility per campaign' }
                                    ].map((stat, i) => (
                                        <Tooltip key={i} delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <Card className="rounded-3xl border-none shadow-xl bg-white  p-6 cursor-pointer group transition-all hover:scale-[1.02]">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`size-12 rounded-2xl flex items-center justify-center ${stat.color.replace('text', 'bg').replace('500', '500/10')} ${stat.color} group-hover:scale-110 transition-transform`}>
                                                            <stat.icon className="size-6" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                                                            <p className="text-2xl font-black text-slate-900  leading-none">
                                                                {stat.val?.toLocaleString() || 0}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </TooltipTrigger>
                                            <TooltipContent className="p-3 rounded-xl border-none shadow-lg bg-slate-950 text-white text-xs">
                                                {stat.tip}
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </div>
                            </TooltipProvider>
                            <div className="space-y-12">
                                <TooltipProvider delayDuration={0}>
                                    {/* Active Campaigns Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                                                <Activity className="size-5" />
                                            </div>
                                            <h2 className="text-xl font-black tracking-tight text-slate-900  uppercase">Active Campaigns</h2>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                            {/* Total Organisation Card */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Card
                                                        className={`group overflow-hidden rounded-[1.5rem] p-5 cursor-pointer transition-all hover:shadow-2xl relative ${campaignId === 'all' ? 'bg-slate-900 text-white ring-4 ring-indigo-500/20 shadow-indigo-500/10' : 'bg-white border-2 border-slate-300'}`}
                                                        onClick={() => { setCampaignId('all'); setPerfSubMode('overview'); }}
                                                    >
                                                        <div className="relative z-10 space-y-4">
                                                            <div className="size-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform duration-500">
                                                                <Globe className="size-6" />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-lg font-black leading-tight">Total View</h3>
                                                                <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mt-1">Global Intelligence</p>
                                                            </div>
                                                        </div>
                                                        {campaignId === 'all' && (
                                                            <div className="absolute top-6 right-6 size-2.5 rounded-full bg-indigo-500 animate-ping" />
                                                        )}
                                                    </Card>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-4 rounded-2xl border-none shadow-2xl bg-slate-950 text-white" side="bottom">
                                                    <div className="space-y-3 min-w-[200px]">
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400 mb-1">Global Intelligence</p>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-slate-400">Total Reach</span>
                                                            <span className="font-black">{postData?.totalStats.reach.toLocaleString() || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-slate-400">Impressions</span>
                                                            <span className="font-black">{postData?.totalStats.impressions.toLocaleString() || 0}</span>
                                                        </div>
                                                        <div className="h-px bg-white/10" />
                                                        <p className="text-[9px] text-center text-slate-500 italic">Click to view global deep-dive</p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>

                                            {/* Individual Active Campaigns */}
                                            {campaignStats.filter(cm => !cm.isDeleted).map(cm => (
                                                <Tooltip key={cm.id}>
                                                    <TooltipTrigger asChild>
                                                        <Card
                                                            className={`group overflow-hidden rounded-[1.5rem] p-5 cursor-pointer transition-all hover:shadow-2xl relative ${campaignId === cm.id.toString() ? 'bg-slate-900 text-white ring-4 ring-indigo-500/20' : 'bg-white border-2 border-slate-300'}`}
                                                            onClick={() => { setCampaignId(cm.id.toString()); setPerfSubMode('overview'); }}
                                                        >
                                                            <div className="relative z-10 space-y-4">
                                                                <div className={`size-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ${cm.id === 0 ? 'bg-slate-500/20 text-slate-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                                                    <BarChart3 className="size-6" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-lg font-black line-clamp-1 leading-tight">{cm.name}</h3>
                                                                    <p className="text-[10px] opacity-60 font-medium uppercase tracking-widest mt-1 text-slate-500">
                                                                        {cm.impressions.toLocaleString()} Views
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="p-4 rounded-2xl border-none shadow-2xl bg-slate-950 text-white" side="bottom">
                                                        <div className="space-y-2 min-w-[180px]">
                                                            <div className="flex justify-between items-center gap-4">
                                                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Reach</span>
                                                                <span className="font-black text-indigo-400">{cm.reach.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-4">
                                                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Engagement</span>
                                                                <span className="font-black text-emerald-400">{cm.engagement.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Archived Campaigns Section */}
                                    {campaignStats.some(cm => cm.isDeleted) && (
                                        <div className="space-y-6 pt-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-slate-500/10 text-slate-500">
                                                    <Archive className="size-5" />
                                                </div>
                                                <h2 className="text-xl font-black tracking-tight text-slate-400  uppercase">Archived Content</h2>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                                {campaignStats.filter(cm => cm.isDeleted).map(cm => (
                                                    <Tooltip key={cm.id}>
                                                        <TooltipTrigger asChild>
                                                            <Card
                                                                className={`group overflow-hidden rounded-[1.5rem] p-5 cursor-pointer transition-all hover:shadow-xl relative bg-slate-50/50 grayscale hover:grayscale-0 opacity-70 hover:opacity-100 border-2 border-slate-300`}
                                                                onClick={() => { setCampaignId(cm.id.toString()); setPerfSubMode('overview'); }}
                                                            >
                                                                <div className="relative z-10 space-y-4">
                                                                    <div className="size-12 rounded-2xl bg-slate-200  flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform duration-500">
                                                                        <Archive className="size-6" />
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-lg font-black line-clamp-1 italic leading-tight">{cm.name}</h3>
                                                                        <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mt-1 text-rose-400">Archived • {cm.impressions.toLocaleString()} Views</p>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="p-4 rounded-2xl border-none shadow-2xl bg-slate-950 text-white" side="bottom">
                                                            <div className="space-y-2 min-w-[180px]">
                                                                <p className="text-[10px] uppercase font-black tracking-widest text-rose-400 mb-1">Historical Snapshot</p>
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-bold text-slate-400">Total Reach</span>
                                                                    <span className="font-black">{cm.reach.toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-bold text-slate-400">Impressions</span>
                                                                    <span className="font-black">{cm.impressions.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </TooltipProvider>
                            </div>
                        </div>
                    )}

                </TabsContent>

                {/* demographic Tab */}


                {/* Demographics Tab */}
                {/* Demographics Tab */}
                <TabsContent value="demographics" className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                        {/* 70% Column: Data Table */}
                        <Card className="lg:col-span-7 rounded-4xl border-md shadow-xl bg-white  overflow-hidden flex flex-col">
                            <CardHeader className="p-4 md:p-8 border-b border-slate-50 ">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div>
                                        <CardTitle className="text-xl md:text-2xl font-bold">Audience Demographics</CardTitle>
                                        <CardDescription className="text-xs md:text-sm">Detailed breakdown of your audience</CardDescription>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
                                            {['ALL', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE', 'PINTEREST'].map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => {
                                                        setDemoPlatform(p);
                                                        // Fallback logic for categories not supported by the new platform
                                                        if (p === 'YOUTUBE' && demoCategory === 'industry') setDemoCategory('country');
                                                        if (p !== 'YOUTUBE' && demoCategory === 'trafficSources') setDemoCategory('country');
                                                        if (p !== 'PINTEREST' && (demoCategory === 'interests' || demoCategory === 'devices')) setDemoCategory('country');
                                                        if (p !== 'LINKEDIN' && (demoCategory === 'industry' || demoCategory === 'seniority' || demoCategory === 'function')) setDemoCategory('country');
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${demoPlatform === p ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
                                            {(['country', 'city', 'gender', 'age', 'trafficSources', 'interests', 'devices', 'industry', 'seniority', 'function'] as const).filter(c =>
                                                (c !== 'trafficSources' || demoPlatform === 'YOUTUBE') &&
                                                (c !== 'interests' || demoPlatform === 'PINTEREST') &&
                                                (c !== 'devices' || demoPlatform === 'PINTEREST') &&
                                                (c !== 'industry' || demoPlatform === 'LINKEDIN') &&
                                                (c !== 'seniority' || demoPlatform === 'LINKEDIN') &&
                                                (c !== 'function' || demoPlatform === 'LINKEDIN') &&
                                                // General fallbacks: LinkedIn doesn't have age/gender in this API
                                                (demoPlatform !== 'LINKEDIN' || (c !== 'gender' && c !== 'age' && c !== 'city'))
                                            ).map((cat: any) => (
                                                <button
                                                    key={cat}
                                                    onClick={() => setDemoCategory(cat)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${demoCategory === cat ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                                                >
                                                    {cat === 'trafficSources' ? 'Sources' : cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/50 border-none">
                                                <TableHead className="px-8 py-5 text-slate-500 font-bold uppercase text-[10px] tracking-widest block w-full">{demoCategory} Name</TableHead>
                                                {demoPlatform !== 'PINTEREST' && (
                                                    <TableHead className="py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                                                        {demoPlatform === 'YOUTUBE' ? 'Subscribers' : 'Followers'}
                                                    </TableHead>
                                                )}
                                                <TableHead className="px-8 py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Share</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(() => {
                                                const { rows, total } = demoSourceData;

                                                if (rows.length === 0) {
                                                    return (
                                                        <TableRow>
                                                            <TableCell colSpan={demoPlatform === 'PINTEREST' ? 2 : 3} className="h-40 text-center text-slate-400 font-medium">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <span>Not enough reach to generate demographic data yet.</span>
                                                                    <span className="text-xs opacity-70">Continue growing your audience to unlock this insight.</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                }

                                                return rows.map((row, i) => (
                                                    <TableRow key={row.key} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <TableCell className="px-8 py-4 font-bold text-slate-700 dark:text-slate-200">
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                                {row.label}
                                                            </div>
                                                        </TableCell>
                                                        {demoPlatform !== 'PINTEREST' && (
                                                            <TableCell className="text-right font-mono text-xs font-bold">
                                                                {row.val < 1 ? 0 : row.val.toLocaleString()}
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="px-8 text-right">
                                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                                {total > 0 ? ((row.val / total) * 100).toFixed(1) : 0}%
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ));
                                            })()}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 30% Column: Visuals */}
                        <Card className="lg:col-span-3 rounded-4xl border-none shadow-xl bg-gradient-to-br from-indigo-600 to-indigo-900 text-white overflow-hidden flex flex-col">
                            <CardHeader className="p-8 pb-0">
                                <div className="size-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4">
                                    <Globe className="size-5" />
                                </div>
                                <CardTitle className="text-xl font-bold capitalize">{demoCategory} Distribution</CardTitle>
                                <CardDescription className="text-white/60 text-xs">Visual breakdown of audience by {demoCategory}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col justify-center">
                                <div className="w-full flex-col overflow-y-auto" >
                                    {(() => {
                                        const { rows } = demoSourceData;
                                        if (rows.length === 0) {
                                            return (
                                                <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-4">
                                                    <div className="size-16 rounded-full bg-white/10 flex items-center justify-center">
                                                        <BarChart3 className="size-8 text-white/40" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white">Not enough data</p>
                                                        <p className="text-[10px] text-white/50 uppercase tracking-widest">To build a visual breakdown</p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        const chartData = rows.map(r => ({ name: r.label, value: r.val }));

                                        // Render Bar Charts for Country, City, Age, Traffic Sources, and Interests
                                        if (['country', 'city', 'age', 'trafficSources', 'interests', 'industry', 'seniority', 'function'].includes(demoCategory)) {
                                            const dynamicHeight = Math.max(300, chartData.length * 50);
                                            return (
                                                <div style={{ height: dynamicHeight, overflow: "hidden" }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={chartData} layout="vertical" >
                                                            <XAxis type="number" hide />
                                                            <YAxis dataKey="name" type="category" width={10} tick={false} axisLine={false} tickLine={false} />
                                                            <RechartsTooltip
                                                                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                                                contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '12px', color: 'white' }}
                                                                itemStyle={{ color: 'white' }}
                                                                labelStyle={{ color: 'white' }}
                                                            />
                                                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                                                {chartData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                                <LabelList dataKey="name" position="insideLeft" fill="white" fontSize={10} fontWeight="bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            );
                                        }

                                        // Render Pie Chart for Gender (default/fallback)
                                        return (
                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={chartData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={100}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                        >
                                                            {chartData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.2)" />
                                                            ))}
                                                        </Pie>
                                                        <RechartsTooltip
                                                            contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '12px', fontSize: '10px', color: 'white' }}
                                                            itemStyle={{ color: 'white' }}
                                                            labelStyle={{ color: 'white' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="mt-8 space-y-3">

                                    <div className="flex items-center gap-2 text-xs text-white/50">
                                        <AlertCircle className="size-3" />
                                        <span>Showing all segments (scrollable)</span>
                                    </div>

                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}