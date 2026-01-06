'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    Send,
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    RefreshCw,
    BarChart2,
    Image as ImageIcon,
    Video,
    Bot,
    X,
    Sparkles
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
    AreaChart,
    Area
} from 'recharts';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PostInsight {
    likes: number;
    comments: number;
    reach: number;
    impressions: number;
    engagementRate: number;
    isDeleted: boolean;
    lastUpdated: string | null;
}

interface Post {
    id: number;
    postId: string;
    platform: string;
    postType: string; // 'VIDEO', 'IMAGE', etc.
    mediaUrls: string | null; // It seems it might be a JSON string or URL
    message: string | null;
    subject: string | null; // Added subject
    publishedAt: string | Date | null;
    insight: PostInsight;
}

// Helper to truncate text to specific word count
const truncateWords = (str: string | null, numWords: number) => {
    if (!str) return "No content";
    const words = str.split(" ");
    if (words.length > numWords) {
        return words.slice(0, numWords).join(" ") + "...";
    }
    return str;
};

// Helper to clean media URLs (handle JSON arrays or single strings)
const getCleanMediaUrl = (url: string | null) => {
    if (!url) return '';
    if (url === '[]') return '';
    try {
        if (url.startsWith('[') && url.endsWith(']')) {
            const arr = JSON.parse(url);
            return arr[0] || '';
        }
        return url;
    } catch (e) {
        return url;
    }
};

