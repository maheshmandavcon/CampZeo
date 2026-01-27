'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, MapPin, Clock, Globe, BarChart3, TrendingUp, ThumbsUp, MessageSquare, Eye } from 'lucide-react';
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
    Line
} from 'recharts';
import { UnifiedAudienceData } from '@/lib/audience-normalizer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface PostAnalyticsData {
    campaigns: { id: number; name: string }[];
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
        likes: number;
        comments: number;
        reach: number;
        impressions: number;
        saves: number;
        shares: number;
        videoViews: number;
        engagementRate: number;
        publishedAt: string;
    }[];
    trends: { date: string; engagement: number }[];
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
    const itemsPerPage = 5;

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
                const response = await fetch('/api/Analytics/audience');
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
            params.append('page', page.toString());
            params.append('limit', itemsPerPage.toString());

            const response = await fetch(`/api/Analytics/reports/posts?${params.toString()}`);
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
            const response = await fetch('/api/Analytics/sync-all');
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
    }, [campaignId, platform]);

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
    data.activityHeatmap.forEach(p => {
        if (heatmapGrid[p.day]) heatmapGrid[p.day][p.hour] = p.value;
    });

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50/50 dark:bg-slate-950/50 space-y-8 animate-in fade-in duration-500">
            {/* Header with Glassmorphism Effect */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 border border-white/20 dark:shadow-none">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Social Intelligence
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium flex items-center gap-2">
                        <Clock className="size-4" />
                        Last synced: {postData?.lastSync ? new Date(postData.lastSync).toLocaleString() : 'Just now'}
                    </p>
                </div>
                <button
                    onClick={handleManualSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold hover:scale-105 transition-all active:scale-95 disabled:opacity-50 border border-white/20 dark:shadow-none"
                >
                    {syncing ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
                    {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
            </div>

            <Tabs defaultValue="performance" className="space-y-8">
                <TabsList className="p-1 h-14 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-1  inline-flex border border-dark/90">
                    <TabsTrigger value="performance" className="flex gap-2 rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md transition-all"><BarChart3 className="size-4" /> Post Performance</TabsTrigger>
                    <TabsTrigger value="activity" className="flex gap-2 rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md transition-all"><Clock className="size-4" /> Activity Patterns</TabsTrigger>
                    <TabsTrigger value="networks" className="flex gap-2 rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md transition-all"><Users className="size-4" /> Network Insights</TabsTrigger>
                    {/* <TabsTrigger value="locality" className="flex gap-2 rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-md transition-all"><MapPin className="size-4" /> Locality</TabsTrigger> */}
                </TabsList>

                {/* Network Insights Tab */}
                <TabsContent value="networks" className="space-y-8 animate-in fade-in duration-500">
                    {/* Platform Legend */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white/50  rounded-3xl backdrop-blur-sm border border-md  border border-md shadow-md">
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                            <div className="flex items-center gap-3">
                                <div className="size-3 rounded-full bg-slate-400 opacity-60" /> Reach (Audience)
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="size-3 rounded-full bg-slate-400" /> Impact (Engagement)
                            </div>
                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                            <div className="flex flex-wrap items-center gap-5">
                                {Object.entries(PLATFORM_COLORS).filter(([k]) => k !== 'all').map(([name, color]) => (
                                    <div key={name} className="flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-slate-800/50 rounded-full border border-slate-100 dark:border-slate-700">
                                        <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
                                        <span>{name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

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
                                            data={data.platformBreakdown}
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
                                                {data.platformBreakdown.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-aud-${index}`}
                                                        fill={PLATFORM_COLORS[entry.platform]}
                                                        fillOpacity={0.6}
                                                    />
                                                ))}
                                            </Bar>
                                            <Bar dataKey="engagement" name="Engagement (Interactions)" radius={[6, 6, 0, 0]}>
                                                {data.platformBreakdown.map((entry, index) => (
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
                            {data.platformBreakdown.map((platform) => (
                                <Card key={platform.platform} className="rounded-3xl border-md shadow-md bg-white/90  overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                    <CardHeader className="p-6 pb-2" style={{ backgroundColor: `${PLATFORM_COLORS[platform.platform]}10` }}>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                                                <div className="size-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform.platform] }} />
                                                {platform.platform}
                                            </CardTitle>
                                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest border-slate-200">Live</Badge>
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

                                        <div className="h-px bg-slate-100 dark:bg-slate-800" />

                                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                            <div className="flex items-center gap-2">
                                                <ThumbsUp className="size-3.5 text-blue-500" />
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Likes</p>
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
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Reach</p>
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
                                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="h-full bg-slate-900 dark:bg-slate-400 transition-all duration-1000"
                                                        style={{
                                                            width: `${(platform.followerReach || 0) + (platform.nonFollowerReach || 0) > 0
                                                                ? ((platform.followerReach || 0) / ((platform.followerReach || 0) + (platform.nonFollowerReach || 0))) * 100
                                                                : 0}%`
                                                        }}
                                                        title={`Followers: ${platform.followerReach?.toLocaleString()}`}
                                                    />
                                                    <div
                                                        className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-1000"
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
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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

                {/* Locality Tab */}
                <TabsContent value="locality" className="space-y-6">

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="rounded-3xl border-md shadow-md bg-white/80  backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Globe className="size-6 text-blue-500" /> Top Countries
                                </CardTitle>
                                <CardDescription>Geographic distribution of your audience</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                {data.topCountries.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.topCountries} layout="vertical" margin={{ left: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 12, 12, 0]} name="Audience" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <MapPin className="size-12 text-slate-300 mb-4" />
                                        <p className="text-sm text-slate-500">Location data unavailable</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-3xl border-md shadow-md bg-white/80  backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <MapPin className="size-6 text-emerald-500" /> Top Cities
                                </CardTitle>
                                <CardDescription>Urban centers with highest engagement</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                {data.topCities.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.topCities} layout="vertical" margin={{ left: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                                            <Bar dataKey="value" fill="#10b981" radius={[0, 12, 12, 0]} name="Audience" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <MapPin className="size-12 text-slate-300 mb-4" />
                                        <p className="text-sm text-slate-500">City data unavailable</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
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
                                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
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
                                <div className="overflow-x-auto pb-4">
                                    <div className="min-w-[100%]">
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
                                                            <TooltipContent className="bg-slate-950 text-white border-white/10">
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
                <TabsContent value="performance" className="space-y-8  ">
                    {/* Filters & Actions */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        <Card className="flex-1 rounded-3xl border-md shadow-md bg-white/80  backdrop-blur-md">
                            <CardContent className="p-6 flex flex-wrap items-end gap-6">
                                <div className="space-y-2 flex-1 min-w-[240px]">
                                    <label className="text-sm font-bold text-slate-700  ml-1">Filter by Campaign</label>
                                    <Select value={campaignId} onValueChange={setCampaignId}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50  border-1 border shadow-inner ring-offset-2 focus:ring-2 focus:ring-slate-900 ">
                                            <SelectValue placeholder="All Campaigns" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-none shadow-md">
                                            <SelectItem value="all">Total Organisation View</SelectItem>
                                            {postData?.campaigns.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
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
                            </CardContent>
                        </Card>
                    </div>

                    {/* Engagement Trends Chart */}
                    <Card className="rounded-4xl border-md shadow-md bg-white/90  backdrop-blur-sm overflow-hidden">
                        <CardHeader className="p-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl font-black tracking-tight">Engagement Trends</CardTitle>
                                    <CardDescription>Visualizing interaction growth over the last 14 days</CardDescription>
                                </div>
                                <div className="px-4 py-2 rounded-xl bg-blue-50  text-blue-600  font-bold text-xs uppercase tracking-widest">
                                    Last 14 Days
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-0">
                            <div className="h-[350px] w-full">
                                {postData && postData.trends.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={postData.trends}>
                                            <defs>
                                                <linearGradient id="engGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={PLATFORM_COLORS[platform] || '#3b82f6'} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={PLATFORM_COLORS[platform] || '#3b82f6'} stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                                                dy={10}
                                                tickFormatter={(val) => {
                                                    const date = new Date(val);
                                                    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                                                }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                                            />
                                            <RechartsTooltip
                                                contentStyle={{
                                                    borderRadius: '20px',
                                                    border: 'none',
                                                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                    backdropFilter: 'blur(10px)'
                                                }}
                                                cursor={{ fill: '#f8fafc' }}
                                            />
                                            <Bar
                                                dataKey="engagement"
                                                fill="url(#engGradient)"
                                                radius={[10, 10, 0, 0]}
                                                name="Total Interactions"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium">
                                        <BarChart3 className="size-16 mb-4 opacity-20" />
                                        Data is being collected... Check back later.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Stats Cards */}
                    <div className="grid gap-6 md:grid-cols-4">
                        {[
                            { label: 'Total Likes', val: postData?.totalStats.likes, icon: ThumbsUp, color: 'text-blue-500', bg: 'bg-blue-50' },
                            { label: 'Comments', val: postData?.totalStats.comments, icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                            { label: 'Impressions', val: postData?.totalStats.impressions, icon: Eye, color: 'text-amber-500', bg: 'bg-amber-50' },
                            { label: 'Avg Reach', val: postData && postData.posts.length > 0 ? Math.round(postData.totalStats.reach / Math.max(postData.totalCount, 1)) : 0, icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50' }
                        ].map((stat, i) => (
                            <Card key={i} className="rounded-3xl border-md shadow-md bg-white  border-l-4 overflow-hidden" style={{ borderLeftColor: i === 0 ? '#3b82f6' : i === 1 ? '#10b981' : i === 2 ? '#f59e0b' : '#6366f1' }}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <stat.icon className={`size-5 ${stat.color}`} />
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight">Total</Badge>
                                    </div>
                                    <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 pt-2 uppercase tracking-wide">
                                        {stat.label}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-black text-slate-900 dark:text-white">
                                        {stat.val?.toLocaleString() || 0}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Posts Table */}
                    <Card className="rounded-4xl border-md shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-50 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl font-bold">Content Deep-Dive</CardTitle>
                                    <CardDescription>Individual performance tracking for every piece of content</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {postsLoading ? (
                                <div className="flex h-[400px] items-center justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-slate-900 dark:text-white" />
                                </div>
                            ) : postData && postData.posts.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="overflow-x-auto border-t border-slate-50 dark:border-slate-800">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-none hover:bg-slate-50/50">
                                                    <TableHead className="px-8 py-5 text-slate-500 font-bold uppercase text-[10px] tracking-widest min-w-[300px]">Content</TableHead>
                                                    <TableHead className="py-5 text-slate-500 font-bold uppercase text-[10px] tracking-widest">Network</TableHead>
                                                    <TableHead className="py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Likes</TableHead>
                                                    <TableHead className="py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Comments</TableHead>
                                                    <TableHead className="py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Saves</TableHead>
                                                    <TableHead className="py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Shares</TableHead>
                                                    <TableHead className="py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Reach</TableHead>
                                                    <TableHead className="px-8 py-5 text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Impact %</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paginatedPosts.map((post) => (
                                                    <TableRow key={post.id} className="border-slate-50 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                                        <TableCell className="px-8 py-6">
                                                            <div className="flex flex-col gap-2 max-w-[400px]">
                                                                <span className="font-bold text-slate-900 dark:text-white line-clamp-1 overflow-hidden text-ellipsis whitespace-nowrap block" title={post.message || 'Media Content'}>
                                                                    {post.message || 'Media Content'}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 rounded-md border-slate-200 dark:border-slate-700 uppercase shrink-0">
                                                                        {post.campaignName}
                                                                    </Badge>
                                                                    <span className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase whitespace-nowrap">
                                                                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                                <div
                                                                    className="w-2 h-2 rounded-full shrink-0"
                                                                    style={{ backgroundColor: PLATFORM_COLORS[post.platform] }}
                                                                />
                                                                <span className="text-[10px] font-black tracking-widest uppercase opacity-70">
                                                                    {post.platform}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-xs font-bold">{post.likes.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs font-bold">{post.comments.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs font-bold">{post.saves.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs font-bold">{post.shares.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs font-bold">{post.reach.toLocaleString()}</TableCell>
                                                        <TableCell className="px-8 text-right">
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                                                                {post.engagementRate.toFixed(1)}%
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Premium Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-6 bg-slate-50/50 dark:bg-slate-800/20 backdrop-blur-sm border-t border-slate-100 dark:border-slate-800 gap-4">
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                Showing page {currentPage} of {totalPages} ({postData?.totalCount} total entries)
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => fetchPostPerformance(currentPage - 1)}
                                                    disabled={currentPage === 1 || postsLoading}
                                                    className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:scale-100 hover:scale-105 active:scale-95 transition-all border border-white/20 hover:shadow-md dark:shadow-none flex items-center gap-2 group"
                                                >
                                                    <div className="size-1 rounded-full bg-slate-900 dark:bg-white group-hover:scale-150 transition-transform" />
                                                    Prev
                                                </button>

                                                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-white/20 dark:border-slate-700/50">
                                                    {Array.from({ length: totalPages }).map((_, i) => {
                                                        const pageNum = i + 1;
                                                        // Show first, last, current, and pages around current
                                                        if (
                                                            pageNum === 1 ||
                                                            pageNum === totalPages ||
                                                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                        ) {
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => fetchPostPerformance(pageNum)}
                                                                    disabled={postsLoading}
                                                                    className={`size-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${currentPage === pageNum
                                                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border border-white/20 dark:shadow-none scale-110'
                                                                        : 'text-slate-500 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                                                                        }`}
                                                                >
                                                                    {pageNum}
                                                                </button>
                                                            );
                                                        }
                                                        if (
                                                            (pageNum === 2 && currentPage > 3) ||
                                                            (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                                                        ) {
                                                            return <span key={i} className="text-slate-400 size-9 flex items-center justify-center font-bold">...</span>;
                                                        }
                                                        return null;
                                                    })}
                                                </div>

                                                <button
                                                    onClick={() => fetchPostPerformance(currentPage + 1)}
                                                    disabled={currentPage === totalPages || postsLoading}
                                                    className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:scale-100 hover:scale-105 active:scale-95 transition-all border border-white/20 dark:shadow-none flex items-center gap-2 group"
                                                >
                                                    Next
                                                    <div className="size-1 rounded-full bg-white dark:bg-slate-900 group-hover:scale-150 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-slate-900/50">
                                    <BarChart3 className="size-16 text-slate-200 dark:text-slate-800 mb-6" />
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">No social metrics found</h3>
                                    <p className="text-slate-500 max-w-xs mx-auto mt-2">Connect your social accounts or sync your latest data to see performance insights here.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
