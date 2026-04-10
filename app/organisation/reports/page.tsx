'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    const [demoCategory, setDemoCategory] = useState<'country' | 'city' | 'gender' | 'age' | 'trafficSources' | 'interests' | 'devices' | 'industry' | 'seniority' | 'function'>('country');
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
        <div className="p-4 md:p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Social Intelligence</h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        <Clock className="size-4" />
                        Last synced: {postData?.lastSync ? new Date(postData.lastSync).toLocaleString() : 'Just now'}
                    </p>
                </div>
                <Button
                    onClick={handleManualSync}
                    disabled={syncing}
                    variant="default"
                    size="lg"
                    className="gap-2"
                >
                    {syncing ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
                    {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
            </div>

            <Tabs defaultValue="performance" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:w-fit lg:grid-cols-4 gap-2 bg-transparent h-auto p-0">
                    <TabsTrigger value="performance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border shadow-sm"><BarChart3 className="size-4" /> Performance</TabsTrigger>
                    <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border shadow-sm"><Clock className="size-4" /> Activity</TabsTrigger>
                    <TabsTrigger value="networks" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border shadow-sm"><Users className="size-4" /> Networks</TabsTrigger>
                    <TabsTrigger value="demographics" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border shadow-sm"><Globe className="size-4" /> Demographics</TabsTrigger>
                </TabsList>

                <TabsContent value="networks" className="space-y-8 animate-in fade-in duration-500">
                    {/* Platform Legend & Intelligence Highlights */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-white  rounded-2xl border border-slate-100 shadow-sm flex-1">
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-slate-200" /> Reach (Audience)
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-slate-400" /> Impact (Engagement)
                                </div>
                                <div className="w-px h-6 bg-slate-100  hidden sm:block" />
                                <div className="flex flex-wrap items-center gap-4">
                                    {Object.entries(PLATFORM_COLORS).filter(([k]) => k !== 'all').map(([name, color]) => (
                                        <div key={name} className="flex items-center gap-2 px-3 py-1 bg-slate-50/50 rounded-full border border-slate-100">
                                            <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                                            <span className="text-slate-600">{name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Top Platform', val: filteredPlatformBreakdown[0]?.platform || 'N/A', icon: Globe, color: 'text-rose-500' },
                                { label: 'Avg Efficiency', val: '8.4%', icon: Activity, color: 'text-emerald-500' },
                                { label: 'Peak Growth', val: '+12%', icon: TrendingUp, color: 'text-blue-500' },
                                { label: 'Sync Status', val: 'Active', icon: Clock, color: 'text-amber-500' }
                            ].map((h, i) => (
                                <Card key={i} className="rounded-2xl border shadow-sm bg-white p-4 flex flex-col justify-center gap-1 min-w-[140px] hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">{h.label}</p>
                                        <h.icon className={`size-3.5 ${h.color}`} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-950 tracking-tight leading-none pt-1">{h.val}</p>
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
                        <Card className="rounded-[1.5rem] border-none shadow-sm bg-white overflow-hidden">
                            <CardHeader className="p-6 border-b border-slate-50 flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                            <BarChart3 className="size-5" />
                                        </div>
                                        Platform Distribution
                                    </CardTitle>
                                    <CardDescription className="text-sm font-medium pl-10">Global audience reach and cross-network engagement</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="h-[400px] p-6 pb-2">
                                {data.platformBreakdown.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={filteredPlatformBreakdown}
                                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F1F5F9" />
                                            <XAxis
                                                dataKey="platform"
                                                tick={{ fontSize: 10, fontWeight: 800, fill: '#64748B' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => val}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94A3B8' }} />
                                            <RechartsTooltip
                                                cursor={{ fill: '#F8FAFC' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                            />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                            <Bar dataKey="followers" name="Audience" radius={[4, 4, 0, 0]} barSize={40}>
                                                {filteredPlatformBreakdown.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-aud-${index}`}
                                                        fill={PLATFORM_COLORS[entry.platform]}
                                                        fillOpacity={0.4}
                                                    />
                                                ))}
                                            </Bar>
                                            <Bar dataKey="engagement" name="Impact" radius={[4, 4, 0, 0]} barSize={40}>
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
                                        <Users className="size-10 text-slate-200 mb-2" />
                                        <p className="text-xs text-slate-400 font-medium">No intelligence mapping available</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Platform Wise Detail Cards */}
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredPlatformBreakdown.map((platform) => (
                                <Card key={platform.platform} className="rounded-[1.5rem] border border-slate-100 shadow-sm bg-white overflow-hidden group hover:shadow-xl transition-all duration-300">
                                    <CardHeader className="p-5 pb-3 border-b border-slate-50">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 text-slate-900">
                                                <div className="size-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform.platform] }} />
                                                {platform.platform}
                                            </CardTitle>
                                            {platform.platform === 'LINKEDIN' && (data as any)?.platformDemographics?.linkedin?.organizations?.length > 1 ? (
                                                <Select value={selectedLinkedInOrg} onValueChange={setSelectedLinkedInOrg}>
                                                    <SelectTrigger className="w-[100px] h-6 text-[8px] font-black rounded text-indigo-600 bg-indigo-50/50 border-none uppercase tracking-widest">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-slate-100">
                                                        <SelectItem value="all" className="text-[10px] font-bold">Aggregate</SelectItem>
                                                        {(data as any).platformDemographics.linkedin.organizations.map((org: any) => (
                                                            <SelectItem key={org.urn} value={org.urn} className="text-[10px] font-bold">
                                                                {org.name || (org.isDefault ? 'Personal' : 'Org')}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Badge variant="secondary" className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-none ring-1 ring-slate-100">Live</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Audience</p>
                                                <p className="text-lg font-bold text-slate-950 tracking-tight leading-none">{platform.followers?.toLocaleString() ?? 0}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Published</p>
                                                <p className="text-lg font-bold text-slate-950 tracking-tight leading-none">{platform.posts?.toLocaleString() ?? 0}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-50" />

                                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                            {[
                                                { icon: ThumbsUp, label: platform.platform === 'PINTEREST' ? 'SAVES' : 'LIKES', val: platform.likes, color: 'text-rose-500', bg: 'bg-rose-50' },
                                                { icon: MessageSquare, label: 'COMMENTS', val: platform.comments, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                                                { icon: TrendingUp, label: platform.platform === 'PINTEREST' ? 'VIEWS' : 'REACH', val: platform.reach, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                                                { icon: Eye, label: 'PROF VIEW', val: platform.profileViews, color: 'text-amber-500', bg: 'bg-amber-50' },
                                                { icon: BarChart3, label: 'VID VIEWS', val: platform.videoViews, color: 'text-purple-500', bg: 'bg-purple-50' }
                                            ].map((m, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${m.bg} ${m.color}`}>
                                                        <m.icon className="size-3" />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <p className="text-[8px] font-black text-slate-400 tracking-tighter">{m.label}</p>
                                                        <p className="text-xs font-black text-slate-900 leading-none">{(m.val ?? 0).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {(platform.followerReach !== undefined || platform.nonFollowerReach !== undefined) && (
                                            <div className="pt-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth Split</span>
                                                    <span className="text-[9px] font-bold text-slate-400 italic">Fans vs Non-Fans</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="h-full bg-slate-900 transition-all duration-1000"
                                                        style={{
                                                            width: `${(platform.followerReach || 0) + (platform.nonFollowerReach || 0) > 0
                                                                ? ((platform.followerReach || 0) / ((platform.followerReach || 0) + (platform.nonFollowerReach || 0))) * 100
                                                                : 0}%`
                                                        }}
                                                    />
                                                    <div
                                                        className="h-full bg-slate-200 transition-all duration-1000"
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impact Rate</span>
                                                <span className="text-[10px] font-black text-indigo-600">{(platform.engagement || 0).toLocaleString()} PTS</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
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
                            <CardDescription className="text-sm font-medium pl-10">Activity heatmap showing when your audience is most active across the week</CardDescription>
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
                            className={`px-6 py-2 rounded-lg text-xs font-black tracking-widest transition-all ${perfSubMode === 'overview' ? 'bg-white text-sm ' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setPerfSubMode('campaigns')}
                            className={`px-6 py-2 rounded-lg text-xs font-black tracking-widest transition-all ${perfSubMode === 'campaigns' ? 'bg-white  text-sm ' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Campaigns
                        </button>
                    </div>

                    {perfSubMode === 'overview' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                            {/* System Intelligence: Contextual Battle Header */}
                            {contenders && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Top Performer Card */}
                                    <Card className="border-l-4 border-l-emerald-500">
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <div className="space-y-1">
                                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                                    {contenders.labelA}
                                                </Badge>
                                                <CardTitle className="text-xl font-bold mt-1">
                                                    <Select value={battleA === 'all' ? String(contenders.a.id) : battleA} onValueChange={setBattleA}>
                                                        <SelectTrigger className="h-auto p-0 border-none shadow-none bg-transparent font-bold text-xl focus:ring-0">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">Suggested Best</SelectItem>
                                                            {campaignStats.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </CardTitle>
                                                <p className="text-xs text-muted-foreground">
                                                    {battleA === 'all' ? contenders.subA : 'Manual Analysis'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-emerald-600">
                                                    {(() => {
                                                        const active = battleA === 'all' ? contenders.a : campaignStats.find((s: any) => String(s.id) === String(battleA));
                                                        if (!active || active.impressions === 0) return 0;
                                                        return Math.min(Math.round((active.engagement / active.impressions) * 100), 100);
                                                    })()}%
                                                </p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Impact</p>
                                            </div>
                                        </CardHeader>
                                    </Card>

                                    {/* Needs Attention Card */}
                                    <Card className="border-l-4 border-l-rose-500">
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <div className="space-y-1">
                                                <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                                    {contenders.labelB}
                                                </Badge>
                                                <CardTitle className="text-xl font-bold mt-1">
                                                    <Select value={battleB === 'all' ? String(contenders.b.id) : battleB} onValueChange={setBattleB}>
                                                        <SelectTrigger className="h-auto p-0 border-none shadow-none bg-transparent font-bold text-xl focus:ring-0">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">Focus Context</SelectItem>
                                                            {campaignStats.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </CardTitle>
                                                <p className="text-xs text-muted-foreground">
                                                    {battleB === 'all' ? contenders.subB : 'Rival Benchmark'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-rose-600">
                                                    {(() => {
                                                        const active = battleB === 'all' ? contenders.b : campaignStats.find((s: any) => String(s.id) === String(battleB));
                                                        if (!active || active.impressions === 0) return 0;
                                                        return Math.min(Math.round((active.engagement / active.impressions) * 100), 100);
                                                    })()}%
                                                </p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Gap</p>
                                            </div>
                                        </CardHeader>
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
                                                <Card className="hover:shadow-md transition-shadow">
                                                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-tight">
                                                            {stat.label}
                                                        </CardTitle>
                                                        <stat.icon className={`size-4 ${stat.color}`} />
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="text-2xl font-bold">
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Filter by Campaign</label>
                                    <Select value={campaignId} onValueChange={setCampaignId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Campaigns" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Total Organisation View</SelectItem>
                                            {postData?.campaigns.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Filter by Platform</label>
                                    <Select value={platform} onValueChange={setPlatform}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Platforms" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Omnichannel Overview</SelectItem>
                                            <SelectItem value="FACEBOOK">Facebook</SelectItem>
                                            <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                                            <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                                            <SelectItem value="YOUTUBE">YouTube</SelectItem>
                                            <SelectItem value="PINTEREST">Pinterest</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Sort By</label>
                                    <Select value={sortBy} onValueChange={(val) => setSortBy(val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sort Order" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="engagement">🔥 Highest Impact</SelectItem>
                                            <SelectItem value="publishedAt">🕓 Newest First</SelectItem>
                                            <SelectItem value="likes">👍 Most Likes</SelectItem>
                                            <SelectItem value="reach">👀 Highest Reach</SelectItem>
                                            <SelectItem value="impressions">📊 Most Impressions</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Performance Split View (70/30) */}
                            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                                {/* 70% Column: Content Table */}
                                <Card className="lg:col-span-7 flex flex-col shadow-sm rounded-2xl">
                                    <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-slate-100">
                                        <div>
                                            <CardTitle className="text-2xl font-bold">Content Deep-Dive</CardTitle>
                                            <CardDescription className="text-sm mt-1">Click a row to analyze specific performance</CardDescription>
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
                                    </CardHeader>
                                    <CardContent className="p-0 flex-1">
                                        {postsLoading ? (
                                            <div className="flex h-[400px] items-center justify-center">
                                                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                                            </div>
                                        ) : postData && postData.posts.length > 0 ? (
                                            <div className="flex flex-col h-full">
                                                <div className="overflow-x-auto min-h-[400px]">
                                                    {viewMode === 'table' ? (
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="hover:bg-transparent">
                                                                    <TableHead className="min-w-[300px] px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Content</TableHead>
                                                                    <TableHead className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Network</TableHead>
                                                                    <TableHead className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{platform === 'PINTEREST' ? 'Views' : 'Reach'}</TableHead>
                                                                    <TableHead className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Impact</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {paginatedPosts.map((post) => (
                                                                    <TableRow
                                                                        key={post.id}
                                                                        className={`transition-colors cursor-pointer group ${selectedPostId === post.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}
                                                                        onClick={() => setSelectedPostId(selectedPostId === post.id ? null : post.id)}
                                                                    >
                                                                        <TableCell className="px-6 py-4">
                                                                            <div className="flex flex-col gap-1.5 max-w-[400px]">
                                                                                <span className={`font-semibold transition-colors ${selectedPostId === post.id ? 'text-indigo-600' : 'text-slate-900'} line-clamp-1`}>
                                                                                    {post.message || 'Media Content'}
                                                                                </span>
                                                                                <div className="flex items-center gap-2">
                                                                                    <Badge variant="outline" className="text-[10px] font-medium px-2 py-0">
                                                                                        {post.campaignName}
                                                                                    </Badge>
                                                                                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                                                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="px-6 py-4">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="size-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[post.platform] }} />
                                                                                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                                                                                    {post.platform}
                                                                                </span>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="px-6 py-4 text-right">
                                                                            <span className="font-mono text-sm font-medium">
                                                                                {post.reach.toLocaleString()}
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="px-6 py-4 text-right">
                                                                            <div className={`inline-flex items-center px-2.5 py-1 rounded-full font-bold text-xs ${selectedPostId === post.id ? 'bg-indigo-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                                {post.engagementRate.toFixed(1)}%
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50/50">
                                                            {paginatedPosts.map((post) => {
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
                                                                        className={`group rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer ring-2 ${selectedPostId === post.id ? 'ring-indigo-500 bg-indigo-50/50 border-indigo-100 shadow-md' : 'ring-transparent bg-white shadow-sm hover:shadow-md border-slate-200 hover:border-indigo-200'} flex flex-col`}
                                                                        onClick={() => setSelectedPostId(selectedPostId === post.id ? null : post.id)}
                                                                    >
                                                                        <div className="p-4 flex items-center justify-between border-b border-slate-50">
                                                                            <div className="flex items-center gap-2.5">
                                                                                <div className="size-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm" style={{ backgroundColor: PLATFORM_COLORS[post.platform] }}>
                                                                                    {post.platform.charAt(0)}
                                                                                </div>
                                                                                <div className="flex flex-col gap-0.5">
                                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none">{post.platform}</span>
                                                                                    <span className="text-[10px] font-medium text-slate-400 leading-none">{new Date(post.publishedAt).toLocaleDateString()}</span>
                                                                                </div>
                                                                            </div>
                                                                            {post.isDeleted && <Badge variant="destructive" className="text-[9px] uppercase font-bold py-0 h-4">Deleted</Badge>}
                                                                        </div>

                                                                        {post.message && (
                                                                            <div className="p-4 pb-0">
                                                                                <p className="text-sm text-slate-700 leading-snug line-clamp-3">
                                                                                    {post.message}
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                        {(() => {
                                                                            if (!imageUrl) return !post.message && (
                                                                                <div className="w-full aspect-[3/1] bg-slate-50 flex items-center justify-center text-slate-400 italic text-xs mt-4">
                                                                                    No content preview
                                                                                </div>
                                                                            );
                                                                            const isVid = imageUrl.match(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i);
                                                                            const isYouTube = post.platform === 'YOUTUBE';
                                                                            if (isYouTube) {
                                                                                let videoId = '';
                                                                                if (imageUrl.includes('v=')) videoId = imageUrl.split('v=')[1].split('&')[0];
                                                                                else if (imageUrl.includes('youtu.be/')) videoId = imageUrl.split('youtu.be/')[1].split('?')[0];
                                                                                else if (imageUrl.includes('embed/')) videoId = imageUrl.split('embed/')[1].split('?')[0];
                                                                                else if (post.postId && post.platform === 'YOUTUBE') videoId = post.postId;

                                                                                if (videoId) {
                                                                                    return (
                                                                                        <div className="w-full aspect-video bg-black relative overflow-hidden mt-4">
                                                                                            <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`} className="w-full h-full border-0" allow="autoplay; encrypted-media" allowFullScreen />
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                            }
                                                                            if (isVid) {
                                                                                return (
                                                                                    <div className="w-full aspect-video bg-black relative overflow-hidden mt-4">
                                                                                        <video src={imageUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <div className="w-full aspect-video bg-slate-100 relative overflow-hidden mt-4">
                                                                                    <img src={imageUrl} alt="Post Media" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        <div className="p-4 mt-auto space-y-4">
                                                                            <div className="grid grid-cols-3 gap-2">
                                                                                <div className="bg-slate-50/80 rounded-lg p-2.5 flex flex-col items-center">
                                                                                    <ThumbsUp className={`size-3.5 mb-1.5 ${selectedPostId === post.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                    <span className="text-[11px] font-bold text-slate-700">{post.likes.toLocaleString()}</span>
                                                                                </div>
                                                                                <div className="bg-slate-50/80 rounded-lg p-2.5 flex flex-col items-center">
                                                                                    <MessageSquare className={`size-3.5 mb-1.5 ${selectedPostId === post.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                    <span className="text-[11px] font-bold text-slate-700">{post.comments.toLocaleString()}</span>
                                                                                </div>
                                                                                <div className="bg-slate-50/80 rounded-lg p-2.5 flex flex-col items-center">
                                                                                    <Eye className={`size-3.5 mb-1.5 ${selectedPostId === post.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                    <span className="text-[11px] font-bold text-slate-700">{post.reach.toLocaleString()}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                                                                <Badge variant="secondary" className="text-[9px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600">
                                                                                    {post.campaignName}
                                                                                </Badge>
                                                                                <div className={`text-xs font-bold ${selectedPostId === post.id ? 'text-indigo-600' : 'text-emerald-600'}`}>
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

                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                                                        <p className="text-xs font-medium text-slate-500">
                                                            Page {currentPage} of {totalPages}
                                                        </p>
                                                        <div className="flex items-center gap-1.5">
                                                            <Button variant="outline" size="sm" onClick={() => fetchPostPerformance(Math.max(1, currentPage - 1))} disabled={currentPage === 1 || postsLoading} className="h-8">
                                                                Previous
                                                            </Button>
                                                            <Select value={currentPage.toString()} onValueChange={(val) => fetchPostPerformance(parseInt(val))}>
                                                                <SelectTrigger className="h-8 w-[70px] text-xs font-medium">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                                        <SelectItem key={page} value={page.toString()} className="text-xs">{page}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button variant="default" size="sm" onClick={() => fetchPostPerformance(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages || postsLoading} className="h-8 bg-slate-900 text-white">
                                                                Next
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-[400px] flex flex-col items-center justify-center">
                                                <BarChart3 className="size-12 text-slate-200 mb-3" />
                                                <h3 className="font-semibold text-slate-500">No posts found</h3>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* 30% Column: Dynamic Graphics */}
                                <Card className="lg:col-span-3 rounded-[2rem] border border-slate-100 shadow-xl bg-white text-slate-900 overflow-hidden flex flex-col">
                                    <CardHeader className="p-8 pb-0">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                {selectedPostId ? <TrendingUp className="size-5 text-[#dc2626]" /> : <Globe className="size-5 text-[#dc2626]" />}
                                            </div>
                                            <div
                                                className="px-3 py-1.5 rounded-full bg-slate-100 text-[9px] font-bold uppercase tracking-widest cursor-pointer hover:bg-slate-200 transition-colors text-slate-500"
                                                onClick={() => setPostGraphType(postGraphType === 'pie' ? 'bar' : 'pie')}
                                            >
                                                {postGraphType === 'pie' ? 'SWITCH TO BAR' : 'SWITCH TO PIE'}
                                            </div>
                                        </div>
                                        <CardTitle className="text-xl font-black tracking-tight">
                                            {selectedPostId ? 'Content Velocity' : 'Omni Performance'}
                                        </CardTitle>
                                        <CardDescription className="text-slate-500 text-xs font-medium">
                                            {selectedPostId ? 'Detailed engagement breakdown' : 'Share of reach per network'}
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="p-8 flex-1 flex flex-col justify-center">
                                        <div className="h-[280px] w-full" onClick={() => setPostGraphType(postGraphType === 'pie' ? 'bar' : 'pie')}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                {selectedPostId ? (
                                                    (() => {
                                                        const p = postData?.posts.find(x => x.id === selectedPostId);
                                                        const postMetrics = [
                                                            { name: 'Likes', val: p?.likes || 0, color: '#dc2626' },
                                                            { name: 'Comm', val: p?.comments || 0, color: '#f43f5e' },
                                                            { name: 'Reach', val: p?.reach || 0, color: '#fb7185' },
                                                        ];
                                                        return postGraphType === 'bar' ? (
                                                            <BarChart data={postMetrics} layout="vertical">
                                                                <XAxis type="number" hide />
                                                                <YAxis dataKey="name" type="category" hide />
                                                                <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: 'white' }} />
                                                                <Bar dataKey="val" radius={[0, 8, 8, 0]} barSize={20}>
                                                                    {postMetrics.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        ) : (
                                                            <PieChart>
                                                                <Pie data={postMetrics} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="val">
                                                                    {postMetrics.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                                                                    ))}
                                                                </Pie>
                                                                <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '12px' }} />
                                                            </PieChart>
                                                        );
                                                    })()
                                                ) : (
                                                    postGraphType === 'pie' ? (
                                                        <PieChart>
                                                            <Pie data={platformShareData} innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                                                                {platformShareData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                                                                ))}
                                                            </Pie>
                                                            <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '10px', color: '#0f172a' }} />
                                                        </PieChart>
                                                    ) : (
                                                        <BarChart data={platformShareData} layout="vertical">
                                                            <XAxis type="number" hide />
                                                            <YAxis dataKey="name" type="category" hide />
                                                            <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }} />
                                                            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                                                                {platformShareData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    )
                                                )}
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="mt-8 space-y-4">
                                            {(selectedPostId ? [
                                                { name: 'Likes', value: postData?.posts.find(x => x.id === selectedPostId)?.likes || 0, fill: '#dc2626' },
                                                { name: 'Reach', value: postData?.posts.find(x => x.id === selectedPostId)?.reach || 0, fill: '#fb7185' },
                                                { name: 'Comm', value: postData?.posts.find(x => x.id === selectedPostId)?.comments || 0, fill: '#f43f5e' },
                                            ] : platformShareData.slice(0, 3)).map((item, i) => (
                                                <div key={i} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-2 rounded-full" style={{ backgroundColor: item.fill }} />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.name}</span>
                                                    </div>
                                                    <span className="text-xs font-black">{item.value?.toLocaleString()}</span>
                                                </div>
                                            ))}
                                            {selectedPostId && (
                                                <button onClick={(e) => { e.stopPropagation(); setSelectedPostId(null); }} className="w-full mt-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-[10px] font-bold uppercase tracking-widest text-slate-600">
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
                                        { label: 'Gross Reach', val: postData?.totalStats.reach, icon: Globe, color: 'text-rose-500', tip: 'Cumulative reach across all campaigns' },
                                        { label: 'Engagements', val: (postData?.totalStats.likes || 0) + (postData?.totalStats.comments || 0), icon: TrendingUp, color: 'text-emerald-500', tip: 'Total interactive points (Likes + Comments)' },
                                        { label: 'Total Campaigns', val: postData?.campaigns.length, icon: BarChart3, color: 'text-amber-500', tip: 'Number of active and archived campaigns' },
                                        { label: 'Avg Impressions', val: Math.round((postData?.totalStats.impressions || 0) / Math.max(postData?.campaigns.length || 1, 1)), icon: Eye, color: 'text-red-500', tip: 'Average visibility per campaign' }
                                    ].map((stat, i) => (
                                        <Tooltip key={i} delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <Card className="hover:shadow-md transition-shadow cursor-pointer border shadow-sm bg-white">
                                                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
                                                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-tight">
                                                            {stat.label}
                                                        </CardTitle>
                                                        <stat.icon className={`size-4 ${stat.color === 'text-red-500' ? 'text-[#dc2626]' : stat.color}`} />
                                                    </CardHeader>
                                                    <CardContent className="px-4 pb-4">
                                                        <div className="text-2xl font-bold">
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
                            <div className="space-y-12">
                                <TooltipProvider delayDuration={0}>
                                    {/* Active Campaigns Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-2xl bg-[#dc2626]/10 text-[#dc2626]">
                                                <Activity className="size-5" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-slate-900">Active Campaigns</h2>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                            {/* Total Organisation Card */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Card
                                                        className={`group overflow-hidden rounded-[1.5rem] p-5 cursor-pointer transition-all hover:shadow-lg relative border ${campaignId === 'all' ? 'border-[#dc2626] bg-[#dc2626]/5 ring-4 ring-[#dc2626]/5' : 'bg-white border-slate-100'}`}
                                                        onClick={() => { setCampaignId('all'); setPerfSubMode('overview'); }}
                                                    >
                                                        <div className="relative z-10 space-y-4">
                                                            <div className={`size-10 rounded-xl flex items-center justify-center transition-transform duration-500 ${campaignId === 'all' ? 'bg-[#dc2626] text-white' : 'bg-[#dc2626]/10 text-[#dc2626] group-hover:scale-110'}`}>
                                                                <Globe className="size-5" />
                                                            </div>
                                                            <div>
                                                                <h3 className={`text-base font-bold leading-tight ${campaignId === 'all' ? 'text-[#dc2626]' : 'text-slate-900'}`}>Total View</h3>
                                                                <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${campaignId === 'all' ? 'text-[#dc2626]/60' : 'text-slate-400'}`}>Global Intelligence</p>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-4 rounded-2xl border-none shadow-2xl bg-slate-900 text-white" side="bottom">
                                                    <div className="space-y-3 min-w-[200px]">
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-[#dc2626] mb-1">Global Intelligence</p>
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
                                                            className={`group overflow-hidden rounded-[1.5rem] p-5 cursor-pointer transition-all hover:shadow-lg relative border ${campaignId === cm.id.toString() ? 'border-[#dc2626] bg-[#dc2626]/5 ring-4 ring-[#dc2626]/5' : 'bg-white border-slate-100 hover:border-[#dc2626]/30'}`}
                                                            onClick={() => { setCampaignId(cm.id.toString()); setPerfSubMode('overview'); }}
                                                        >
                                                            <div className="relative z-10 space-y-4">
                                                                <div className={`size-10 rounded-xl flex items-center justify-center transition-transform duration-500 ${campaignId === cm.id.toString() ? 'bg-[#dc2626] text-white' : 'bg-slate-100 text-[#dc2626] group-hover:scale-110'}`}>
                                                                    <BarChart3 className="size-5" />
                                                                </div>
                                                                <div>
                                                                    <h3 className={`text-base font-bold line-clamp-1 leading-tight ${campaignId === cm.id.toString() ? 'text-[#dc2626]' : 'text-slate-900'}`}>{cm.name}</h3>
                                                                    <p className={`text-[10px] font-medium uppercase tracking-tight mt-1 ${campaignId === cm.id.toString() ? 'text-[#dc2626]/60' : 'text-slate-500'}`}>
                                                                        {cm.impressions.toLocaleString()} Views
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="p-4 rounded-2xl border-none shadow-2xl bg-slate-900 text-white" side="bottom">
                                                        <div className="space-y-2 min-w-[180px]">
                                                            <div className="flex justify-between items-center gap-4">
                                                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Reach</span>
                                                                <span className="font-black text-[#dc2626]">{cm.reach.toLocaleString()}</span>
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
                                                <div className="p-2.5 rounded-2xl bg-slate-500/10 text-slate-500">
                                                    <Archive className="size-5" />
                                                </div>
                                                <h2 className="text-lg font-bold tracking-tight text-slate-400 uppercase">Archived Content</h2>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                                {campaignStats.filter(cm => cm.isDeleted).map(cm => (
                                                    <Tooltip key={cm.id}>
                                                        <TooltipTrigger asChild>
                                                            <Card
                                                                className={`group overflow-hidden rounded-[2.5rem] p-6 cursor-pointer transition-all hover:shadow-xl relative bg-white grayscale hover:grayscale-0 opacity-70 hover:opacity-100 border-2 border-slate-100`}
                                                                onClick={() => { setCampaignId(cm.id.toString()); setPerfSubMode('overview'); }}
                                                            >
                                                                <div className="relative z-10 space-y-4">
                                                                    <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform duration-500">
                                                                        <Archive className="size-6" />
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-lg font-black line-clamp-1 italic leading-tight">{cm.name}</h3>
                                                                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-rose-500">Archived • {cm.impressions.toLocaleString()} Views</p>
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


                {/* Demographics Tab */}
                <TabsContent value="demographics" className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                        {/* 70% Column: Data Table */}
                        <Card className="lg:col-span-7 rounded-4xl border-md shadow-xl bg-white  overflow-hidden flex flex-col">
                            <CardHeader className="p-4 md:p-8 border-b border-slate-50 ">
                                <div>
                                    <CardTitle className="text-xl md:text-2xl font-bold">Audience Demographics</CardTitle>
                                    <CardDescription className="text-sm font-medium">Detailed breakdown of your audience</CardDescription>
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar border border-slate-200/50">
                                        {['ALL', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE', 'PINTEREST'].map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => {
                                                    setDemoPlatform(p);
                                                    if (p === 'YOUTUBE' && demoCategory === 'industry') setDemoCategory('country');
                                                    if (p !== 'YOUTUBE' && demoCategory === 'trafficSources') setDemoCategory('country');
                                                    if (p !== 'PINTEREST' && (demoCategory === 'interests' || demoCategory === 'devices')) setDemoCategory('country');
                                                    if (p !== 'LINKEDIN' && (demoCategory === 'industry' || demoCategory === 'seniority' || demoCategory === 'function')) setDemoCategory('country');
                                                }}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${demoPlatform === p ? 'bg-white/80 shadow-sm text-[#dc2626]' : 'text-slate-500 hover:text-slate-900'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar border border-slate-200/50">
                                        {(['country', 'city', 'gender', 'age', 'trafficSources', 'interests', 'devices', 'industry', 'seniority', 'function'] as const).filter(c =>
                                            (c !== 'trafficSources' || demoPlatform === 'YOUTUBE') &&
                                            (c !== 'interests' || demoPlatform === 'PINTEREST') &&
                                            (c !== 'devices' || demoPlatform === 'PINTEREST') &&
                                            (c !== 'industry' || demoPlatform === 'LINKEDIN') &&
                                            (c !== 'seniority' || demoPlatform === 'LINKEDIN') &&
                                            (c !== 'function' || demoPlatform === 'LINKEDIN') &&
                                            (demoPlatform !== 'LINKEDIN' || (c !== 'gender' && c !== 'age' && c !== 'city'))
                                        ).map((cat: any) => (
                                            <button
                                                key={cat}
                                                onClick={() => setDemoCategory(cat)}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${demoCategory === cat ? 'bg-white/80 shadow-sm text-[#dc2626]' : 'text-slate-500 hover:text-slate-900'}`}
                                            >
                                                {cat === 'trafficSources' ? 'Sources' : cat}
                                            </button>
                                        ))}
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
                        <Card className="lg:col-span-3 rounded-[2rem] border border-slate-100 shadow-xl bg-white text-slate-900 overflow-hidden flex flex-col">
                            <CardHeader className="p-8 pb-0">
                                <div className="size-10 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                                    <Globe className="size-5 text-[#dc2626]" />
                                </div>
                                <CardTitle className="text-2xl font-black capitalize">{demoCategory} Distribution</CardTitle>
                                <CardDescription className="text-slate-500 text-xs font-medium">Visual breakdown of audience by {demoCategory}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col justify-center">
                                <div className="w-full flex-col overflow-y-auto" >
                                    {(() => {
                                        const { rows } = demoSourceData;
                                        if (rows.length === 0) {
                                            return (
                                                <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-4">
                                                    <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center">
                                                        <BarChart3 className="size-8 text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">Not enough data</p>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">To build a visual breakdown</p>
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
                                                                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                                                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a' }}
                                                                itemStyle={{ color: '#0f172a' }}
                                                                labelStyle={{ color: '#0f172a' }}
                                                            />
                                                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                                                {chartData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                                <LabelList dataKey="name" position="insideLeft" fill="#0f172a" fontSize={10} fontWeight="bold" />
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
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" />
                                                            ))}
                                                        </Pie>
                                                        <RechartsTooltip
                                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '10px', color: '#0f172a' }}
                                                            itemStyle={{ color: '#0f172a' }}
                                                            labelStyle={{ color: '#0f172a' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="mt-8 space-y-3">

                                    <div className="flex items-center gap-2 text-xs text-slate-400">
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