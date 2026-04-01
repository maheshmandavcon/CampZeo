'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
    Sparkles,
    Download
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
    Area,
    FunnelChart,
    Funnel,
    LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportChartToPDF } from '@/lib/chart-export';

interface PostInsight {
    reach: string | number;
    impressions: string | number;
    likes: string | number;
    comments: string | number;
    saves: number;
    shares: number;
    videoViews: number;
    watchTime: number;
    averageViewDuration: number;
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
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // Start empty to show Welcome Prompts
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

    // Groq AI Chat State (Positioned Left)
    const [isGroqChatOpen, setIsGroqChatOpen] = useState(false);
    const [groqChatMessages, setGroqChatMessages] = useState<ChatMessage[]>([]);
    const [groqChatInput, setGroqChatInput] = useState('');
    const [isGroqChatLoading, setIsGroqChatLoading] = useState(false);

    // Analytics Cache State
    const [analyticsCache, setAnalyticsCache] = useState<any>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const [isSyncingAnalytics, setIsSyncingAnalytics] = useState(false);
    const hasSynced = useRef(false); // Prevent duplicate sync in StrictMode

    // AI Delayed Prompt State
    const [pendingMessage, setPendingMessage] = useState<{ text: string, type: 'gemini' | 'groq' } | null>(null);
    const [showSyncPrompt, setShowSyncPrompt] = useState<{ gemini: boolean, groq: boolean }>({ gemini: false, groq: false });

    // Funnel Data State
    const [funnelData, setFunnelData] = useState<any[]>([]);
    const [loadingFunnel, setLoadingFunnel] = useState(true);

    // Chart Refs for PDF Export
    const funnelChartRef = useRef<HTMLDivElement>(null);
    const engagementTrendsChartRef = useRef<HTMLDivElement>(null);

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
    const fetchPosts = useCallback(async (forceRefresh = false) => {
        if (!selectedPlatform) return;

        setLoadingPosts(true);
        try {
            let url = `/api/analytics/posts?platform=${selectedPlatform}&page=${page}&limit=${limit}`;
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
    }, [selectedPlatform, page, startDate, endDate, limit]);

    useEffect(() => {
        if (selectedPlatform) {
            fetchPosts(false);
        } else {
            setPosts([]);
        }
    }, [selectedPlatform, page, startDate, endDate]);

    const syncAnalyticsOnLoad = useCallback(async (forceFullSync = false) => {
        setIsSyncingAnalytics(true);
        try {
            console.log(`[Analytics Page] Syncing ${forceFullSync ? 'FRESH' : 'cached'} metrics...`);
            // Professional approach: If not forced, we could have a 'fast' endpoint that only reads DB
            // but for now we use the existing sync-all. We can add a Param if we want to optimize further.
            const response = await fetch(`/api/analytics/sync-all${forceFullSync ? '' : '?skipSync=true'}`);
            if (!response.ok) throw new Error('Failed to sync analytics');

            const data = await response.json();
            setAnalyticsCache(data.analytics);
            setLastSyncedAt(data.syncedAt);

            // Persist to localStorage
            localStorage.setItem('campzeo_analytics_cache', JSON.stringify(data.analytics));
            localStorage.setItem('campzeo_analytics_last_sync', data.syncedAt);

            console.log('[Analytics Page] Analytics synced and cached:', data.syncedAt);
            toast.success(forceFullSync ? 'Full metrics refresh complete' : 'Data loaded from database');
        } catch (error) {
            console.error('[Analytics Page] Sync error:', error);
            toast.error('Failed to sync analytics data');
        } finally {
            setIsSyncingAnalytics(false);
        }
    }, []);

    // Sync analytics data on page load - SMART CACHING
    useEffect(() => {
        const loadCache = () => {
            const savedCache = localStorage.getItem('campzeo_analytics_cache');
            const savedTime = localStorage.getItem('campzeo_analytics_last_sync');
            if (savedCache && savedTime) {
                try {
                    setAnalyticsCache(JSON.parse(savedCache));
                    setLastSyncedAt(savedTime);
                    console.log('[Analytics Page] Restored cache from localStorage:', savedTime);
                    return true;
                } catch (e) {
                    console.error('Failed to parse cache', e);
                }
            }
            return false;
        };

        const hasCache = loadCache();

        // Only trigger automatic sync if no cache exists or if specifically needed
        if (hasSynced.current) return;
        hasSynced.current = true;

        if (!hasCache) {
            syncAnalyticsOnLoad();
        }
    }, [syncAnalyticsOnLoad]);


    // Fetch Funnel Data
    useEffect(() => {
        const fetchFunnelData = async () => {
            setLoadingFunnel(true);
            try {
                let url = '/api/analytics/funnel';
                if (startDate || endDate) {
                    const params = new URLSearchParams();
                    if (startDate) params.append('startDate', startDate);
                    if (endDate) params.append('endDate', endDate);
                    url += `?${params.toString()}`;
                }
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setFunnelData(data.funnel || []);
                }
            } catch (error) {
                console.error('Error fetching funnel data:', error);
            } finally {
                setLoadingFunnel(false);
            }
        };

        fetchFunnelData();
    }, [startDate, endDate]);