// Helper to extract filename from URL
const getMediaFileName = (url: string | null) => {
    const cleanUrl = getCleanMediaUrl(url);
    if (!cleanUrl) return 'No media';
    try {
        const parts = cleanUrl.split('/');
        const lastPart = parts[parts.length - 1];
        return decodeURIComponent(lastPart.split('?')[0]);
    } catch (e) {
        return 'Media file';
    }
};

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function AnalyticsPage() {
    const router = useRouter();

    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [organisationPlatforms, setOrganisationPlatforms] = useState<string[]>([]);
    const [loadingPlatforms, setLoadingPlatforms] = useState(true);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [syncing, setSyncing] = useState<number | null>(null);

    // Pagination/Filter State
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // AI Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: 'Hi! I can analyze your campaign performance. Ask me anything like "Which platform is doing best this month?"', timestamp: new Date() }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

    // Fetch platforms
    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const response = await fetch('/api/Organisation/GetPlatforms');
                if (!response.ok) throw new Error('Failed to fetch platforms');
                const data = await response.json();
                const platforms = data.platforms || [];
                setOrganisationPlatforms(platforms);

                if (platforms.length > 0) {
                    setSelectedPlatform(platforms[0]);
                }
            } catch (error) {
                console.error('Error fetching platforms:', error);
                toast.error('Failed to load platforms');
            } finally {
                setLoadingPlatforms(false);
            }
        };

        fetchPlatforms();
    }, []);

    // Fetch posts
    const fetchPosts = async (forceRefresh = false) => {
        if (!selectedPlatform) return;

        setLoadingPosts(true);
        try {
            let url = `/api/Analytics/posts?platform=${selectedPlatform}&page=${page}&limit=${limit}`;
            if (forceRefresh) url += '&fresh=true';
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;

            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Fetch posts error:', errorData);
                throw new Error('Failed to fetch posts');
            }
            const data = await response.json();
            setPosts(data.posts || []);
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 0);

            if (forceRefresh) {
                toast.success('Data refreshed');
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
            if (forceRefresh) toast.error('Failed to load analytics data');
        } finally {
            setLoadingPosts(false);
        }
    };

    useEffect(() => {
        if (selectedPlatform) {
            fetchPosts(false);
        } else {
            setPosts([]);
        }
    }, [selectedPlatform, page, startDate, endDate]);

    const handleSync = async (post: Post) => {
        setSyncing(post.id);
        try {
            const response = await fetch(`/api/Analytics/post-details/${post.id}?fresh=true&platform=${post.platform}&postId=${post.postId}`);
            if (!response.ok) throw new Error('Failed to sync post');

            const data = await response.json();
            if (data.post) {
                setPosts(prev => prev.map(p => p.id === post.id ? data.post : p));
                toast.success('Post metrics updated');
            }
        } catch (error) {
            console.error('Error syncing post:', error);
            toast.error('Failed to sync post metrics');
        } finally {
            setSyncing(null);
        }
    };

    const viewDetails = (post: Post) => {
        router.push(`/organisation/analytics/posts/${post.id}?platform=${post.platform}&postId=${post.postId}`);
    };

    const getPlatformIcon = (type: string) => {
        switch (type.toUpperCase()) {
            case 'EMAIL':
                return Mail;
            case 'SMS':
                return MessageSquare;
            case 'WHATSAPP':
                return Phone;
            case 'FACEBOOK':
                return Facebook;
            case 'INSTAGRAM':
                return Instagram;
            case 'LINKEDIN':
                return Linkedin;
            case 'YOUTUBE':
                return Youtube;
            case 'PINTEREST':
                return () => (
                    <div className="p-0.5 bg-red-600 rounded-full size-6 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">P</span>
                    </div>
                );
            default:
                return Send;
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage = chatInput;
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
        setIsChatLoading(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });

            if (!response.ok) throw new Error('Failed to get answer');

            const data = await response.json();
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: new Date() }]);
        } catch (error) {
            console.error('Chat error:', error);
            toast.error('Failed to connect to AI Assistant');
            setChatMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to the analytics engine right now. Please try again later.", timestamp: new Date() }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // CSV Export
    const handleExportCSV = () => {
        if (!posts.length) return;

        const isEmailOrSms = ['EMAIL', 'SMS', 'WHATSAPP'].includes(selectedPlatform?.toUpperCase() || '');

        let headers = ['Post/Message', 'Subject', 'Image Name', 'Image Link', 'Published At', 'Platform', 'Type', 'Status'];
        if (isEmailOrSms) {
            headers.push('Sent (Reach)', 'Delivered', 'Opened (Impressions)', 'Delivery Rate');
        } else {
            headers.push('Likes', 'Comments', 'Reach', 'Impressions', 'Engagement Rate');
        }

        // Map data to CSV rows
        const rows = posts.map(post => {
            const date = post.publishedAt ? format(new Date(post.publishedAt), 'yyyy-MM-dd HH:mm:ss') : '';
            const status = post.insight.isDeleted ? 'Deleted' : 'Live';

            // Clean URL and extract file name
            const imageLink = getCleanMediaUrl(post.mediaUrls);
            const imageName = getMediaFileName(post.mediaUrls);

            // CSV safe strings (escape quotes)
            const message = `"${(post.message || '').replace(/"/g, '""')}"`;
            const subject = `"${(post.subject || '').replace(/"/g, '""')}"`;

            let rowByType = [];
            if (isEmailOrSms) {
                rowByType = [
                    post.insight.reach, // Sent
                    post.insight.reach, // Delivered (simplified assumption for now unless detailed)
                    post.insight.impressions, // Opened
                    '100%' // Delivery Rate
                ];
            } else {
                rowByType = [
                    post.insight.likes,
                    post.insight.comments,
                    post.insight.reach,
                    post.insight.impressions,
                    `${post.insight.engagementRate.toFixed(2)}%`
                ];
            }

            return [
                message,
                subject,
                `"${imageName.replace(/"/g, '""')}"`,
                `"${imageLink.replace(/"/g, '""')}"`,
                date,
                post.platform,
                post.postType,
                status,
                ...rowByType
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedPlatform}_analytics_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Excel Export
    const handleExportExcel = () => {
        if (!posts.length) return;

        // Define headers
        const isEmailOrSms = ['EMAIL', 'SMS', 'WHATSAPP'].includes(selectedPlatform?.toUpperCase() || '');

        const data = posts.map(post => {
            const date = post.publishedAt ? new Date(post.publishedAt).toLocaleString() : '';
            const status = post.insight.isDeleted ? 'Deleted' : 'Live';

            const baseData = {
                'Post/Message': post.message || '',
                'Subject': post.subject || '',
                'Image Name': getMediaFileName(post.mediaUrls),
                'Image Link': getCleanMediaUrl(post.mediaUrls),
                'Published At': date,
                'Platform': post.platform,
                'Type': post.postType,
                'Status': status
            };

            if (isEmailOrSms) {
                return {
                    ...baseData,
                    'Sent (Reach)': post.insight.reach,
                    'Delivered': post.insight.reach,
                    'Opened (Impressions)': post.insight.impressions,
                    'Delivery Rate': '100%'
                };
            } else {
                return {
                    ...baseData,
                    'Likes': post.insight.likes,
                    'Comments': post.insight.comments,
                    'Reach': post.insight.reach,
                    'Impressions': post.insight.impressions,
                    'Engagement Rate': `${post.insight.engagementRate.toFixed(2)}%`
                };
            }
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");

        // Generate Excel file
        XLSX.writeFile(workbook, `${selectedPlatform}_analytics_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    // Chart Data Preparation
    const getChartData = () => {
        if (!posts.length) return [];
        // Sort by date ascending for chart
        const sortedPosts = [...posts].sort((a, b) => new Date(a.publishedAt || 0).getTime() - new Date(b.publishedAt || 0).getTime());

        return sortedPosts.map(post => ({
            date: post.publishedAt ? format(new Date(post.publishedAt), 'MMM d') : 'N/A',
            likes: post.insight.likes,
            comments: post.insight.comments,
            reach: post.insight.reach,
            impressions: post.insight.impressions
        }));
    };

    const isEmailPlatform = ['EMAIL', 'SMS', 'WHATSAPP'].includes(selectedPlatform?.toUpperCase() || '');

    return (
        <div className="p-6 relative min-h-screen">
            <div className="mx-auto space-y-6 pb-24">
                {/* Header & Platform Cards */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground mt-1">
                        View insights and performance metrics for your posts
                    </p>
                </div>

                {/* Platform Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle>Select Platform</CardTitle>
                        <CardDescription>Choose a platform to view analytics</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingPlatforms ? (
                            <div className="flex items-center gap-2 p-4">
                                <Loader2 className="size-4 animate-spin" />
                                <span className="text-sm text-muted-foreground">Loading platforms...</span>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {organisationPlatforms.map((platform) => {
                                    const isSelected = selectedPlatform === platform;
                                    const Icon = getPlatformIcon(platform);
                                    return (
                                        <button
                                            key={platform}
                                            onClick={() => {
                                                setSelectedPlatform(platform);
                                                setPage(1); // Reset page on platform change
                                                setLoadingPosts(true);
                                                setPosts([]);
                                            }}
                                            disabled={loadingPosts}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[100px] ${loadingPosts ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isSelected
                                                ? 'border-primary bg-primary/10 shadow-sm'
                                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                }`}
                                        >
                                            <Icon className={`size-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                                {platform}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Posts Table */}
                {selectedPlatform && (
                    <div className="space-y-6">
                        {/* Visual Graph Section */}
                        {!loadingPosts && posts.length > 0 && (
                            <Card className="border shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg font-semibold">Engagement Trends</CardTitle>
                                            <CardDescription>Performance over time for loaded posts</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                                <div className="size-2 rounded-full bg-blue-500" />
                                                {isEmailPlatform ? 'Sent' : 'Likes'}
                                            </div>
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                                                <div className="size-2 rounded-full bg-purple-500" />
                                                {isEmailPlatform ? 'Opened' : 'Reach'}
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[250px] w-full mt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={getChartData()}>
                                                <defs>
                                                    <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis
                                                    dataKey="date"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey={isEmailPlatform ? "reach" : "likes"} // Use "reach" for Sent in email
                                                    stroke="#3b82f6"
                                                    strokeWidth={3}
                                                    fillOpacity={1}
                                                    fill="url(#colorLikes)"
                                                    name={isEmailPlatform ? "Sent" : "Likes"}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey={isEmailPlatform ? "impressions" : "reach"}
                                                    stroke="#a855f7"
                                                    strokeWidth={3}
                                                    fillOpacity={1}
                                                    fill="url(#colorReach)"
                                                    name={isEmailPlatform ? "Opened" : "Reach"}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle>{selectedPlatform} Posts</CardTitle>
                                        <CardDescription>Performance metrics for your recent posts</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">From:</span>
                                            <input
                                                type="date"
                                                className="bg-background border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                                                value={startDate}
                                                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">To:</span>
                                            <input
                                                type="date"
                                                className="bg-background border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                                                value={endDate}
                                                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                            />
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExportExcel}
                                            disabled={loadingPosts || posts.length === 0}
                                            className="cursor-pointer"
                                        >
                                            <BarChart2 className="mr-2 size-3" />
                                            Export Excel
                                        </Button>

                                        <Button
                                            className='cursor-pointer'
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fetchPosts(true)}
                                            disabled={loadingPosts}
                                        >
                                            <RefreshCw className={`mr-2 size-3 ${loadingPosts ? 'animate-spin' : ''}`} />
                                            Refresh
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {loadingPosts ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Loader2 className="size-10 animate-spin text-primary mb-4" />
                                        <p className="text-muted-foreground animate-pulse">Fetching latest analytics...</p>
                                    </div>
                                ) : posts.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <p>No posts found for this platform.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[80px]">Media</TableHead>
                                                        <TableHead className="min-w-[150px] max-w-[250px]">Subject / Content</TableHead>
                                                        {isEmailPlatform ? (
                                                            <>
                                                                <TableHead>Sent</TableHead>
                                                                <TableHead>Delivered</TableHead>
                                                                <TableHead>Opened</TableHead>
                                                                <TableHead>Click Rate</TableHead>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <TableHead>Likes</TableHead>
                                                                <TableHead>Comments</TableHead>
                                                                <TableHead>Reach</TableHead>
                                                                <TableHead>Engagement</TableHead>
                                                            </>
                                                        )}
                                                        <TableHead>Published</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {posts.map((post) => (
                                                        <TableRow
                                                            key={post.id}
                                                            className={`cursor-pointer hover:bg-muted/50 ${post.insight?.isDeleted ? 'opacity-60 bg-red-50 hover:bg-red-50' : ''}`}
                                                            onClick={() => viewDetails(post)}
                                                        >
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <div className="relative size-12 rounded-md overflow-hidden bg-muted border">
                                                                    {post.postType === 'VIDEO' || getCleanMediaUrl(post.mediaUrls).toLowerCase().endsWith('.mp4') ? (
                                                                        <div className="flex items-center justify-center h-full bg-slate-900">
                                                                            <Video className="size-5 text-white" />
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
                                                                        <div className="flex items-center justify-center h-full">
                                                                            <ImageIcon className="size-5 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="space-y-1">
                                                                    {post.subject && (
                                                                        <p className="text-sm font-semibold text-foreground line-clamp-1" title={post.subject}>
                                                                            {post.subject}
                                                                        </p>
                                                                    )}
                                                                    <p className={`text-xs text-muted-foreground ${post.insight?.isDeleted ? 'line-through text-red-400' : ''}`} title={post.message || ''}>
                                                                        {truncateWords(post.message, 15)}
                                                                    </p>
                                                                    {post.insight?.isDeleted && (
                                                                        <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                                                            Deleted
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableCell>

                                                            {isEmailPlatform ? (
                                                                <>
                                                                    <TableCell>{post.insight?.isDeleted ? '-' : post.insight?.reach ?? 0}</TableCell>
                                                                    <TableCell>{post.insight?.isDeleted ? '-' : post.insight?.reach ?? 0}</TableCell>
                                                                    <TableCell>{post.insight?.isDeleted ? '-' : post.insight?.impressions ?? 0}</TableCell>
                                                                    <TableCell>
                                                                        {post.insight?.isDeleted ? '-' : '0.0%'}
                                                                    </TableCell>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <TableCell>{post.insight?.likes ?? 0}</TableCell>
                                                                    <TableCell>{post.insight?.comments ?? 0}</TableCell>
                                                                    <TableCell>{post.insight?.reach ?? 0}</TableCell>
                                                                    <TableCell>
                                                                        {post.insight?.engagementRate ? `${post.insight.engagementRate.toFixed(2)}%` : '0.00%'}
                                                                    </TableCell>
                                                                </>
                                                            )}

                                                            <TableCell className="text-muted-foreground text-sm">
                                                                {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : 'N/A'}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                                    <Button
                                                                        className="cursor-pointer"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleSync(post)}
                                                                        disabled={syncing === post.id}
                                                                    >
                                                                        <RefreshCw className={`size-4 ${syncing === post.id ? 'animate-spin' : ''}`} />
                                                                    </Button>
                                                                    <Button
                                                                        className="cursor-pointer"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => viewDetails(post)}
                                                                    >
                                                                        <BarChart2 className="size-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between pt-4">
                                                <p className="text-sm text-muted-foreground">
                                                    Showing <span className="font-medium">{posts.length}</span> of <span className="font-medium">{totalCount}</span> posts
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={page === 1}
                                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    >
                                                        Previous
                                                    </Button>
                                                    <div className="flex items-center gap-1">
                                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                            .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                                                            .map((pageNum) => (
                                                                <Button
                                                                    key={pageNum}
                                                                    variant={page === pageNum ? 'default' : 'ghost'}
                                                                    size="icon"
                                                                    className="h-8 w-8 text-xs"
                                                                    onClick={() => setPage(pageNum)}
                                                                >
                                                                    {pageNum}
                                                                </Button>
                                                            ))}
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={page === totalPages}
                                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* AI Assistant Floating Chat */}
            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out ${isChatOpen ? 'w-[380px]' : 'w-auto'}`}>
                {isChatOpen ? (
                    <Card className="border shadow-2xl overflow-hidden glass-panel">
                        <div className="bg-primary p-4 flex items-center justify-between text-primary-foreground">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white/20 rounded-full">
                                    <Sparkles className="size-4 text-yellow-300 fill-yellow-300" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">AI Analytics Assistant</h3>
                                    <span className="text-[10px] text-primary-foreground/80 block">Everything about your data</span>
                                </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/20" onClick={() => setIsChatOpen(false)}>
                                <X className="size-4" />
                            </Button>
                        </div>
                        <div className="h-[400px] flex flex-col bg-background/95 backdrop-blur-sm">
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-4">
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                                : 'bg-muted text-foreground rounded-bl-none border'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-2 border flex items-center gap-2">
                                                <Loader2 className="size-3 animate-spin text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">Analyzing data...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                            <div className="p-3 border-t bg-background">
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <input
                                        className="flex-1 bg-muted/50 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70"
                                        placeholder="Ask about your engagement..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        disabled={isChatLoading}
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        className="rounded-full shrink-0"
                                        disabled={!chatInput.trim() || isChatLoading}
                                    >
                                        <Send className="size-4" />
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Button
                        onClick={() => setIsChatOpen(true)}
                        size="lg"
                        className="rounded-full shadow-lg h-14 w-14 p-0 bg-primary hover:bg-primary/90 transition-transform hover:scale-110 active:scale-95 group relative"
                    >
                        <Bot className="size-8" />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    </Button>
                )}
            </div>
        </div>
    );
}
