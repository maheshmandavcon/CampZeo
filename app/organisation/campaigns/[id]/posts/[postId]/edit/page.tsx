'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { ArrowLeft, Loader2, Save, Upload, X, Youtube, Eye, Video, Trash2, FileText, Sparkles, Mail, MessageSquare, Phone, Facebook, Instagram, Linkedin, Send, Plus, Wand2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { AIContentAssistant } from '@/components/ai-content-assistant';
import { WYSIWYGPreview } from '../../_components/WYSIWYGPreview';
import { useUser } from '@clerk/nextjs';
import { upload } from '@vercel/blob/client';



interface Post {
    id: number;
    subject: string | null;
    message: string | null;
    type: string;
    senderEmail: string | null;
    scheduledPostTime: string | null;
    isPostSent: boolean;
    videoUrl: string | null;
    mediaUrls: string[];
    metadata: any;
}

export default function EditPostPage() {
    const { user } = useUser();
    const router = useRouter();
    const params = useParams();
    const campaignId = params.id as string;
    const postId = params.postId as string;

    // Form state
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('');
    const [senderEmail, setSenderEmail] = useState('');
    const [scheduledPostTime, setScheduledPostTime] = useState('');
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [pinterestBoardId, setPinterestBoardId] = useState('');
    const [pinterestLink, setPinterestLink] = useState('');
    const [youtubeTags, setYoutubeTags] = useState('');
    const [youtubePrivacy, setYoutubePrivacy] = useState('public');
    const [youtubeContentType, setYoutubeContentType] = useState('VIDEO'); // VIDEO, SHORT, PLAYLIST
    const [youtubePlaylistTitle, setYoutubePlaylistTitle] = useState('');
    const [isReel, setIsReel] = useState(false);
    const [contentType, setContentType] = useState('POST'); // For Facebook/Instagram: POST or REEL
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Pinterest Boards
    const [pinterestBoards, setPinterestBoards] = useState<any[]>([]);
    const [loadingPinterestBoards, setLoadingPinterestBoards] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Preview state
    const [showPreview, setShowPreview] = useState(false);

    // Template state
    const [templates, setTemplates] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    // AI Assistant state
    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [aiAssistantTab, setAiAssistantTab] = useState<'text' | 'image'>('text');

    // Pinterest Board Creation state
    const [isCreatingBoard, setIsCreatingBoard] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [newBoardDescription, setNewBoardDescription] = useState('');
    const [creatingBoard, setCreatingBoard] = useState(false);

    const [organisationPlatforms, setOrganisationPlatforms] = useState<string[]>([]);
    const [loadingPlatforms, setLoadingPlatforms] = useState(true);

    // Fetch organisation platforms
    useEffect(() => {
        const fetchOrgPlatforms = async () => {
            try {
                setLoadingPlatforms(true);
                const response = await fetch('/api/Organisation/GetPlatforms');
                if (!response.ok) {
                    setOrganisationPlatforms(['EMAIL', 'SMS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST']);
                    return;
                }
                const data = await response.json();
                const platforms = data.platforms || [];
                const availablePlatforms = platforms.filter((p: string) =>
                    !['EMAIL', 'SMS', 'WHATSAPP'].includes(p.toUpperCase())
                );
                setOrganisationPlatforms(['EMAIL', 'SMS', 'WHATSAPP', ...availablePlatforms]);
            } catch (error) {
                console.error('Error fetching organisation platforms:', error);
                setOrganisationPlatforms(['EMAIL', 'SMS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST']);
            } finally {
                setLoadingPlatforms(false);
            }
        };

        fetchOrgPlatforms();
    }, []);

    // Get platform icon
    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'EMAIL': return Mail;
            case 'SMS': return MessageSquare;
            case 'WHATSAPP': return Phone;
            case 'FACEBOOK': return Facebook;
            case 'INSTAGRAM': return Instagram;
            case 'LINKEDIN': return Linkedin;
            case 'YOUTUBE': return Youtube;
            default: return Send;
        }
    };

    // Fetch post data
    useEffect(() => {
        const fetchPost = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/campaigns/${campaignId}/posts/${postId}`);
                if (!response.ok) throw new Error('Failed to fetch post');

                const data = await response.json();
                const post: Post = data.post;

                if (post.isPostSent) {
                    toast.error('Cannot edit a sent post');
                    router.push(`/organisation/campaigns/${campaignId}/posts`);
                    return;
                }

                setSubject(post.subject || '');
                setMessage(post.message || '');
                setType(post.type);
                setSenderEmail(post.senderEmail || '');

                // Load media URLs
                if (post.mediaUrls && post.mediaUrls.length > 0) {
                    setMediaUrls(post.mediaUrls);
                } else if (post.videoUrl) {
                    setMediaUrls([post.videoUrl]);
                }

                // Load metadata
                const metadata = post.metadata || {};
                setPinterestBoardId(metadata.boardId || '');
                setPinterestLink(metadata.link || '');
                setYoutubeTags(metadata.tags ? (Array.isArray(metadata.tags) ? metadata.tags.join(', ') : metadata.tags) : '');
                setYoutubePrivacy(metadata.privacy || 'public');
                setIsReel(metadata.isReel || metadata.postType === 'REEL' || false);

                // Load YouTube content type
                if (metadata.postType && type === 'YOUTUBE') {
                    setYoutubeContentType(metadata.postType);
                }
                if (metadata.playlistTitle) {
                    setYoutubePlaylistTitle(metadata.playlistTitle);
                }

                // Load Facebook/Instagram content type
                if (metadata.postType && (type === 'FACEBOOK' || type === 'INSTAGRAM')) {
                    setContentType(metadata.postType);
                }

                if (post.scheduledPostTime) {
                    const date = new Date(post.scheduledPostTime);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    setScheduledPostTime(`${year}-${month}-${day}T${hours}:${minutes}`);
                }
            } catch (error) {
                console.error('Error fetching post:', error);
                toast.error('Failed to load post');
                router.push(`/organisation/campaigns/${campaignId}/posts`);
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [campaignId, postId, router]);

    // Fetch Pinterest boards
    useEffect(() => {
        if (type === 'PINTEREST') {
            const fetchBoards = async () => {
                try {
                    setLoadingPinterestBoards(true);
                    const response = await fetch('/api/socialmedia/pinterest/boards');
                    if (response.ok) {
                        const data = await response.json();
                        setPinterestBoards(data.boards || []);
                    }
                } catch (error) {
                    console.error('Error fetching Pinterest boards:', error);
                    toast.error('Failed to fetch Pinterest boards');
                } finally {
                    setLoadingPinterestBoards(false);
                }
            };
            fetchBoards();
        }
    }, [type]);

    // Create new Pinterest board
    const handleCreateBoard = async () => {
        if (!newBoardName.trim()) {
            toast.error('Board name is required');
            return;
        }

        try {
            setCreatingBoard(true);
            const response = await fetch('/api/socialmedia/pinterest/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newBoardName,
                    description: newBoardDescription,
                    privacy: 'PUBLIC' // Default to public
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create board');
            }

            const data = await response.json();
            const newBoard = data.board;

            // Add new board to list and select it
            setPinterestBoards(prev => [...prev, newBoard]);
            setPinterestBoardId(newBoard.id);

            // Reset and close modal
            setNewBoardName('');
            setNewBoardDescription('');
            setIsCreatingBoard(false);

            toast.success('Board created successfully');
        } catch (error) {
            console.error('Error creating board:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create board');
        } finally {
            setCreatingBoard(false);
        }
    };

    // Fetch templates when platform changes
    useEffect(() => {
        if (type) {
            fetchTemplates(type);
        } else {
            setTemplates([]);
            setSelectedTemplateId('none');
        }
    }, [type]);

    // Fetch templates for selected platform
    const fetchTemplates = async (platform: string) => {
        try {
            setLoadingTemplates(true);
            const response = await fetch(`/api/templates?platform=${platform}&isActive=true`);
            if (!response.ok) {
                setTemplates([]);
                return;
            }
            const data = await response.json();
            setTemplates(data.success ? data.data : []);
        } catch (error) {
            console.error('Error fetching templates:', error);
            setTemplates([]);
        } finally {
            setLoadingTemplates(false);
        }
    };

    // Handle template selection
    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId);

        if (!templateId || templateId === 'none') {
            return;
        }

        const template = templates.find(t => t.id.toString() === templateId);
        if (!template) return;

        // Fill form with template data
        setSubject(template.subject || '');
        setMessage(template.content || '');

        // Prefill media
        if (template.mediaUrls && Array.isArray(template.mediaUrls)) {
            setMediaUrls(template.mediaUrls);
        }

        // Handle metadata settings
        if (template.metadata && typeof template.metadata === 'object') {
            const meta = template.metadata as any;

            // Map YouTube Content Type (VIDEO, SHORT, PLAYLIST)
            if (meta.postType && type === 'YOUTUBE') {
                setYoutubeContentType(meta.postType);
                if (meta.postType === 'SHORT') {
                    setIsReel(true); // Shorts are similar to reels
                }
            }

            // Map YouTube Playlist Title
            if (meta.playlistTitle) {
                setYoutubePlaylistTitle(meta.playlistTitle);
            }

            // Map Facebook/Instagram Content Type
            if (meta.postType && (type === 'FACEBOOK' || type === 'INSTAGRAM')) {
                setContentType(meta.postType); // POST or REEL
                setIsReel(meta.postType === 'REEL');
            }

            // Map YouTube Privacy
            if (meta.youtubePrivacy) {
                setYoutubePrivacy(meta.youtubePrivacy);
            }

            // Map YouTube Tags
            if (meta.youtubeTags) {
                setYoutubeTags(meta.youtubeTags);
            }

            // Map Thumbnail
            if (meta.thumbnailUrl) {
                setThumbnailUrl(meta.thumbnailUrl);
            }
        }

        toast.success('Template loaded! You can now edit the content.');
    };

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileInput = e.target;
        const files = Array.from(fileInput.files || []);
        if (files.length === 0) return;

        // Limit to 10 images
        if (mediaUrls.length + files.length > 10) {
            toast.error('You can upload a maximum of 10 media files');
            return;
        }

        try {
            setUploadingMedia(true);
            setUploadProgress(0); // Reset progress

            const newUrls: string[] = [];
            let hasVideo = false;

            for (const file of files) {

                // Check if video
                if (file.type.startsWith('video/')) {
                    hasVideo = true;
                }

                // Use client-side upload to avoid Vercel 4.5MB serverless limit
                const newBlob = await upload(file.name, file, {
                    access: 'public',
                    handleUploadUrl: '/api/upload',
                    onUploadProgress: (progress) => {
                        setUploadProgress(progress.percentage);
                    }
                });

                newUrls.push(newBlob.url);
            }

            setMediaUrls(prev => [...prev, ...newUrls]);

            // Auto-detect Content Type for Instagram/Facebook
            if (type === 'INSTAGRAM' || type === 'FACEBOOK') {
                if (hasVideo) {
                    setContentType('REEL');
                    setIsReel(true);
                    toast.success('Video detected: Switched to Reel/Video mode');
                } else if (mediaUrls.length === 0 && !hasVideo) {
                    // Only switch to POST if it's the first upload and it's an image
                    setContentType('POST');
                    setIsReel(false);
                }
            }

            toast.success('Files uploaded successfully');
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploadingMedia(false);
            setUploadProgress(0);
            if (fileInput) fileInput.value = '';
        }
    };

    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileInput = e.target;
        const files = Array.from(fileInput.files || []);
        if (files.length === 0) return;

        try {
            setUploadingMedia(true);
            setUploadProgress(0);

            const file = files[0];

            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/upload',
                onUploadProgress: (progress) => {
                    setUploadProgress(progress.percentage);
                }
            });

            setThumbnailUrl(newBlob.url);
            toast.success('Thumbnail uploaded successfully');
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            toast.error(`Failed to upload thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploadingMedia(false);
            setUploadProgress(0);
            if (fileInput) fileInput.value = '';
        }
    };

    const removeMedia = (index: number) => {
        setMediaUrls(prev => prev.filter((_, i) => i !== index));
    };

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!type) {
            toast.error('Please select a platform');
            return;
        }

        if (!message && !subject) {
            toast.error('Please enter a message or subject');
            return;
        }

        if (type === 'EMAIL' && !senderEmail) {
            toast.error('Please enter sender email for email posts');
            return;
        }

        if (['INSTAGRAM', 'YOUTUBE', 'PINTEREST'].includes(type) && mediaUrls.length === 0) {
            toast.error(`${type} posts require media (image/video)`);
            return;
        }

        // Prepare metadata
        let metadata: any = {};
        if (type === 'YOUTUBE') {
            metadata = {
                tags: youtubeTags ? youtubeTags.split(',').map(t => t.trim()) : [],
                privacy: youtubePrivacy,
                postType: youtubeContentType,
                playlistTitle: youtubeContentType === 'PLAYLIST' ? youtubePlaylistTitle : undefined
            };
        } else if (type === 'PINTEREST') {
            metadata = { boardId: pinterestBoardId, link: pinterestLink };
        } else if (type === 'FACEBOOK' || type === 'INSTAGRAM') {
            metadata = { isReel: !!isReel, postType: contentType };
        }

        try {
            setSaving(true);

            const response = await fetch(`/api/campaigns/${campaignId}/posts/${postId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject || null,
                    message: message || null,
                    type,
                    senderEmail: type === 'EMAIL' ? senderEmail : null,
                    scheduledPostTime: scheduledPostTime ? new Date(scheduledPostTime).toISOString() : null,
                    mediaUrls: mediaUrls,
                    videoUrl: mediaUrls.length > 0 ? mediaUrls[0] : null,
                    metadata
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update post');
            }

            toast.success('Post updated successfully');
            router.push(`/organisation/campaigns/${campaignId}/posts`);
        } catch (error) {
            console.error('Error updating post:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update post');
            setSaving(false); // Only reset on error
        }
    };

    // Check if a URL is a video
    const isVideoUrl = (url: string) => url.match(/\.(mp4|mov|webm)$/i);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="p-6  mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            className='cursor-pointer'
                            variant="ghost"
                            size="sm"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="size-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Edit Post</h1>
                            <p className="text-muted-foreground mt-1">
                                Update post details
                            </p>
                        </div>
                    </div>
                    <Button className='cursor-pointer' variant="outline" onClick={() => setShowPreview(true)}>
                        <Eye className="size-4 mr-2" />
                        Preview
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Post Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Post Details</CardTitle>
                            <CardDescription>
                                Configure your campaign post
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Platform Selection */}
                            <div className="space-y-3">
                                <Label>Select Platform *</Label>
                                {loadingPlatforms ? (
                                    <div className="flex items-center gap-2 p-4">
                                        <Loader2 className="size-4 animate-spin" />
                                        <span className="text-sm text-muted-foreground">Loading platforms...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap gap-3">
                                            {organisationPlatforms.map((platform) => {
                                                const isSelected = type === platform;
                                                const Icon = getPlatformIcon(platform);

                                                return (
                                                    <button
                                                        key={platform}
                                                        type="button"
                                                        onClick={() => setType(platform)}
                                                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[100px] ${isSelected
                                                            ? 'border-primary bg-primary/10 shadow-sm'
                                                            : 'border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer'
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
                                    </>
                                )}
                            </div>

                            {/* Template Selection */}
                            {type && !loadingTemplates && templates.length > 0 && (
                                <div className="space-y-2 p-4 bg-muted/20 rounded-lg border border-dashed">
                                    <Label htmlFor="template" className="text-xs font-semibold uppercase text-muted-foreground">Quick Start with Template</Label>
                                    <Select value={selectedTemplateId || "none"} onValueChange={handleTemplateSelect}>
                                        <SelectTrigger id="template" className="bg-background border border-2 border-gray-200">
                                            <SelectValue placeholder="Select a template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None - Keep current content</SelectItem>
                                            {templates.map((template) => (
                                                <SelectItem key={template.id} value={template.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="size-4 text-primary" />
                                                        <span>{template.name}</span>
                                                        {template.category && (
                                                            <span className="text-xs text-muted-foreground ml-2 px-1.5 py-0.5 rounded-full bg-muted">
                                                                {template.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
                                        Selecting a template will replace the current content.
                                    </p>
                                </div>
                            )}

                            {type === 'EMAIL' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="senderEmail">Sender Email *</Label>
                                        <Input
                                            id="senderEmail"
                                            type="email"
                                            placeholder="sender@example.com"
                                            value={senderEmail}
                                            onChange={(e) => setSenderEmail(e.target.value)}
                                            required={type === 'EMAIL'}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject *</Label>
                                        <Input
                                            id="subject"
                                            placeholder="Enter email subject"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            required={type === 'EMAIL'}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Title for social platforms */}
                            {type && type !== 'EMAIL' && type !== 'SMS' && (
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Title</Label>
                                    <Input
                                        id="subject"
                                        placeholder="Enter post title"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    />
                                </div>
                            )}

                            {type && (
                                <div className="space-y-2">
                                    <Label htmlFor="message">
                                        Message {type !== 'EMAIL' && '*'}
                                    </Label>
                                    <div className="relative">
                                        <Textarea

                                            id="message"
                                            placeholder="Enter your message"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            rows={6}
                                            required={type !== 'EMAIL'}
                                            className="pr-12 border rounded-md border-dark"
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="absolute cursor-pointer bottom-2 right-2 size-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                                            onClick={() => setShowAIAssistant(true)}
                                            title="Generate content with AI"
                                        >
                                            <Sparkles className="size-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {type === 'SMS' && 'SMS messages are limited to 160 characters'}
                                        {type === 'WHATSAPP' && 'WhatsApp messages support rich formatting'}
                                        {type === 'EMAIL' && 'You can use HTML formatting in email messages'}
                                    </p>
                                </div>
                            )}

                            {/* Media Upload */}
                            {['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].includes(type) && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <Label className="text-xs">
                                            {type === 'YOUTUBE' ? 'Video *' : 'Media (Photo/Video)'}
                                            {['INSTAGRAM', 'PINTEREST'].includes(type) && ' *'}
                                        </Label>
                                        <span className="text-[10px] text-muted-foreground">{mediaUrls.length}/10</span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {mediaUrls.map((url, index) => (
                                            <div key={index} className="relative rounded-md overflow-hidden border bg-muted/50 size-20 group">
                                                {isVideoUrl(url) ? (
                                                    <div className="flex items-center justify-center h-full bg-black/10">
                                                        <Video className="size-6 text-muted-foreground" />
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={url}
                                                        alt={`Media ${index + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeMedia(index)}
                                                    className="absolute cursor-pointer top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                    title="Remove media"
                                                >
                                                    <Trash2 className="size-3" />
                                                </button>
                                            </div>
                                        ))}

                                        {mediaUrls.length < 10 && (
                                            <div className="flex gap-2">
                                                <label htmlFor="media-upload" className="flex flex-col items-center justify-center size-20 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                                    {uploadingMedia ? (
                                                        <>
                                                            <Loader2 className="size-4 text-muted-foreground animate-spin mb-0.5" />
                                                            <span className="text-[10px] text-muted-foreground">{uploadProgress}%</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="size-4 text-muted-foreground mb-0.5" />
                                                            <span className="text-[10px] text-muted-foreground">Add</span>
                                                        </>
                                                    )}
                                                    <input
                                                        id="media-upload"
                                                        type="file"
                                                        className="hidden"
                                                        accept={type === 'YOUTUBE' ? 'video/*' : 'image/*,video/*'}
                                                        onChange={handleFileUpload}
                                                        disabled={uploadingMedia}
                                                        multiple
                                                    />
                                                </label>

                                                {/* AI Image Generation Shortcut */}
                                                {type !== 'SMS' && type !== 'EMAIL' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAiAssistantTab('image');
                                                            setShowAIAssistant(true);
                                                        }}
                                                        className="flex flex-col items-center justify-center size-20 border-2 border-dashed border-primary/30 rounded-md cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-colors group"
                                                    >
                                                        <div className="flex flex-col items-center">
                                                            <Wand2 className="size-4 text-primary mb-0.5 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[10px] text-primary font-medium">AI Image</span>
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Facebook & Instagram Content Type Selection */}
                            {(type === 'FACEBOOK' || type === 'INSTAGRAM') && (
                                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                    <Label className="text-sm font-medium">Content Type</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {['POST', 'REEL'].map((cType) => (
                                            <button

                                                key={cType}
                                                type="button"
                                                onClick={() => {
                                                    setContentType(cType);
                                                    setIsReel(cType === 'REEL');
                                                }}
                                                className={`rounded-md cursor-pointer border px-3 py-1.5 text-sm font-medium transition-all ${contentType === cType
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border bg-background hover:bg-muted'
                                                    }`}
                                            >
                                                {cType === 'POST' ? 'Standard Post' : 'Reel / Short Video'}
                                            </button>
                                        ))}
                                    </div>

                                    {contentType === 'REEL' && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-sm font-medium">Cover Image (Optional)</Label>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => document.getElementById('reel-cover-upload')?.click()}
                                                    disabled={uploadingMedia}
                                                    className="gap-2 w-full cursor-pointer"
                                                >
                                                    <Upload className="size-4" />
                                                    {uploadingMedia ? `Uploading... ${uploadProgress}%` : "Upload Cover"}
                                                </Button>
                                                <input
                                                    id="reel-cover-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleThumbnailUpload}
                                                    className="hidden"
                                                />
                                            </div>
                                            {thumbnailUrl && (
                                                <div className="relative aspect-[9/16] w-20 overflow-hidden rounded border bg-muted">
                                                    <Image src={thumbnailUrl} alt="Cover" fill className="object-cover" unoptimized />
                                                    <button
                                                        type="button"
                                                        onClick={() => setThumbnailUrl(null)}
                                                        className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                Recommended for vertical videos (9:16) under 90 seconds.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* YouTube Specific Fields */}
                            {type === 'YOUTUBE' && (
                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <Youtube className="size-4 text-red-600" />
                                        YouTube Settings
                                    </h3>

                                    {/* Content Type Selection */}
                                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                        <Label className="text-sm font-medium">Content Type</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {['VIDEO', 'SHORT', 'PLAYLIST'].map((yType) => (
                                                <button
                                                    key={yType}
                                                    type="button"
                                                    onClick={() => setYoutubeContentType(yType)}
                                                    className={`rounded-md cursor-pointer border px-3 py-1.5 text-sm font-medium transition-all ${youtubeContentType === yType
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-border bg-background hover:bg-muted'
                                                        }`}
                                                >
                                                    {yType === 'VIDEO' ? 'Standard Video' : yType === 'SHORT' ? 'YouTube Short' : 'Playlist'}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Playlist Options */}
                                        {youtubeContentType === 'PLAYLIST' && (
                                            <div className="space-y-3 pt-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="playlistTitle">New Playlist Title</Label>
                                                    <Input
                                                        id="playlistTitle"
                                                        placeholder="Enter playlist title"
                                                        value={youtubePlaylistTitle}
                                                        onChange={(e) => setYoutubePlaylistTitle(e.target.value)}
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        A new playlist will be created with this title
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="youtubeTags">Tags (comma separated)</Label>
                                            <Input
                                                id="youtubeTags"
                                                placeholder="tutorial, tech, campzeo"
                                                value={youtubeTags}
                                                onChange={(e) => setYoutubeTags(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="youtubePrivacy">Privacy Status</Label>
                                            <div className="border rounded-md">
                                                <Select value={youtubePrivacy} onValueChange={setYoutubePrivacy}>
                                                    <SelectTrigger id="youtubePrivacy">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="public">Public</SelectItem>
                                                        <SelectItem value="private">Private</SelectItem>
                                                        <SelectItem value="unlisted">Unlisted</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="scheduledPostTime">Schedule Post (Optional)</Label>
                                <Input
                                    id="scheduledPostTime"
                                    type="datetime-local"
                                    value={scheduledPostTime}
                                    onChange={(e) => setScheduledPostTime(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Leave empty to send immediately
                                </p>
                            </div>

                            {/* Pinterest Specific Fields */}
                            {type === 'PINTEREST' && (
                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <div className="p-1 bg-red-600 rounded-full">
                                            <span className="text-white text-[10px] font-bold">P</span>
                                        </div>
                                        Pinterest Settings
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="pinterestBoardId">Board *</Label>
                                            {loadingPinterestBoards ? (
                                                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                                                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground">Loading boards...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="border border-1 rounded-md">
                                                        <Select
                                                            value={pinterestBoardId}
                                                            onValueChange={(val) => {
                                                                if (val === 'create_new') {
                                                                    setIsCreatingBoard(true);
                                                                    return;
                                                                }
                                                                setPinterestBoardId(val);
                                                            }}
                                                        >
                                                            <SelectTrigger id="pinterestBoardId">
                                                                <SelectValue placeholder="Select a board" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="create_new" className="text-primary font-medium cursor-pointer bg-primary/5 focus:bg-primary/10">
                                                                    <div className="flex items-center gap-2">
                                                                        <Plus className="size-4" />
                                                                        Create New Board
                                                                    </div>
                                                                </SelectItem>
                                                                {pinterestBoards.map((board) => (
                                                                    <SelectItem key={board.id} value={board.id}>
                                                                        {board.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Dialog open={isCreatingBoard} onOpenChange={setIsCreatingBoard}>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Create New Pinterest Board</DialogTitle>
                                                                <DialogDescription>
                                                                    Create a new board to organize your pins.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-4 py-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor="boardName">Board Name</Label>
                                                                    <Input
                                                                        id="boardName"
                                                                        value={newBoardName}
                                                                        onChange={(e) => setNewBoardName(e.target.value)}
                                                                        placeholder="e.g., Summer Inspiration"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label htmlFor="boardDesc">Description (Optional)</Label>
                                                                    <Textarea
                                                                        id="boardDesc"
                                                                        className="border border-primary/20 rounded-md resize-none"
                                                                        value={newBoardDescription}
                                                                        onChange={(e) => setNewBoardDescription(e.target.value)}
                                                                        placeholder="What's this board about?"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end gap-3">
                                                                <Button className='cursor-pointer' variant="outline" onClick={() => setIsCreatingBoard(false)}>Cancel</Button>
                                                                <Button className='cursor-pointer' onClick={handleCreateBoard} disabled={creatingBoard || !newBoardName.trim()}>
                                                                    {creatingBoard && <Loader2 className="size-4 mr-2 animate-spin" />}
                                                                    Create Board
                                                                </Button>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>



                    {/* WYSIWYG Live Preview */}
                    {type && (
                        <WYSIWYGPreview
                            platform={type}
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            thumbnailUrl={thumbnailUrl}
                            isReel={isReel || youtubeContentType === 'SHORT'}
                            onSubjectChange={setSubject}
                            onMessageChange={setMessage}
                            user={{
                                name: user?.fullName || user?.firstName || 'Your Brand',
                                image: user?.imageUrl
                            }}
                        />
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                        <Button
                            className='cursor-pointer'
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button className='cursor-pointer' type="submit" disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="size-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Post Preview - {type}</DialogTitle>
                        <DialogDescription>
                            Preview how your post will look
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {subject && (
                            <div>
                                <p className="text-sm font-medium mb-1">Title:</p>
                                <p className="text-sm font-semibold">{subject}</p>
                            </div>
                        )}

                        {mediaUrls.length > 0 && (
                            <div>
                                <p className="text-sm font-medium mb-2">Media:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {mediaUrls.map((url, index) => (
                                        <div key={index} className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                                            {isVideoUrl(url) ? (
                                                <div className="flex items-center justify-center h-full bg-black/10">
                                                    <div className="size-12 rounded-full bg-white/80 flex items-center justify-center shadow">
                                                        <div className="ml-1 size-0 border-y-[8px] border-y-transparent border-l-[14px] border-l-primary" />
                                                    </div>
                                                    <p className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Video</p>
                                                </div>
                                            ) : (
                                                <img
                                                    src={url}
                                                    alt={`Media ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="text-sm font-medium mb-1">Message:</p>
                            <div className="p-4 border rounded-lg bg-muted/50 whitespace-pre-wrap">
                                {message || <span className="text-muted-foreground italic">No message</span>}
                            </div>
                        </div>

                        {isReel && (
                            <div className="flex items-center gap-2 text-sm text-primary">
                                <Video className="size-4" />
                                <span>Will be posted as a Reel</span>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Content Assistant */}
            <AIContentAssistant
                open={showAIAssistant}
                onOpenChange={setShowAIAssistant}
                initialTab={aiAssistantTab}
                onInsertContent={(content, subject) => {
                    setMessage(content);
                    if (subject) setSubject(subject);
                }}
                onInsertImage={(url) => {
                    setMediaUrls(prev => [...prev, url]);
                    toast.success('AI image added to post!');
                }}
                context={{
                    platform: type || undefined,
                    existingContent: message,
                }}
            />
        </>
    );
}