    const handleSync = async (post: Post) => {
        setSyncing(post.id);
        try {
            const response = await fetch(`/api/analytics/post-details/${post.id}?fresh=true&platform=${post.platform}&postId=${post.postId}`);
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
    const handleSyncAllPosts = async () => {
        if (posts.length === 0) return;

        setSyncing(-1); // All posts syncing indicator
        try {
            const syncPromises = posts.map(post =>
                fetch(`/api/analytics/post-details/${post.id}?fresh=true&platform=${post.platform}&postId=${post.postId}`)
                    .then(res => res.json())
                    .catch(err => null)
            );

            const results = await Promise.all(syncPromises);

            const updatedPosts = posts.map((post, idx) =>
                results[idx]?.post || post
            );

            setPosts(updatedPosts);
            toast.success(`Synced ${posts.length} posts - metrics updated`);
        } catch (error) {
            console.error('Error syncing all posts:', error);
            toast.error('Failed to sync posts metrics');
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
                    <div className="p-0.5  rounded-full size-6 flex items-center justify-center">
                        <span className="text-black text-[22px] font-semibold">P</span>
                    </div>
                );
            default:
                return Send;
        }
    };

    // Calculate instant answers from cached data
    const getInstantAnswer = (prompt: string): string | null => {
        if (!analyticsCache) return null;

        const { allPosts, campaignPosts, dataInfo } = analyticsCache;

        switch (prompt) {
            case "Total Average Views": {
                const postsWithMetrics = allPosts.filter((p: any) => p.metrics);
                if (postsWithMetrics.length === 0) return "No posts with metrics found.";

                const totalImpressions = postsWithMetrics.reduce((sum: number, p: any) =>
                    sum + (p.metrics?.impressions || 0), 0);
                const avgImpressions = Math.round(totalImpressions / postsWithMetrics.length);

                return `📊 **Total Average Views**: ${avgImpressions.toLocaleString()} impressions\n\nBased on ${postsWithMetrics.length} posts across all platforms.`;
            }

            case "Best Performing Platform": {
                const platformStats: Record<string, { total: number, count: number }> = {};

                allPosts.forEach((p: any) => {
                    if (p.metrics) {
                        if (!platformStats[p.platform]) {
                            platformStats[p.platform] = { total: 0, count: 0 };
                        }
                        platformStats[p.platform].total += (p.metrics.likes || 0) + (p.metrics.comments || 0);
                        platformStats[p.platform].count++;
                    }
                });

                const platforms = Object.entries(platformStats)
                    .map(([platform, stats]) => ({
                        platform,
                        avgEngagement: stats.total / stats.count,
                        totalEngagement: stats.total,
                        posts: stats.count
                    }))
                    .sort((a, b) => b.avgEngagement - a.avgEngagement);

                if (platforms.length === 0) return "No platform data available.";

                const best = platforms[0];
                return `🏆 **Best Performing Platform**: ${best.platform}\n\n` +
                    `• Average Engagement: ${Math.round(best.avgEngagement)} per post\n` +
                    `• Total Engagement: ${best.totalEngagement.toLocaleString()}\n` +
                    `• Posts Analyzed: ${best.posts}`;
            }

            case "Campaign Summary": {
                if (campaignPosts.length === 0) return "No campaign posts found.";

                const campaigns: Record<string, any> = {};
                campaignPosts.forEach((p: any) => {
                    const name = p.campaignName || 'Uncategorized';
                    if (!campaigns[name]) {
                        campaigns[name] = { posts: 0, likes: 0, comments: 0, impressions: 0 };
                    }
                    if (p.metrics) {
                        campaigns[name].posts++;
                        campaigns[name].likes += p.metrics.likes || 0;
                        campaigns[name].comments += p.metrics.comments || 0;
                        campaigns[name].impressions += p.metrics.impressions || 0;
                    }
                });

                const summary = Object.entries(campaigns)
                    .map(([name, stats]: [string, any]) =>
                        `**${name}**\n` +
                        `• Posts: ${stats.posts}\n` +
                        `• Avg Engagement: ${Math.round((stats.likes + stats.comments) / stats.posts)}\n` +
                        `• Total Impressions: ${stats.impressions.toLocaleString()}`
                    )
                    .join('\n\n');

                return `📈 **Campaign Summary**\n\n${summary}`;
            }

            case "Engagement Trends": {
                const postsWithMetrics = allPosts.filter((p: any) => p.metrics && p.publishedAt);
                if (postsWithMetrics.length < 2) return "Not enough data for trend analysis.";

                // Sort by date
                postsWithMetrics.sort((a: any, b: any) =>
                    new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
                );

                const half = Math.floor(postsWithMetrics.length / 2);
                const firstHalf = postsWithMetrics.slice(0, half);
                const secondHalf = postsWithMetrics.slice(half);

                const avgFirst = firstHalf.reduce((sum: number, p: any) =>
                    sum + (p.metrics.likes || 0) + (p.metrics.comments || 0), 0) / firstHalf.length;
                const avgSecond = secondHalf.reduce((sum: number, p: any) =>
                    sum + (p.metrics.likes || 0) + (p.metrics.comments || 0), 0) / secondHalf.length;

                const change = ((avgSecond - avgFirst) / avgFirst * 100).toFixed(1);
                const trend = avgSecond > avgFirst ? '📈 Increasing' : '📉 Decreasing';

                return `${trend} **Engagement Trends**\n\n` +
                    `• Recent Average: ${Math.round(avgSecond)} interactions\n` +
                    `• Previous Average: ${Math.round(avgFirst)} interactions\n` +
                    `• Change: ${change}%`;
            }

            default:
                return null;
        }
    };

    const sendMessage = async (text: string, skipSyncPrompt = false) => {
        if (!text.trim() || isChatLoading) return;

        // If it's the first message and we have cache, ask for sync preference
        if (!skipSyncPrompt && chatMessages.length === 0 && analyticsCache) {
            setPendingMessage({ text, type: 'gemini' });
            setShowSyncPrompt(prev => ({ ...prev, gemini: true }));
            setChatMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
            return;
        }

        setChatInput('');
        if (!skipSyncPrompt || chatMessages.find(m => m.role === 'user' && m.content === text) === undefined) {
            // Only add if not already optimistically added by prompt flow
            setChatMessages(prev => {
                if (prev.find(m => m.role === 'user' && m.content === text)) return prev;
                return [...prev, { role: 'user', content: text, timestamp: new Date() }];
            });
        }

        // Check if we can provide an instant answer from cached data
        const instantAnswer = getInstantAnswer(text);
        if (instantAnswer) {
            // Provide instant answer without calling AI
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: instantAnswer,
                timestamp: new Date()
            }]);
            return;
        }

        // For custom questions, call AI with cached data
        setIsChatLoading(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    analyticsData: analyticsCache // Pass cached analytics data
                })
            });

            if (!response.ok) throw new Error('Failed to get answer');

            const data = await response.json();
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: new Date() }]);
        } catch (error) {
            console.error('Chat error:', error);
            // toast.error('Failed to connect to AI Assistant'); // Squelch toast to keep UI clean, error message in chat is enough
            setChatMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to the analytics engine right now. Please try again later.", timestamp: new Date() }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const sendGroqMessage = async (text: string, skipSyncPrompt = false) => {
        if (!text.trim() || isGroqChatLoading) return;

        // If it's the first message and we have cache, ask for sync preference
        if (!skipSyncPrompt && groqChatMessages.length === 0 && analyticsCache) {
            setPendingMessage({ text, type: 'groq' });
            setShowSyncPrompt(prev => ({ ...prev, groq: true }));
            setGroqChatMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
            return;
        }

        setGroqChatInput('');
        if (!skipSyncPrompt || groqChatMessages.find(m => m.role === 'user' && m.content === text) === undefined) {
            setGroqChatMessages(prev => {
                if (prev.find(m => m.role === 'user' && m.content === text)) return prev;
                return [...prev, { role: 'user', content: text, timestamp: new Date() }];
            });
        }

        // Check if we can provide an instant answer from cached data
        const instantAnswer = getInstantAnswer(text);
        if (instantAnswer) {
            setGroqChatMessages(prev => [...prev, {
                role: 'assistant',
                content: instantAnswer,
                timestamp: new Date()
            }]);
            return;
        }

        setIsGroqChatLoading(true);

        try {
            const response = await fetch('/api/ai/groq-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    analyticsData: analyticsCache
                })
            });

            if (!response.ok) throw new Error('Failed to get answer');

            const data = await response.json();
            setGroqChatMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: new Date() }]);
        } catch (error) {
            console.error('Groq Chat error:', error);
            setGroqChatMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to the Groq analytics engine right now. Please try again later.", timestamp: new Date() }]);
        } finally {
            setIsGroqChatLoading(false);
        }
    };

    const handleSyncChoice = async (type: 'latest' | 'existing', mode: 'gemini' | 'groq') => {
        if (!pendingMessage) return;

        const currentMessage = pendingMessage.text;
        setShowSyncPrompt(prev => ({ ...prev, [mode]: false }));
        setPendingMessage(null);

        if (type === 'latest') {
            if (mode === 'gemini') {
                setChatMessages(prev => [...prev, { role: 'assistant', content: "Refreshing latest analytics for you... this may take a moment. ⏳", timestamp: new Date() }]);
            } else {
                setGroqChatMessages(prev => [...prev, { role: 'assistant', content: "Fetching fresh metrics from all platforms... please hold on. ⏳", timestamp: new Date() }]);
            }
            await syncAnalyticsOnLoad(true); // Force full sync
        }

        // Now proceed with actual message
        if (mode === 'gemini') {
            sendMessage(currentMessage, true);
        } else {
            sendGroqMessage(currentMessage, true);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        sendMessage(chatInput);
    };

    // CSV Export
    const handleExportCSV = () => {
        if (!posts.length) return;

        const isEmailOrSms = ['EMAIL', 'SMS', 'WHATSAPP'].includes(selectedPlatform?.toUpperCase() || '');

        let headers = ['Post/Message', 'Subject', 'Image Name', 'Image Link', 'Published At', 'Platform', 'Type', 'Status'];
        if (isEmailOrSms) {
            headers.push('Sent (Reach)', 'Delivered', 'Opened (Impressions)', 'Delivery Rate');
        } else if (selectedPlatform === 'YOUTUBE') {
            headers.push('Likes', 'Comments', 'Watch Time', 'Avg View', 'Engagement Rate');
        } else if (selectedPlatform === 'PINTEREST') {
            headers.push('Saves', 'Comments', 'Views', 'Impressions', 'Engagement Rate');
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

            let rowByType: (string | number)[] = [];
            if (isEmailOrSms) {
                rowByType = [
                    post.insight.reach, // Sent
                    post.insight.reach, // Delivered (simplified assumption for now unless detailed)
                    post.insight.impressions, // Opened
                    '100%' // Delivery Rate
                ];
            } else if (selectedPlatform === 'YOUTUBE') {
                rowByType = [
                    post.insight.likes,
                    post.insight.comments,
                    `${(post.insight.watchTime || 0).toFixed(1)}m`,
                    `${Math.floor((post.insight.averageViewDuration || 0) / 60)}:${Math.floor((post.insight.averageViewDuration || 0) % 60).toString().padStart(2, '0')}`,
                    `${post.insight.engagementRate.toFixed(2)}%`
                ];
            } else if (selectedPlatform === 'PINTEREST') {
                rowByType = [
                    post.insight.likes,
                    post.insight.comments,
                    post.insight.reach, // Views
                    post.insight.impressions,
                    `${post.insight.engagementRate.toFixed(2)}%`
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
            } else if (selectedPlatform === 'YOUTUBE') {
                return {
                    ...baseData,
                    'Likes': post.insight.likes,
                    'Comments': post.insight.comments,
                    'Watch Time (min)': (post.insight.watchTime || 0).toFixed(1),
                    'Avg View': `${Math.floor((post.insight.averageViewDuration || 0) / 60)}:${Math.floor((post.insight.averageViewDuration || 0) % 60).toString().padStart(2, '0')}`,
                    'Engagement Rate': `${post.insight.engagementRate.toFixed(2)}%`
                };
            } else if (selectedPlatform === 'PINTEREST') {
                return {
                    ...baseData,
                    'Saves': post.insight.likes,
                    'Comments': post.insight.comments,
                    'Views': post.insight.reach,
                    'Impressions': post.insight.impressions,
                    'Engagement Rate': `${post.insight.engagementRate.toFixed(2)}%`
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
    const getChartData = useMemo(() => {
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
    }, [posts]);

    // PDF Export Handlers
    const handleExportFunnelChart = async () => {
        try {
            await exportChartToPDF(funnelChartRef, 'marketing-funnel-chart', 'Marketing Funnel');
            toast.success('Funnel chart exported to PDF');
        } catch (error) {
            toast.error('Failed to export chart');
        }
    };

    const handleExportEngagementChart = async () => {
        try {
            const chartTitle = `${selectedPlatform} Engagement Trends`;
            await exportChartToPDF(engagementTrendsChartRef, `${selectedPlatform}-engagement-trends`, chartTitle);
            toast.success('Engagement chart exported to PDF');
        } catch (error) {
            toast.error('Failed to export chart');
        }
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
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleExportEngagementChart}
                                                className="cursor-pointer ml-2"
                                            >
                                                <Download className="size-4 mr-2" />
                                                Export PDF
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div ref={engagementTrendsChartRef} className="h-[250px] w-full mt-2" style={{ width: '100%', height: '250px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={getChartData}>
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
                                                    isAnimationActive={false}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey={isEmailPlatform ? "impressions" : "reach"}
                                                    stroke="#a855f7"
                                                    strokeWidth={3}
                                                    fillOpacity={1}
                                                    fill="url(#colorReach)"
                                                    name={isEmailPlatform ? "Opened" : "Reach"}
                                                    isAnimationActive={false}
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
                                            onClick={async () => {
                                                await fetchPosts(true);
                                                await handleSyncAllPosts(); // Sync all posts metrics
                                            }}
                                        >
                                            <RefreshCw className={`mr-2 size-3 ${loadingPosts || syncing === -1 ? 'animate-spin' : ''}`} />
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
                                                                <TableHead>{selectedPlatform === 'PINTEREST' ? 'Saves' : 'Likes'}</TableHead>
                                                                <TableHead>Comments</TableHead>
                                                                <TableHead>
                                                                    {selectedPlatform === 'YOUTUBE' ? 'Watch Time' :
                                                                        selectedPlatform === 'PINTEREST' ? 'Views' : 'Reach'}
                                                                </TableHead>
                                                                <TableHead>
                                                                    {selectedPlatform === 'YOUTUBE' ? 'Avg View' : 'Engagement'}
                                                                </TableHead>
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
                                                                    <TableCell>
                                                                        {selectedPlatform === 'YOUTUBE'
                                                                            ? `${(post.insight?.watchTime ?? 0).toFixed(1)}m`
                                                                            : post.insight?.reach ?? 0}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {selectedPlatform === 'YOUTUBE'
                                                                            ? `${Math.floor((post.insight?.averageViewDuration ?? 0) / 60)}:${Math.floor((post.insight?.averageViewDuration ?? 0) % 60).toString().padStart(2, '0')}`
                                                                            : (post.insight?.engagementRate ? `${post.insight.engagementRate.toFixed(2)}%` : '0.00%')}
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

                                                    <div className="flex items-center gap-2 ml-4 border-l pl-4">
                                                        <span className="text-xs text-muted-foreground whitespace-nowrap text-[11px]">Go to:</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={totalPages}
                                                            className="w-12 h-8 border rounded text-center text-xs outline-none focus:ring-1 focus:ring-primary"
                                                            defaultValue={page}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    const val = parseInt((e.target as HTMLInputElement).value);
                                                                    if (val >= 1 && val <= totalPages) {
                                                                        setPage(val);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
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

            {/* Groq Floating Chat Window - FIXED BOTTOM LEFT */}
            {isGroqChatOpen ? (
                <Card className="border shadow-2xl overflow-hidden flex flex-col h-[600px] w-[450px] rounded-2xl ring-1 ring-black/5 fixed bottom-4 left-4 z-50">
                    {/* Header */}
                    <div className="p-4 border-b shrink-0 bg-white z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bot className="size-5 text-indigo-600" />
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Groq AI Assistant (Llama 3.3)</h3>
                                <p className="text-[10px] text-muted-foreground">Reports, Metrics & Sentiment Analysis</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-gray-100 rounded-full"
                            onClick={() => setIsGroqChatOpen(false)}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    {/* Chat Area */}
                    <CardContent className="p-0 flex-1 flex flex-col min-h-0 bg-background">
                        <ScrollArea className="flex-1 min-h-0 p-4">
                            <div className="space-y-6 pb-4">
                                {groqChatMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-muted-foreground px-4">
                                        <div className="bg-indigo-50 p-3 rounded-full mb-3">
                                            <Bot className="size-6 text-indigo-600" />
                                        </div>
                                        <h4 className="font-semibold text-gray-900 mb-1">Deep Analytics with Groq</h4>
                                        <p className="text-xs max-w-[250px] mx-auto">
                                            Llama 3.3 powered sentiment analysis and metric-heavy reports.
                                        </p>
                                    </div>
                                ) : (
                                    groqChatMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start w-full'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user'
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-muted/30 border text-foreground'
                                                    }`}
                                            >
                                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                            </div>
                                            <p className="text-[9px] opacity-70 px-1">
                                                {format(new Date(msg.timestamp), 'h:mm a')}
                                            </p>
                                        </div>
                                    ))
                                )}

                                {showSyncPrompt.groq && (
                                    <div className="flex justify-start w-full">
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-4 shadow-sm space-y-3 w-full max-w-[90%]">
                                            <div className="flex items-center gap-2">
                                                <RefreshCw className="size-4 text-indigo-600" />
                                                <p className="text-xs font-semibold text-indigo-900">Data Freshness Alert</p>
                                            </div>
                                            <p className="text-[11px] text-indigo-700 leading-relaxed">
                                                Your last sync was <strong>{lastSyncedAt ? format(new Date(lastSyncedAt), 'MMM d, h:mm a') : 'never'}</strong>.
                                                For large accounts, a fresh sync can take up to 30 seconds.
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-[10px] border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                                                    onClick={() => handleSyncChoice('latest', 'groq')}
                                                >
                                                    Fetch Latest
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="h-8 text-[10px] bg-indigo-600 text-white hover:bg-indigo-700"
                                                    onClick={() => handleSyncChoice('existing', 'groq')}
                                                >
                                                    Continue with Existing
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isGroqChatLoading && (
                                    <div className="flex justify-start w-full">
                                        <div className="bg-muted/30 border rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                                            <div className="bg-indigo-100 p-1.5 rounded-full">
                                                <Bot className="size-3 text-indigo-600 animate-pulse" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium">Groq is thinking...</p>
                                                <p className="text-[10px] text-muted-foreground">Analyzing deep metrics & sentiment</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-4 bg-background border-t shrink-0">
                            <div className="mb-3 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide">
                                <div className="flex gap-2 w-max">
                                    {[
                                        "Platform Performance Comparison",
                                        "Overall Sentiment Analysis",
                                        "Top 3 Best Posts Report",
                                        "Engagement Growth Forecast"
                                    ].map((prompt, i) => (
                                        <Badge
                                            key={i}
                                            onClick={() => sendGroqMessage(prompt)}
                                            className="cursor-pointer hover:bg-indigo-600 hover:text-white transition-colors px-3 py-1.5 text-[10px] font-normal whitespace-nowrap border-indigo-100 bg-indigo-50 text-indigo-700"
                                        >
                                            {prompt}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 items-end">
                                <Textarea
                                    placeholder="Ask for reports or sentiment..."
                                    value={groqChatInput}
                                    onChange={(e) => setGroqChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendGroqMessage(groqChatInput);
                                        }
                                    }}
                                    className="min-h-[50px] max-h-[100px] border-indigo-100 rounded-xl resize-none py-3 text-xs focus-visible:ring-indigo-200"
                                />
                                <Button
                                    onClick={() => sendGroqMessage(groqChatInput)}
                                    disabled={!groqChatInput.trim() || isGroqChatLoading}
                                    className="h-[50px] w-[50px] shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-sm bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {isGroqChatLoading ? (
                                        <Loader2 className="size-5 animate-spin text-white" />
                                    ) : (
                                        <Send className="size-4 text-white" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Button
                    onClick={() => setIsGroqChatOpen(true)}
                    className="rounded-full h-14 w-14 fixed bottom-4 left-4 z-40 shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300 bg-indigo-600 text-white group"
                >
                    <Bot className="size-6 group-hover:rotate-12 transition-transform" />
                    <span className="sr-only">Open Groq AI Assistant</span>
                </Button>
            )}

            {/* Google Floating Chat Window - FIXED BOTTOM RIGHT */}
            {isChatOpen ? (
                <Card className="border shadow-2xl overflow-hidden flex flex-col h-[600px] w-[450px] rounded-2xl ring-1 ring-black/5 fixed bottom-4 right-4 z-50">
                    {/* Header */}
                    <div className="p-4 border-b shrink-0 bg-white z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-5 text-primary" />
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">AI Analytics Assistant (Gemini)</h3>
                                <p className="text-[10px] text-muted-foreground">Ask about metrics, comparisons, and performance</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-gray-100 rounded-full"
                            onClick={() => setIsChatOpen(false)}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    {/* Chat Area */}
                    <CardContent className="p-0 flex-1 flex flex-col min-h-0 bg-background">
                        <ScrollArea className="flex-1 min-h-0 p-4">
                            <div className="space-y-6 pb-4">
                                {/* Welcome State */}
                                {chatMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-muted-foreground px-4">
                                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                                            <Sparkles className="size-6 text-primary" />
                                        </div>
                                        <h4 className="font-semibold text-gray-900 mb-1">Interactive Analytics</h4>
                                        <p className="text-xs max-w-[250px] mx-auto">
                                            Gemini powered quick insights and platform comparisons.
                                        </p>
                                    </div>
                                ) : (
                                    // Chat History
                                    chatMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start w-full'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted/30 border text-foreground'
                                                    }`}
                                            >
                                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                            </div>
                                            <p className="text-[9px] opacity-70 px-1">
                                                {format(new Date(msg.timestamp), 'h:mm a')}
                                            </p>
                                        </div>
                                    ))
                                )}

                                {showSyncPrompt.gemini && (
                                    <div className="flex justify-start w-full">
                                        <div className="bg-primary/5 border border-primary/10 rounded-2xl px-4 py-4 shadow-sm space-y-3 w-full max-w-[90%]">
                                            <div className="flex items-center gap-2">
                                                <RefreshCw className="size-4 text-primary" />
                                                <p className="text-xs font-semibold text-primary">Data Freshness Alert</p>
                                            </div>
                                            <p className="text-[11px] text-primary/80 leading-relaxed">
                                                Your current data is from <strong>{lastSyncedAt ? format(new Date(lastSyncedAt), 'MMM d, h:mm a') : 'never'}</strong>.
                                                Would you like to analyze with the latest metrics?
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-[10px] border-primary/20 text-primary hover:bg-primary/10"
                                                    onClick={() => handleSyncChoice('latest', 'gemini')}
                                                >
                                                    Sync Latest
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="h-8 text-[10px] bg-primary text-primary-foreground"
                                                    onClick={() => handleSyncChoice('existing', 'gemini')}
                                                >
                                                    Use Existing
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Loading State */}
                                {isChatLoading && (
                                    <div className="flex justify-start w-full">
                                        <div className="bg-muted/30 border rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                                            <div className="bg-primary/20 p-1.5 rounded-full">
                                                <Sparkles className="size-3 text-primary animate-pulse" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium">Gemini is thinking...</p>
                                                <p className="text-[10px] text-muted-foreground">Processing metrics & trends</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area - Fixed at Bottom */}
                        <div className="p-4 bg-background border-t shrink-0">
                            {/* Persistent Quick Prompts - Styled as Badges */}
                            <div className="mb-3 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide">
                                <div className="flex gap-2 w-max">
                                    {[
                                        "Total Average Views",
                                        "Best Performing Platform",
                                        "Campaign Summary",
                                        "Engagement Trends"
                                    ].map((prompt, i) => (
                                        <Badge
                                            key={i}
                                            onClick={() => sendMessage(prompt)}
                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1.5 text-[10px] font-normal whitespace-nowrap border-primary/10 bg-primary/5 text-primary"
                                        >
                                            {prompt}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 items-end">
                                <Textarea
                                    placeholder="Ask about metrics & trends..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(chatInput);
                                        }
                                    }}
                                    className="min-h-[50px] max-h-[100px] border-primary/20 rounded-xl resize-none py-3 text-xs focus-visible:ring-primary/20"
                                />
                                <Button
                                    onClick={() => sendMessage(chatInput)}
                                    disabled={!chatInput.trim() || isChatLoading}
                                    className="h-[50px] w-[50px] shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-sm"
                                >
                                    {isChatLoading ? (
                                        <Loader2 className="size-5 animate-spin" />
                                    ) : (
                                        <Send className="size-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Button
                    onClick={() => setIsChatOpen(true)}
                    className="rounded-full h-14 w-14 fixed bottom-4 right-4 z-40  shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300 bg-primary text-primary-foreground group"
                >
                    <Sparkles className="size-6 group-hover:rotate-12 transition-transform" />
                    <span className="sr-only">Open Gemini Assistant</span>
                </Button>
            )}
        </div>
    );
}
