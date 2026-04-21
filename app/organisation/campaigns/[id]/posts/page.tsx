'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { getPlatformIcon, getStatusBadge, getPreviewContent } from './_components/post-helpers';
import { getMediaPreviewUrl } from '@/lib/media-utils';
import { MetaBoostSection, MetaBoostOptions } from './_components/MetaBoostSection';
import { Rocket, Edit, Trash2, ExternalLink, Share2, Facebook, Instagram, Linkedin, Youtube, Pin, MoreVertical, Search, Filter, Calendar, CheckCircle2, AlertCircle, Clock, Sparkles, Send, ArrowLeft, Loader2, Plus, Mail, MessageSquare, Phone, Copy, Eye, Check, Paperclip, Globe, Download, Save, Users } from 'lucide-react';
import { openNativeBoostPopup } from '@/lib/meta-boost-utils';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

interface Post {
    id: number;
    subject: string | null;
    message: string | null;
    type: string;
    scheduledPostTime: string | null;
    isPostSent: boolean;
    createdAt: string;
    senderEmail: string | null;
    videoUrl: string | null;
    mediaUrls: string[];
    metadata?: any;
    liveLink?: string | null;
}

interface Campaign {
    id: number;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    contacts?: any[];
    metadata?: any;
}

export default function CampaignPostsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = React.use(params);
    const searchParams = useSearchParams();
    const campaignId = resolvedParams.id;

    // State
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deletePostId, setDeletePostId] = useState<number | null>(null);
    const [boostPost, setBoostPost] = useState<Post | null>(null);
    const [savingBoost, setSavingBoost] = useState(false);
    const [facebookAppId, setFacebookAppId] = useState<string | null>(null);

    // Filter State
    const [activeTab, setActiveTab] = useState('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Helper function for platform icons in tabs
    const getTabPlatformIcon = (platform: string) => {
        switch (platform.toUpperCase()) {
            case 'FACEBOOK': return <Facebook className="size-4" />;
            case 'INSTAGRAM': return <Instagram className="size-4" />;
            case 'LINKEDIN': return <Linkedin className="size-4" />;
            case 'YOUTUBE': return <Youtube className="size-4" />;
            case 'SMS': return <MessageSquare className="size-4" />;
            case 'EMAIL': return <Mail className="size-4" />;
            case 'WHATSAPP': return <Phone className="size-4" />; // Added for consistency with existing getPlatformIcon
            case 'PINTEREST': // Added for consistency with existing getPlatformIcon
                return (
                    <div className="p-0.5 bg-red-600 rounded-full size-4 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">P</span>
                    </div>
                );
            default: return <Globe className="size-4" />;
        }
    };

    const [organisationPlatforms, setOrganisationPlatforms] = useState<string[]>([]);

    // Preview & Share State
    const [previewPost, setPreviewPost] = useState<Post | null>(null);
    const [sharePost, setSharePost] = useState<Post | null>(null);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [sendingShare, setSendingShare] = useState(false);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    const [lastUsedAdAccountId, setLastUsedAdAccountId] = useState<string>('');
    const [boostDialogOptions, setBoostDialogOptions] = useState<MetaBoostOptions | null>(null);
    const [hasPaidPlan, setHasPaidPlan] = useState(false); // Default to false (Secure by default - no flash)
    const [socialStatus, setSocialStatus] = useState<any>(null);

    // Fetch organisation platforms
    useEffect(() => {
        const fetchOrgPlatforms = async () => {
            try {
                const response = await fetch('/api/Organisation/GetPlatforms');
                if (!response.ok) return;
                const data = await response.json();
                setOrganisationPlatforms(data.platforms || []);
            } catch (error) {
                console.error('Error fetching organisation platforms:', error);
            }
        };

        const fetchSubscriptionStatus = async () => {
            try {
                const response = await fetch('/api/subscription/current');
                if (response.ok) {
                    const data = await response.json();
                    const paidStatuses = ['ACTIVE', 'active', 'CANCELING', 'COMPLETED'];
                    const hasPaid = !!data.subscription &&
                        paidStatuses.includes(data.subscription.status) &&
                        !data.trial?.isActive;
                    setHasPaidPlan(hasPaid);
                }
            } catch (error) {
                console.error('Error fetching subscription status:', error);
            }
        };

        const fetchSocialStatus = async () => {
            try {
                const response = await fetch('/api/user/social-status');
                if (response.ok) {
                    const data = await response.json();
                    setSocialStatus(data);
                }
            } catch (error) {
                console.error('Error fetching social status:', error);
            }
        };

        fetchOrgPlatforms();
        fetchSubscriptionStatus();
        fetchSocialStatus();
    }, []);

    // Fetch Meta Ads config
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/socialmedia/meta-ads/config");
                if (res.ok) {
                    const data = await res.json();
                    setFacebookAppId(data.facebookAppId);
                }
            } catch (e) {
                console.error("Failed to fetch Meta Ads config", e);
            }
        };
        fetchConfig();

        // Load last used ad account from local storage
        const stored = localStorage.getItem('last_meta_ad_account_id');
        if (stored) setLastUsedAdAccountId(stored);
    }, []);

    const handleDirectBoost = (post: any) => {
        const adAccountId = post.metadata?.metaBoost?.adAccountId || lastUsedAdAccountId;
        const pageId = post.metadata?.facebookPageId || campaign?.metadata?.facebookPageId;
        const fbPostId = post.metadata?.facebookPostId || post.metadata?.platformPostId || post.liveLink;

        if (post.type === 'INSTAGRAM') {
            // Facebook Ad Center natively rejects Instagram Media IDs and throws a "can't be promoted" error.
            // We MUST use CampZeo's internal dialog for Instagram to perform the API auto-boost.
            const existingBoost = post.metadata?.metaBoost;
            const initialOptions: MetaBoostOptions = {
                enabled: true,
                adAccountId: existingBoost?.adAccountId || lastUsedAdAccountId || '',
                budget: existingBoost?.budget || 5,
                duration: existingBoost?.duration || 7,
                objective: existingBoost?.objective || 'OUTCOME_ENGAGEMENT',
                balance: existingBoost?.balance || '0'
            };
            setBoostDialogOptions(initialOptions);
            setBoostPost(post);
        } else if (post.isPostSent && adAccountId && pageId && fbPostId) {
            openNativeBoostPopup(adAccountId, pageId, fbPostId);
            toast.info("Opening Native Meta Boost Centre...");
        } else {
            // Open dialog and allow user to configure boost options
            const existingBoost = post.metadata?.metaBoost;
            const initialOptions: MetaBoostOptions = {
                enabled: true,
                adAccountId: existingBoost?.adAccountId || lastUsedAdAccountId || '',
                budget: existingBoost?.budget || 5,
                duration: existingBoost?.duration || 7,
                objective: existingBoost?.objective || 'OUTCOME_ENGAGEMENT',
                balance: existingBoost?.balance || '0'
            };
            setBoostDialogOptions(initialOptions);
            setBoostPost(post);
        }
    };

    const handleSaveBoostSettings = async () => {
        if (!boostPost || !boostDialogOptions) return;

        try {
            setSavingBoost(true);
            const response = await fetch(`/api/campaigns/${campaignId}/posts/${boostPost.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...boostPost,
                    metadata: {
                        ...(boostPost.metadata || {}),
                        metaBoost: boostDialogOptions
                    }
                }),
            });

            if (!response.ok) throw new Error('Failed to save boost settings');

            toast.success('Boost settings saved! They will be applied when the post is published.');

            // Update local state
            setPosts(prev => prev.map(p =>
                p.id === boostPost.id
                    ? { ...p, metadata: { ...(p.metadata || {}), metaBoost: boostDialogOptions } }
                    : p
            ));

            setBoostPost(null);
            setBoostDialogOptions(null);
        } catch (error) {
            console.error('Error saving boost settings:', error);
            toast.error('Failed to save boost settings');
        } finally {
            setSavingBoost(false);
        }
    };

    // Fetch campaign and posts
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch campaign
                const campaignResponse = await fetch(`/api/campaigns/${campaignId}`);
                if (!campaignResponse.ok) throw new Error('Failed to fetch campaign');
                const campaignData = await campaignResponse.json();
                setCampaign(campaignData.campaign);

                // Fetch posts
                const postsResponse = await fetch(`/api/campaigns/${campaignId}/posts`);
                if (!postsResponse.ok) throw new Error('Failed to fetch posts');
                const postsData = await postsResponse.json();
                setPosts(postsData.posts);
            } catch (error) {
                console.error('Error fetching data:', error);
                toast.error('Failed to load campaign posts');
                router.push('/organisation/campaigns');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [campaignId, router]);

    // Auto-open share dialog when returning from edit page after adding contacts
    useEffect(() => {
        const returnTo = searchParams.get('returnTo');
        const sharePostId = searchParams.get('postId');

        if (returnTo === 'share' && sharePostId && posts.length > 0 && !loading) {
            const postToShare = posts.find(p => p.id === parseInt(sharePostId));
            if (postToShare) {
                setSharePost(postToShare);
                setSelectedContacts([]);
            }
            // Clean up URL params without reloading
            const url = new URL(window.location.href);
            url.searchParams.delete('returnTo');
            url.searchParams.delete('postId');
            window.history.replaceState({}, '', url.toString());
        }
    }, [posts, loading, searchParams]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, filterStatus]);

    // Filter posts
    const filteredPosts = posts.filter((post) => {
        const platformMatch = activeTab === 'all' || post.type === activeTab;
        const statusMatch = filterStatus === 'all' ||
            (filterStatus === 'sent' && post.isPostSent) ||
            (filterStatus === 'pending' && !post.isPostSent) ||
            (filterStatus === 'scheduled' && post.scheduledPostTime && !post.isPostSent);
        return platformMatch && statusMatch;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE);
    const paginatedPosts = filteredPosts.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Handle delete post
    const handleDeletePost = async (postId: number) => {
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/posts/${postId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete post');

            toast.success('Post deleted successfully');
            setPosts(posts.filter((p) => p.id !== postId));
            setShowDeleteDialog(false);
            setDeletePostId(null);
        } catch (error) {
            console.error('Error deleting post:', error);

            console.error('Error deleting post:', error);

            toast.error('Failed to delete post');
        }
    };

    // Handle duplicate post
    const handleDuplicatePost = async (post: Post) => {
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: post.subject ? `${post.subject} (Copy)` : null,
                    message: post.message,
                    type: post.type,
                    senderEmail: null,
                    scheduledPostTime: null,
                }),
            });

            if (!response.ok) throw new Error('Failed to duplicate post');

            const data = await response.json();
            setPosts([...posts, data.post]);
            toast.success('Post duplicated successfully');
        } catch (error) {
            console.error('Error duplicating post:', error);

            console.error('Error duplicating post:', error);

            toast.error('Failed to duplicate post');
        }
    };

    // Handle Share/Send
    const handleSendShare = async () => {
        const isSocialPlatform = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].includes(sharePost?.type || '');

        if (!isSocialPlatform && selectedContacts.length === 0) {
            toast.error('Please select at least one contact');
            return;
        }

        if (!sharePost) return;
        if (sendingShare) return; // Prevent duplicate clicks

        try {
            setSendingShare(true);
            const toastId = `send-${sharePost.id}`;
            toast.loading(`Publishing ${sharePost.type.toLowerCase()} post...`, { id: toastId });

            const response = await fetch(`/api/campaigns/${campaignId}/posts/${sharePost.id}/send`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contactIds: selectedContacts })
                });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errMsg = errorData.error || 'Failed to send post';
                toast.error(errMsg, { id: toastId });
                throw new Error(errMsg);
            }

            const data = await response.json();

            if (data.queued) {
                toast.success('Post queued for publishing!', {
                    id: toastId,
                    description: 'We are processing it in the background. You will be notified of its status.',
                });
            } else if (isSocialPlatform) {
                toast.success('Post published successfully!', { id: toastId });
            } else {
                if (!data.success && data.sent === 0) {
                    const firstError = data.errors?.[0]?.split(': ')[1] || data.error || 'Failed to send post';
                    toast.error(`Failed: ${firstError}`, { id: toastId });
                } else if (data.failed > 0) {
                    toast.warning(`Sent: ${data.sent}, Failed: ${data.failed}`, { id: toastId });
                } else {
                    toast.success('Post shared successfully!', { id: toastId });
                }
            }
           
            setSharePost(null);
            setSelectedContacts([]);
            // Refresh posts to update status
            const postsResponse = await fetch(`/api/campaigns/${campaignId}/posts`);
            if (postsResponse.ok) {
                const postsData = await postsResponse.json();
                setPosts(postsData.posts);
            }


        } catch (error) {
            console.error('Error sharing post:', error);

            // Log error to database and notify admin
            try {
                await fetch('/api/log-error', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiName: `Client: Share Post - Campaign ${campaignId}`,
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                        context: {
                            campaignId,
                            postId: sharePost?.id,
                            postType: sharePost?.type,
                            selectedContactsCount: selectedContacts.length,
                            url: window.location.href,
                        }
                    })
                });
            } catch (logError) {
                console.error('Failed to log error:', logError);
            }

            const errorMessage = error instanceof Error ? error.message : 'Failed to share post';
            if (errorMessage.toLowerCase().includes('credit')) {
                toast.error(errorMessage, {
                    action: {
                        label: 'Add Credits',
                        onClick: () => router.push('/organisation/billing')
                    },
                });
            } else {
                toast.error(errorMessage);
            }
        } finally {
            setSendingShare(false);
        }
    };

    // Handle export posts
    const handleExport = () => {
        const platform = activeTab === 'all' ? 'all' : activeTab;
        window.open(`/api/campaigns/${campaignId}/posts/export?platform=${platform}`, '_blank');
    };

    // Toggle contact selection
    const toggleContact = (contactId: string) => {
        setSelectedContacts(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    // Filtered contacts for the share dialog
    const filteredShareContacts = campaign?.contacts?.filter((contact: any) => {
        const query = contactSearchQuery.toLowerCase();
        return (
            contact.contactName?.toLowerCase().includes(query) ||
            contact.contactEmail?.toLowerCase().includes(query) ||
            contact.contactMobile?.toLowerCase().includes(query)
        );
    }) || [];

    // Select all contacts (filtered)
    const toggleAllContacts = () => {
        if (!campaign?.contacts) return;

        const visibleIds = filteredShareContacts.map((c: any) => c.id);
        const allVisibleSelected = visibleIds.every(id => selectedContacts.includes(id));

        if (allVisibleSelected) {
            // Unselect visible
            setSelectedContacts(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            // Select all visible (preserving existing)
            setSelectedContacts(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Get platform icon for post items
    const getPlatformIcon = (type: string) => {
        switch (type.toUpperCase()) {
            case 'EMAIL':
                return <Mail className="size-4" />;
            case 'SMS':
                return <MessageSquare className="size-4" />;
            case 'WHATSAPP':
                return <Phone className="size-4" />;
            case 'FACEBOOK':
                return <Facebook className="size-4" />;
            case 'INSTAGRAM':
                return <Instagram className="size-4" />;
            case 'LINKEDIN':
                return <Linkedin className="size-4" />;
            case 'YOUTUBE':
                return <Youtube className="size-4" />;
            case 'PINTEREST':
                return (
                    <div className="p-0.5 bg-red-600 rounded-full size-4 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">P</span>
                    </div>
                );
            default:
                return <Send className="size-4" />;
        }
    };

    // Get status badge
    const getStatusBadge = (post: Post) => {
        if (post.isPostSent) {
            return <Badge variant="default">Sent</Badge>;
        }
        if (post.scheduledPostTime && new Date(post.scheduledPostTime) > new Date()) {
            return <Badge variant="secondary">Scheduled</Badge>;
        }
        return <Badge variant="outline">Pending</Badge>;
    };

    // Get preview content with variables replaced
    const getPreviewContent = (content: string | null) => {
        if (!content) return '';

        // Use first contact from campaign for preview, or fallback to placeholder
        const sampleContact = campaign?.contacts && campaign.contacts.length > 0 ? campaign.contacts[0] : null;

        return content
            .replace(/{{name}}/g, sampleContact?.contactName || 'John Doe')
            .replace(/{{email}}/g, sampleContact?.contactEmail || 'john@example.com')
            .replace(/{{phone}}/g, sampleContact?.contactMobile || '+1234567890')
            .replace(/{{company}}/g, 'Acme Corp');
    };

    // Get share preview content
    const getSharePreviewContent = (content: string | null) => {
        if (!content) return '';

        // If exactly one contact is selected, use their data
        if (selectedContacts.length === 1) {
            const contactId = selectedContacts[0];
            const contact = campaign?.contacts?.find((c: any) => c.id === contactId);

            if (contact) {
                return content
                    .replace(/{{name}}/g, contact.contactName || '{{name}}')
                    .replace(/{{email}}/g, contact.contactEmail || '{{email}}')
                    .replace(/{{phone}}/g, contact.contactMobile || '{{phone}}')
                    .replace(/{{company}}/g, 'Acme Corp');
            }
        }

        // Otherwise return raw content or generic preview
        return content;
    };

    // Get campaign status
    const getCampaignStatus = (campaign: Campaign | null) => {
        if (!campaign) return null;
        const now = new Date();
        const start = new Date(campaign.startDate);
        const end = new Date(campaign.endDate);

        if (now < start) return { label: 'Scheduled', variant: 'secondary' as const };
        if (now > end) return { label: 'Completed', variant: 'outline' as const };
        return { label: 'Active', variant: 'default' as const };
    };

    const campaignStatus = getCampaignStatus(campaign);

    if (loading) {
        return (
            <div className="min-h-screen bg-background">

                <div className="flex">

                    <main className="flex-1 p-6">
                        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                            <Loader2 className="size-8 animate-spin text-muted-foreground" />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    const isSocialPlatform = sharePost ? ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].includes(sharePost.type) : false;

    return (
        <div className=" bg-background">

            <div className="flex">

                <main className="flex-1 p-6">
                    <div className=" mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <Button
                                className='cursor-pointer'
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/organisation/campaigns')}
                            >
                                <ArrowLeft className="size-4 mr-2" />
                                Back to Campaigns
                            </Button>
                        </div>

                        <div className="flex items-center justify-between gap-8 w-full overflow-hidden">
                            <div className="flex-1 ">
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate w-3xl" title={campaign?.name || ''}>
                                    {campaign?.name}
                                </h1>
                                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm w-[50%]  md:text-base" title={campaign?.description || ''}>
                                    {campaign?.description || 'Manage posts for this campaign'}
                                </p>
                            </div>
                            <Button
                                className='cursor-pointer shrink-0'
                                onClick={() => router.push(`/organisation/campaigns/${campaignId}/posts/new`)}
                                disabled={campaignStatus?.label === 'Completed'}
                            >
                                <Plus className="size-4 mr-2" />
                                <span className="hidden sm:inline">Add Post</span>
                                <span className="sm:hidden">Add</span>
                            </Button>
                        </div>

                        {/* Platform Selection */}
                        <div className="space-y-4">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-2 rounded-lg border">
                                    <TabsList className="bg-transparent h-auto flex flex-wrap gap-1 p-0">
                                        <TabsTrigger
                                            value="all"
                                            className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm capitalize"
                                        >
                                            All
                                        </TabsTrigger>
                                        {(() => {
                                            const PLATFORM_ORDER = ['EMAIL', 'SMS', 'WHATSAPP', 'PINTEREST', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'FACEBOOK'];
                                            return [...organisationPlatforms]
                                                .sort((a, b) => {
                                                    const idxA = PLATFORM_ORDER.indexOf(a.toUpperCase());
                                                    const idxB = PLATFORM_ORDER.indexOf(b.toUpperCase());
                                                    if (idxA === -1) return 1;
                                                    if (idxB === -1) return -1;
                                                    return idxA - idxB;
                                                })
                                                .map((platform) => (
                                                    <TabsTrigger
                                                        key={platform}
                                                        value={platform}
                                                        className="px-4 py-2 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-sm capitalize"
                                                    >
                                                        {platform.toLowerCase()}
                                                    </TabsTrigger>
                                                ));
                                        })()}
                                    </TabsList>

                                    <div className="flex items-center gap-4 shrink-0 w-full md:w-auto">
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger className="w-full md:w-[180px] bg-background">
                                                <SelectValue placeholder="All Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                                <SelectItem value="sent">Sent</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="outline"
                                            className="cursor-pointer"
                                            onClick={handleExport}
                                        >
                                            <Download className="size-4 mr-2" />
                                            Export All
                                        </Button>
                                    </div>
                                </div>
                            </Tabs>
                        </div>


                        {/* Posts List */}
                        <Card>
                            <CardContent className="pt-6">
                                {filteredPosts.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Send className="size-12 mx-auto text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground mb-4">
                                            No posts found.
                                        </p>
                                        <Button className='cursor-pointer' onClick={() => router.push(`/organisation/campaigns/${campaignId}/posts/new`)}>
                                            <Plus className="size-4 mr-2" />
                                            Create Post
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {paginatedPosts.map((post) => (
                                            <div
                                                key={post.id}
                                                className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {getPlatformIcon(post.type)}
                                                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                                                            {post.type}
                                                        </span>
                                                    </div>
                                                    {post.subject && (
                                                        <h4 className="font-medium truncate" title={post.subject}>{post.subject}</h4>
                                                    )}
                                                    {post.message && (
                                                        <p className="text-sm text-muted-foreground line-clamp-2" title={post.message}>
                                                            {post.message}
                                                        </p>
                                                    )}
                                                    {post.type === 'EMAIL' && post.senderEmail && (
                                                        <p className="text-xs text-muted-foreground">
                                                            From: {post.senderEmail}
                                                        </p>
                                                    )}
                                                    {post.videoUrl || (post.mediaUrls && post.mediaUrls.length > 0) ? (
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Paperclip className="size-3" />
                                                            <span>Media attached</span>
                                                        </div>
                                                    ) : null}
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        {post.scheduledPostTime && (
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="size-3" />
                                                                <span>{formatDate(post.scheduledPostTime)}</span>
                                                            </div>
                                                        )}
                                                        <div>{getStatusBadge(post)}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <Button
                                                        className='cursor-pointer'
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setPreviewPost(post)}
                                                        title="Preview"
                                                    >
                                                        <Eye className="size-4" />
                                                    </Button>
                                                    <Button
                                                        className='cursor-pointer'
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            const isLocked = !hasPaidPlan && (post.type === 'SMS' || post.type === 'WHATSAPP');
                                                            if (isLocked) {
                                                                toast('Paid plan required', {
                                                                    description: 'SMS and WhatsApp are only available on paid plans.',
                                                                    action: {
                                                                        label: 'Upgrade',
                                                                        onClick: () => router.push('/organisation/billing')
                                                                    }
                                                                });
                                                                return;
                                                            }
                                                            setSharePost(post);
                                                            setSelectedContacts([]);
                                                        }}
                                                        title={isSocialPlatform ? "Publish Now" : "Share to Contacts"}
                                                        disabled={post.isPostSent || campaignStatus?.label === 'Completed'}
                                                    >
                                                        {isSocialPlatform ? <Send className="size-4" /> : <Share2 className="size-4" />}
                                                    </Button>
                                                    {/* Duplicate button removed as per request */}
                                                    <Button
                                                        className='cursor-pointer'
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => router.push(`/organisation/campaigns/${campaignId}/posts/${post.id}/edit`)}
                                                        disabled={post.isPostSent}
                                                        title="Edit"
                                                    >
                                                        <Edit className="size-4" />
                                                    </Button>
                                                    {(post.type === 'FACEBOOK' || post.type === 'INSTAGRAM') && (
                                                        <Button
                                                            className={`cursor-pointer ${post.isPostSent ? 'text-blue-600 border-blue-600 hover:bg-blue-50' : 'text-primary border-primary hover:bg-primary/5'}`}
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDirectBoost(post)}
                                                            title="Boost Post"
                                                        >
                                                            <Rocket className="size-4 mr-1" />
                                                            <span className="hidden lg:inline">{post.isPostSent ? 'Boost' : 'Set Boost'}</span>
                                                        </Button>
                                                    )}
                                                    <Button
                                                        className='cursor-pointer'
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setDeletePostId(post.id);
                                                            setShowDeleteDialog(true);
                                                        }}
                                                        disabled={post.isPostSent}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="size-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Pagination */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between pt-4 border-t">
                                                <p className="text-sm text-muted-foreground">
                                                    Page {currentPage} of {totalPages}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                    >
                                                        Previous
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={currentPage === totalPages}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>

            {/* Preview Dialog */}
            <Dialog open={!!previewPost} onOpenChange={(open) => !open && setPreviewPost(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {previewPost && getPlatformIcon(previewPost.type)}
                            Post Preview - {previewPost?.type}
                        </DialogTitle>
                        <DialogDescription>
                            Preview how your post will look
                        </DialogDescription>
                    </DialogHeader>
                    {previewPost && (
                        <div className="space-y-4">
                            {(previewPost.type === 'FACEBOOK' || previewPost.type === 'INSTAGRAM') && ((previewPost.metadata as any)?.facebookPageName || socialStatus?.facebook?.pageName) && (
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2">
                                    {previewPost.type === 'FACEBOOK' ? (
                                        <Facebook className="size-4 text-blue-600" />
                                    ) : (
                                        <Instagram className="size-4 text-pink-600" />
                                    )}
                                    <span className="text-sm font-medium">
                                        {previewPost.isPostSent ? 'Posted to:' : 'Posting to:'} <span className="font-bold">{(previewPost.metadata as any)?.facebookPageName || socialStatus?.facebook?.pageName}</span>
                                    </span>
                                </div>
                            )}

                            {previewPost.subject && (
                                <div>
                                    <p className="text-sm font-medium mb-1">Subject/Title:</p>
                                    <p className="text-sm text-muted-foreground font-semibold">{previewPost.subject}</p>
                                </div>
                            )}

                            {/* Media Preview */}
                            {((previewPost.mediaUrls && previewPost.mediaUrls.length > 0) || previewPost.videoUrl) && (
                                <div>
                                    <p className="text-sm font-medium mb-2">Media:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(() => {
                                            const allMedia = Array.from(new Set([
                                                ...(previewPost.mediaUrls || []),
                                                previewPost.videoUrl
                                            ].filter(Boolean) as string[])).map(url => getMediaPreviewUrl(url));

                                            if (allMedia.length === 0) return null;

                                            return allMedia.map((url, index) => (
                                                <div key={index} className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                                                    {(() => {
                                                        const isYouTubeUrl = url?.includes('youtube.com') || url?.includes('youtu.be');
                                                        const isVideoFile = url?.match(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i);
                                                        const isVideo = isVideoFile || (previewPost.type === 'YOUTUBE' && isYouTubeUrl);

                                                        if (previewPost.type === 'YOUTUBE' && isYouTubeUrl) {
                                                            let videoId = '';
                                                            if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
                                                            else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
                                                            else if (url.includes('embed/')) videoId = url.split('embed/')[1].split('?')[0];

                                                            if (videoId) {
                                                                return (
                                                                    <iframe
                                                                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`}
                                                                        className="w-full h-full border-0"
                                                                        allow="autoplay; encrypted-media"
                                                                        allowFullScreen
                                                                    />
                                                                );
                                                            }
                                                        }

                                                        if (isVideo && !isYouTubeUrl) {
                                                            return (
                                                                <video
                                                                    src={url}
                                                                    className="w-full h-full object-cover"
                                                                    autoPlay
                                                                    muted
                                                                    loop
                                                                    playsInline
                                                                />
                                                            );
                                                        }

                                                        return url ? (
                                                            <img
                                                                src={url}
                                                                alt={`Media ${index + 1}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : null;
                                                    })()}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div>
                                <p className="text-sm font-medium mb-1">Message:</p>
                                <div className="p-4 border rounded-lg bg-muted/50 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                    {getPreviewContent(previewPost.message) || <span className="text-muted-foreground italic">No message</span>}
                                </div>
                            </div>

                            {/* Status Info */}
                            <div className="flex items-center justify-between text-sm pt-2 border-t">
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(previewPost)}
                                    {previewPost.scheduledPostTime && (
                                        <span className="text-muted-foreground text-xs">
                                            Scheduled: {formatDate(previewPost.scheduledPostTime)}
                                        </span>
                                    )}
                                </div>
                                <span className="text-muted-foreground text-xs">
                                    Created: {formatDate(previewPost.createdAt)}
                                </span>
                            </div>

                            {!['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].includes(previewPost.type) && (
                                <div className="text-xs text-muted-foreground italic">
                                    * Variables like {'{{name}}'} are replaced with actual contact data when sent.
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Meta Boost Dialog */}
            <Dialog
                open={!!boostPost}
                onOpenChange={(open) => {
                    if (!open) {
                        setBoostPost(null);
                        setBoostDialogOptions(null);
                    }
                }}
            >
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Rocket className="w-5 h-5 text-primary" />
                            Boost Existing Post
                        </DialogTitle>
                        <DialogDescription>
                            Configure budget and targeting to reach more people with this post.
                        </DialogDescription>
                    </DialogHeader>
                    {boostPost && (
                        <div className="space-y-4">
                            <MetaBoostSection
                                platform={boostPost.type}
                                facebookAppId={facebookAppId}
                                fbPostId={boostPost.metadata?.facebookPostId || boostPost.metadata?.platformPostId || boostPost.liveLink}
                                fbPageId={boostPost.metadata?.facebookPageId || campaign?.metadata?.facebookPageId}
                                options={
                                    boostDialogOptions || {
                                        enabled: true,
                                        adAccountId: boostPost.metadata?.metaBoost?.adAccountId || '',
                                        budget: boostPost.metadata?.metaBoost?.budget || 5,
                                        duration: boostPost.metadata?.metaBoost?.duration || 7,
                                        objective: boostPost.metadata?.metaBoost?.objective || 'OUTCOME_ENGAGEMENT',
                                        balance: boostPost.metadata?.metaBoost?.balance || '0'
                                    }
                                }
                                onChange={(newOptions) => {
                                    console.log("Boost Options Updated:", newOptions);
                                    setBoostDialogOptions(newOptions);
                                    if (newOptions.adAccountId) {
                                        setLastUsedAdAccountId(newOptions.adAccountId);
                                        localStorage.setItem('last_meta_ad_account_id', newOptions.adAccountId);
                                    }
                                }}
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setBoostPost(null);
                            setBoostDialogOptions(null);
                        }} disabled={savingBoost}>Cancel</Button>
                        <Button
                            className="bg-primary text-white"
                            onClick={handleSaveBoostSettings}
                            disabled={savingBoost || !boostDialogOptions?.adAccountId}
                        >
                            {savingBoost ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Boost Settings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Share/Send Dialog */}
            <Dialog open={!!sharePost} onOpenChange={(open) => {
                if (!open && !sendingShare) {
                    setSharePost(null);
                    setContactSearchQuery('');
                }
            }}>
                <DialogContent 
                    className="max-w-3xl"
                    onPointerDownOutside={(e) => {
                        if (sendingShare) e.preventDefault();
                    }}
                    onEscapeKeyDown={(e) => {
                        if (sendingShare) e.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{isSocialPlatform ? 'Publish Post' : 'Share Post'}</DialogTitle>
                        <DialogDescription>
                            {isSocialPlatform
                                ? `Publish this post to your ${sharePost?.type} page`
                                : 'Select contacts to share this post with'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {!isSocialPlatform && (
                            <>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search contacts..."
                                                value={contactSearchQuery}
                                                onChange={(e) => setContactSearchQuery(e.target.value)}
                                                className="pl-9 h-9"
                                            />
                                        </div>
                                        <Button
                                            className='cursor-pointer'
                                            variant="outline"
                                            size="sm"
                                            onClick={toggleAllContacts}
                                        >
                                            {filteredShareContacts.length > 0 && filteredShareContacts.every((c: any) => selectedContacts.includes(c.id))
                                                ? 'Deselect Visible'
                                                : 'Select Visible'}
                                        </Button>
                                    </div>

                                    <div className="border rounded-lg max-h-[200px] overflow-y-auto p-2 space-y-1">
                                        {filteredShareContacts.length > 0 ? (
                                            filteredShareContacts.map((contact: any) => (
                                                <div
                                                    key={contact.id}
                                                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer"
                                                    onClick={() => toggleContact(contact.id)}
                                                >
                                                    <div className={`size-4 rounded border flex items-center justify-center ${selectedContacts.includes(contact.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                                                        {selectedContacts.includes(contact.id) && <Check className="size-3" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{contact.contactName}</p>
                                                        <p className="text-xs text-muted-foreground">{contact.contactEmail || contact.contactMobile}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center space-y-4">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="size-8 text-muted-foreground/50" />
                                                    <p className="text-muted-foreground text-sm">
                                                        {contactSearchQuery ? 'No contacts found matching your search' : 'No contacts found in this campaign'}
                                                    </p>
                                                </div>
                                                {!contactSearchQuery && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="cursor-pointer"
                                                        onClick={() => {
                                                            setSharePost(null);
                                                            router.push(`/organisation/campaigns/${campaignId}/edit?returnTo=share&postId=${sharePost?.id}`);
                                                        }}
                                                    >
                                                        <Plus className="size-4 mr-2" />
                                                        Add Contacts to Campaign
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Selected: {selectedContacts.length} contacts</span>
                                        {contactSearchQuery && (
                                            <span>Matches: {filteredShareContacts.length} contacts</span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Dynamic Message Preview */}
                        {sharePost && (
                            <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                                <h5 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">
                                    {isSocialPlatform ? 'Content Preview' : `Message Preview ${selectedContacts.length === 1 ? '(Personalized)' : ''}`}
                                </h5>
                                {sharePost.subject && (
                                    <p className="font-medium mb-1">{sharePost.subject}</p>
                                )}
                                <p className="text-sm whitespace-pre-wrap">
                                    {isSocialPlatform ? sharePost.message : getSharePreviewContent(sharePost.message)}
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button className='cursor-pointer' variant="outline" onClick={() => setSharePost(null)} disabled={sendingShare}>Cancel</Button>
                        <Button className='cursor-pointer' onClick={handleSendShare} disabled={sendingShare || (!isSocialPlatform && selectedContacts.length === 0)}>
                            {sendingShare ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    {isSocialPlatform ? 'Publishing...' : 'Sending...'}
                                </>
                            ) : (
                                <>
                                    <Send className="size-4 mr-2" />
                                    {isSocialPlatform ? 'Publish Now' : 'Send Now'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this post. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletePostId(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deletePostId) {
                                    handleDeletePost(deletePostId);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
