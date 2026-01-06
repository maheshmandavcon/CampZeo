'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ArrowLeft,
    Loader2,
    RefreshCw,
    ThumbsUp,
    MessageSquare,
    Share2,
    Eye,
    BarChart2,
    Calendar,
    MapPin,
    Users,
    Video,
    Image as ImageIcon,
    Send,
    CheckCircle,
    MousePointerClick
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from 'recharts';
import React from 'react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Helper to clean media URLs (handle JSON arrays or single strings)
const getCleanMediaUrl = (url: string | null) => {
    if (!url) return '';
    if (url === '[]') return '';
    try {
        if (typeof url === 'string' && url.startsWith('[') && url.endsWith(']')) {
            const arr = JSON.parse(url);
            return arr[0] || '';
        }
        return url;
    } catch (e) {
        return url;
    }
};

export default function PostDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = React.use(params);
    const postId = resolvedParams.id;

    const [post, setPost] = useState<any>(null);
    const [historicalData, setHistoricalData] = useState<any[]>([]);
    const [demographics, setDemographics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [chartMetric, setChartMetric] = useState<'engagement' | 'reach'>('engagement');

    useEffect(() => {
        const fetchPostDetails = async () => {
            try {
                setLoading(true);
                // Extract additional params for virtual post lookup
                const searchParams = new URLSearchParams(window.location.search);
                const platform = searchParams.get('platform');
                const platformPostId = searchParams.get('postId');

                let url = `/api/Analytics/post-details/${postId}?fresh=true`;
                if (platform) url += `&platform=${platform}`;
                if (platformPostId) url += `&postId=${platformPostId}`;

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to fetch post details');
                }
                const data = await response.json();
                setPost(data.post);
                setHistoricalData(data.historicalData);
                setDemographics(data.demographics);
            } catch (error) {
                console.error('Error fetching post details:', error);
                toast.error('Failed to load post details');
            } finally {
                setLoading(false);
            }
        };

        fetchPostDetails();
    }, [postId]);

    const handleSync = async () => {
        try {
            setSyncing(true);
            const searchParams = new URLSearchParams(window.location.search);
            const platform = searchParams.get('platform');
            const platformPostId = searchParams.get('postId');

            let url = `/api/Analytics/post-details/${postId}?fresh=true`;
            if (platform) url += `&platform=${platform}`;
            if (platformPostId) url += `&postId=${platformPostId}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to sync insights');
            }
            const data = await response.json();
            setPost(data.post);
            setHistoricalData(data.historicalData);
            setDemographics(data.demographics);

            toast.success('Insights synced successfully');
        } catch (error) {
            console.error('Sync error:', error);
            toast.error('Failed to sync insights');
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="min-h-screen bg-background">
                <div className="flex">
                    <main className="flex-1 p-6 flex flex-col items-center justify-center">
                        <h2 className="text-2xl font-bold">Post not found</h2>
                        <Button onClick={() => router.back()} className="mt-4 cursor-pointer">
                            Go Back
                        </Button>
                    </main>
                </div>
            </div>
        );
    }

    const isEmailPlatform = ['EMAIL', 'SMS', 'WHATSAPP'].includes(post.platform?.toUpperCase() || '');

    return (
        <div className="min-h-screen bg-background">
            <div className="flex">
                <main className="flex-1 p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Button
                                    className="cursor-pointer"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.back()}
                                >
                                    <ArrowLeft className="size-4 mr-2" />
                                    Back
                                </Button>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                                        Post Insights
                                        {post.insight.isDeleted && (
                                            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 text-sm font-bold border border-red-200 uppercase tracking-wide">
                                                Deleted
                                            </span>
                                        )}
                                    </h1>
                                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                                        Detailed analytics for your {post.platform} post
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground hidden sm:inline-block">
                                    Last updated: {post.insight.lastUpdated ? format(new Date(post.insight.lastUpdated), 'MMM d, h:mm a') : 'Just now'}
                                </span>
                                <Button className="cursor-pointer shadow-sm" onClick={handleSync} disabled={syncing}>
                                    <RefreshCw className={`size-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? 'Syncing...' : 'Sync Data'}
                                </Button>
                            </div>
                        </div>

                        {/* Deleted Post Alert */}
                        {post.insight.isDeleted && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800">
                                <div className="p-1 bg-amber-100 rounded-full mt-0.5">
                                    <BarChart2 className="size-4" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm">Post Removed from Platform</h4>
                                    <p className="text-sm mt-1 opacity-90">
                                        This post has been deleted on {post.platform}. We are preserving the last known performance metrics for your historical records.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Top Metrics Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {(post.platform === 'EMAIL' || post.platform === 'SMS' || post.platform === 'WHATSAPP') ? (
                                <>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Sent</h3>
                                                <Send className="size-4 text-primary" />
                                            </div>
                                            <div className="text-3xl font-bold">{post.insight.reach.toLocaleString()}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Total recipients</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Delivered</h3>
                                                <CheckCircle className="size-4 text-green-500" />
                                            </div>
                                            <div className="text-3xl font-bold">{post.insight.reach.toLocaleString()}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Successful deliveries</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Opened</h3>
                                                <Eye className="size-4 text-purple-500" />
                                            </div>
                                            <div className="text-3xl font-bold">{post.insight.impressions.toLocaleString()}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Unique opens</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Delivery Rate</h3>
                                                <BarChart2 className="size-4 text-orange-500" />
                                            </div>
                                            <div className="text-3xl font-bold">100%</div>
                                            <p className="text-xs text-muted-foreground mt-1">Success rate</p>
                                        </CardContent>
                                    </Card>
                                </>
                            ) : (
                                <>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Total Likes</h3>
                                                <ThumbsUp className="size-4 text-blue-500" />
                                            </div>
                                            <div className="text-3xl font-bold">{post.insight.likes.toLocaleString()}</div>
                                            <p className="text-xs text-muted-foreground mt-1">User endorsements</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Comments</h3>
                                                <MessageSquare className="size-4 text-green-500" />
                                            </div>
                                            <div className="text-3xl font-bold">{post.insight.comments.toLocaleString()}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Community interactions</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Total Reach</h3>
                                                <Share2 className="size-4 text-purple-500" />
                                            </div>
                                            <div className="text-3xl font-bold">{post.insight.reach.toLocaleString()}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Unique accounts reached</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-medium text-muted-foreground">Engagement Rate</h3>
                                                <Users className="size-4 text-orange-500" />
                                            </div>
                                            <div className="text-3xl font-bold">
                                                {post.insight.engagementRate ? `${post.insight.engagementRate.toFixed(2)}%` : '0.00%'}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">Interactions per impression</p>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column: Post Preview */}
                            <div className="space-y-6">
                                <Card className="overflow-hidden h-full">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Post Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border shadow-inner">
                                            {post.postType === 'VIDEO' || getCleanMediaUrl(post.mediaUrls).toLowerCase().endsWith('.mp4') ? (
                                                <div className="flex items-center justify-center h-full bg-slate-900">
                                                    <Video className="size-12 text-white opacity-80" />
                                                </div>
                                            ) : (post.mediaUrls && post.mediaUrls !== '[]') ? (
                                                <Image
                                                    src={getCleanMediaUrl(post.mediaUrls)}
                                                    alt="Post media"
                                                    fill
                                                    className="object-cover"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full bg-slate-100">
                                                    <ImageIcon className="size-12 text-slate-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-muted/30 p-4 rounded-md border">
                                            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                                {post.message || <span className="text-muted-foreground italic">No caption text</span>}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2 pt-2 border-t text-sm">
                                            <div className="flex items-center justify-between text-muted-foreground">
                                                <span className="flex items-center gap-2"><Calendar className="size-3.5" /> Published</span>
                                                <span className="font-medium text-foreground">{post.publishedAt ? format(new Date(post.publishedAt), 'MMM d, yyyy h:mm a') : 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-muted-foreground">
                                                <span className="flex items-center gap-2"><MapPin className="size-3.5" /> Platform</span>
                                                <span className="font-medium text-foreground">{post.platform}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column: Detailed Charts */}
                            <div className="lg:col-span-2">
                                <Card className="h-full border shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="flex items-center gap-2">
                                                <BarChart2 className="size-5 text-primary" />
                                                Performance Over Time
                                            </CardTitle>
                                            <CardDescription>
                                                Historical engagement trends for this post
                                            </CardDescription>
                                        </div>
                                        <div className="flex bg-muted p-1 rounded-md text-xs">
                                            <button
                                                onClick={() => setChartMetric('engagement')}
                                                className={`px-3 py-1.5 rounded-sm transition-all ${chartMetric === 'engagement' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                                            >
                                                {isEmailPlatform ? 'Sent' : 'Interactions'}
                                            </button>
                                            <button
                                                onClick={() => setChartMetric('reach')}
                                                className={`px-3 py-1.5 rounded-sm transition-all ${chartMetric === 'reach' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                                            >
                                                {isEmailPlatform ? 'Opened' : 'Reach/ER'}
                                            </button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={historicalData}>
                                                    <defs>
                                                        <linearGradient id="colorLikesPost" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorCommentsPost" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorReachPost" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorERPost" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                    <XAxis
                                                        dataKey="date"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                                                        dy={10}
                                                        tick={{ fontSize: 12, fill: '#6b7280' }}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 12, fill: '#6b7280' }}
                                                    />
                                                    <Tooltip
                                                        labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                                                        contentStyle={{
                                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                        }}
                                                    />
                                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                    {chartMetric === 'engagement' ? (
                                                        <>
                                                            <Area
                                                                type="monotone"
                                                                dataKey="reach"
                                                                name={isEmailPlatform ? "Sent" : "Likes"}
                                                                stroke="#3b82f6"
                                                                strokeWidth={3}
                                                                fillOpacity={1}
                                                                fill="url(#colorLikesPost)"
                                                            />
                                                            {!isEmailPlatform && (
                                                                <Area
                                                                    type="monotone"
                                                                    dataKey="comments"
                                                                    name="Comments"
                                                                    stroke="#10b981"
                                                                    strokeWidth={3}
                                                                    fillOpacity={1}
                                                                    fill="url(#colorCommentsPost)"
                                                                />
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Area
                                                                type="monotone"
                                                                dataKey={isEmailPlatform ? "impressions" : "reach"}
                                                                name={isEmailPlatform ? "Opened" : "Reach"}
                                                                stroke="#a855f7"
                                                                strokeWidth={3}
                                                                fillOpacity={1}
                                                                fill="url(#colorReachPost)"
                                                            />
                                                            {!isEmailPlatform && (
                                                                <Area
                                                                    type="monotone"
                                                                    dataKey="engagementRate"
                                                                    name="Engagement Rate"
                                                                    stroke="#f97316"
                                                                    strokeWidth={3}
                                                                    fillOpacity={1}
                                                                    fill="url(#colorERPost)"
                                                                    unit="%"
                                                                />
                                                            )}
                                                        </>
                                                    )}
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
