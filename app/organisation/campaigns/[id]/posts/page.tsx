'use client';

import { useState, useEffect } from 'react';
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
import {
    ArrowLeft,
    Loader2,
    Plus,
    Trash2,
    Edit,
    Calendar,
    Send,
    Mail,
    MessageSquare,
    Phone,
    Copy,
    Filter,
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    Eye,
    Share2,
    Check,
    Paperclip,
    Globe
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
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
}

interface Campaign {
    id: number;
    name: string;
    description: string | null;
    contacts?: any[];
}

export default function CampaignPostsPage() {
    const router = useRouter();
    const params = useParams();
    const campaignId = params.id as string;

    // State
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deletePostId, setDeletePostId] = useState<number | null>(null);

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

        fetchOrgPlatforms();
    }, []);

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

            const response = await fetch(`/api/campaigns/${campaignId}/posts/${sharePost.id}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactIds: selectedContacts })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to send post');
            }

            const data = await response.json();

            toast.success(isSocialPlatform ? 'Post published successfully!' : `Post shared successfully! Sent: ${data.sent}, Failed: ${data.failed}`);
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
            toast.error(error instanceof Error ? error.message : 'Failed to share post');
        } finally {
            setSendingShare(false);
        }
    };

    // Toggle contact selection
    const toggleContact = (contactId: string) => {
        setSelectedContacts(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    // Select all contacts
    const toggleAllContacts = () => {
        if (!campaign?.contacts) return;

        if (selectedContacts.length === campaign.contacts.length) {
            setSelectedContacts([]);
        } else {
            setSelectedContacts(campaign.contacts.map((c: any) => c.id));
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

                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{campaign?.name}</h1>
                                <p className="text-muted-foreground mt-1">
                                    {campaign?.description || 'Manage posts for this campaign'}
                                </p>
                            </div>
                            <Button className='cursor-pointer' onClick={() => router.push(`/organisation/campaigns/${campaignId}/posts/new`)}>
                                <Plus className="size-4 mr-2" />
                                Add Post
                            </Button>
                        </div>

                        {/* Platform Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold flex items-center gap-1">
                                Select Platform <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 gap-4 ">

                                <div className="flex justify-center md:justify-start flex-wrap gap-4">
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[100px] cursor-pointer ${activeTab === 'all'
                                            ? 'border-primary bg-primary/10 shadow-sm'
                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                            }`}
                                    >
                                        <Globe className={`size-6 ${activeTab === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span className={`text-xs font-medium ${activeTab === 'all' ? 'text-primary' : 'text-muted-foreground'}`}>
                                            ALL
                                        </span>
                                    </button>
                                    {(() => {
                                        const PLATFORM_ORDER = ['EMAIL', 'SMS', 'WHATSAPP', 'PINTEREST', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'FACEBOOK'];
                                        const sortedPlatforms = [...organisationPlatforms].sort((a, b) => {
                                            const idxA = PLATFORM_ORDER.indexOf(a.toUpperCase());
                                            const idxB = PLATFORM_ORDER.indexOf(b.toUpperCase());
                                            if (idxA === -1) return 1;
                                            if (idxB === -1) return -1;
                                            return idxA - idxB;
                                        });

                                        return sortedPlatforms.map((platform) => {
                                            const isSelected = activeTab === platform;
                                            const displayPlatform = platform.toUpperCase();

                                            // Dynamic Icon Selection to match design
                                            const getDesignIcon = (p: string) => {
                                                switch (p) {
                                                    case 'EMAIL': return Mail;
                                                    case 'SMS': return MessageSquare;
                                                    case 'WHATSAPP': return Phone;
                                                    case 'PINTEREST': return Send;
                                                    case 'INSTAGRAM': return Instagram;
                                                    case 'LINKEDIN': return Linkedin;
                                                    case 'YOUTUBE': return Youtube;
                                                    case 'FACEBOOK': return Facebook;
                                                    default: return Globe;
                                                }
                                            };
                                            const Icon = getDesignIcon(displayPlatform);

                                            return (
                                                <button
                                                    key={platform}
                                                    onClick={() => setActiveTab(platform)}
                                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[100px] cursor-pointer ${isSelected
                                                        ? 'border-primary bg-primary/10 shadow-sm'
                                                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                        }`}
                                                >
                                                    <Icon className={`size-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                                    <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                                        {displayPlatform}
                                                    </span>
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                                <div className="flex items-center justify-end ">
                                    <div className="flex items-center gap-4 border  rounded-md">
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="All Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                                <SelectItem value="sent">Sent</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
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
                                                        <h4 className="font-medium">{post.subject}</h4>
                                                    )}
                                                    {post.message && (
                                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                                            {post.message}
                                                        </p>
                                                    )}
                                                    {post.type === 'EMAIL' && post.senderEmail && (
                                                        <p className="text-xs text-muted-foreground">
                                                            From: {post.senderEmail}
                                                        </p>
                                                    )}
                                                    {post.videoUrl && (
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Paperclip className="size-3" />
                                                            <span>Media attached</span>
                                                        </div>
                                                    )}
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
                                                            setSharePost(post);
                                                            setSelectedContacts([]);
                                                        }}
                                                        title={isSocialPlatform ? "Publish Now" : "Share to Contacts"}
                                                        disabled={post.isPostSent}
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
                                        {(previewPost.mediaUrls || [previewPost.videoUrl].filter(Boolean)).map((url, index) => (
                                            <div key={index} className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                                                {url && url.match(/\.(mp4|mov|webm)$/i) ? (
                                                    <div className="flex items-center justify-center h-full bg-black/10">
                                                        <div className="size-12 rounded-full bg-white/80 flex items-center justify-center shadow">
                                                            <div className="ml-1 size-0 border-y-[8px] border-y-transparent border-l-[14px] border-l-primary" />
                                                        </div>
                                                        <p className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Video</p>
                                                    </div>
                                                ) : url ? (
                                                    <img
                                                        src={url}
                                                        alt={`Media ${index + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : null}
                                            </div>
                                        ))}
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

            {/* Share/Send Dialog */}
            <Dialog open={!!sharePost} onOpenChange={(open) => !open && setSharePost(null)}>
                <DialogContent className="max-w-3xl">
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
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium">Select Contacts</h4>
                                    <Button className='cursor-pointer' variant="outline" size="sm" onClick={toggleAllContacts}>
                                        {selectedContacts.length === (campaign?.contacts?.length || 0) ? 'Deselect All' : 'Select All'}
                                    </Button>
                                </div>
                                <div className="border rounded-lg max-h-[200px] overflow-y-auto p-2 space-y-1">
                                    {campaign?.contacts && campaign.contacts.length > 0 ? (
                                        campaign.contacts.map((contact: any) => (
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
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                            No contacts found in this campaign.
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Selected: {selectedContacts.length} contacts
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
                        <Button className='cursor-pointer' variant="outline" onClick={() => setSharePost(null)}>Cancel</Button>
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
