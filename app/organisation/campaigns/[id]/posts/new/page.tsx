
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    ArrowLeft,
    Loader2,
    Save,
    Eye,
    Mail,
    MessageSquare,
    Phone,
    Send,
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    Upload,
    X,
    FileText,
    Image as ImageIcon,
    Video,
    Plus,
    Wand2,
    Sparkles
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { PostPreview } from './_components/post-preview';
import { WYSIWYGPreview } from '../_components/WYSIWYGPreview';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import React from 'react'; // Import React for React.use
import { AIContentAssistant } from '@/components/ai-content-assistant';
import { upload } from '@vercel/blob/client';

export default function NewPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { user } = useUser();
    const router = useRouter();
    const resolvedParams = React.use(params);
    const campaignId = resolvedParams.id;

    // Form state
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [isReel, setIsReel] = useState(false);

    // Platform specific fields
    const [youtubeTags, setYoutubeTags] = useState('');
    const [youtubePrivacy, setYoutubePrivacy] = useState('public');
    const [youtubeContentType, setYoutubeContentType] = useState('VIDEO'); // VIDEO, SHORT, PLAYLIST
    const [youtubePlaylistTitle, setYoutubePlaylistTitle] = useState('');
    const [pinterestBoardId, setPinterestBoardId] = useState('');
    const [pinterestLink, setPinterestLink] = useState('');
    const [senderEmail, setSenderEmail] = useState('');
    const [scheduledPostTime, setScheduledPostTime] = useState('');
    const [saving, setSaving] = useState(false);
    const [organisationPlatforms, setOrganisationPlatforms] = useState<string[]>([]);
    const [loadingPlatforms, setLoadingPlatforms] = useState(true);
    const [campaignContacts, setCampaignContacts] = useState<any[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [contentType, setContentType] = useState('POST'); // For Facebook/Instagram: POST or REEL
    // const [loadingContacts, setLoadingContacts] = useState(true); // Duplicate declaration removed
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');

    // Fetch campaign contacts
    useEffect(() => {
        const fetchCampaignContacts = async () => {
            try {
                setLoadingContacts(true);
                const response = await fetch(`/api/campaigns/${campaignId}`);
                if (!response.ok) {
                    console.error('Failed to fetch campaign');
                    return;
                }
                const data = await response.json();
                setCampaignContacts(data.campaign.contacts || []);
            } catch (error) {
                console.error('Error fetching campaign contacts:', error);
            } finally {
                setLoadingContacts(false);
            }
        };

        fetchCampaignContacts();
    }, [campaignId]);


    const [facebookPages, setFacebookPages] = useState<any[]>([]);
    const [loadingFacebookPages, setLoadingFacebookPages] = useState(false);
    const [selectedFacebookPageId, setSelectedFacebookPageId] = useState<string>('');
    const [selectedFacebookPageAccessToken, setSelectedFacebookPageAccessToken] = useState<string>('');
    const [selectedInstagramBusinessId, setSelectedInstagramBusinessId] = useState<string>('');

    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // Add progress state
    const [templates, setTemplates] = useState<any[]>([]);
    const [pinterestBoards, setPinterestBoards] = useState<{ id: string; name: string }[]>([]);
    const [loadingPinterestBoards, setLoadingPinterestBoards] = useState(false);
    const [youtubePlaylists, setYoutubePlaylists] = useState<{ id: string; title: string }[]>([]);
    const [loadingYoutubePlaylists, setLoadingYoutubePlaylists] = useState(false);
    const [youtubePlaylistId, setYoutubePlaylistId] = useState<string>('');
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

    // New Board State
    const [isCreatingBoard, setIsCreatingBoard] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [newBoardDescription, setNewBoardDescription] = useState('');
    const [creatingBoard, setCreatingBoard] = useState(false);

    // AI Assistant state
    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [aiAssistantTab, setAiAssistantTab] = useState<'text' | 'image'>('text');

    // Helper for inserting variables
    const insertVariable = (variable: string) => {
        const textarea = document.getElementById('message') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newText = before + `{{${variable}}}` + after;

        setMessage(newText);

        // Reset cursor position
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
            textarea.focus();
        }, 0);
    };

    // Fetch organisation platforms
    useEffect(() => {
        const fetchOrgPlatforms = async () => {
            try {
                setLoadingPlatforms(true);
                const response = await fetch('/api/Organisation/GetPlatforms');
                if (!response.ok) {
                    // If API fails, show all platforms
                    setOrganisationPlatforms(['EMAIL', 'SMS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST']);
                    return;
                }
                const data = await response.json();
                const platforms = data.platforms || [];
                // Filter out admin-only platforms (EMAIL, SMS, WHATSAPP are managed by admin)
                const availablePlatforms = platforms.filter((p: string) =>
                    !['EMAIL', 'SMS', 'WHATSAPP'].includes(p.toUpperCase())
                );
                // Add EMAIL, SMS, WHATSAPP as they're always available
                setOrganisationPlatforms(['EMAIL', 'SMS', 'WHATSAPP', ...availablePlatforms]);
            } catch (error) {
                console.error('Error fetching organisation platforms:', error);
                // Default to all platforms on error
                setOrganisationPlatforms(['EMAIL', 'SMS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST']);
            } finally {
                setLoadingPlatforms(false);
            }
        };

        fetchOrgPlatforms();
    }, []);

    // Fetch Pinterest boards
    // Fetch Pinterest boards
    useEffect(() => {
        if (selectedPlatform === 'PINTEREST') {
            const fetchBoards = async () => {
                try {
                    setLoadingPinterestBoards(true);
                    const response = await fetch('/api/socialmedia/pinterest/boards');
                    if (response.ok) {
                        const data = await response.json();
                        setPinterestBoards(data.boards || []);
                        // If only one board, select it
                        if (data.boards && data.boards.length === 1) {
                            setPinterestBoardId(data.boards[0].id);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching Pinterest boards:', error);
                    toast.error('Failed to fetch Pinterest boards');
                } finally {
                    setLoadingPinterestBoards(false);
                }
            };

            fetchBoards();
        } else if (selectedPlatform === 'YOUTUBE') {
            const fetchPlaylists = async () => {
                try {
                    setLoadingYoutubePlaylists(true);
                    const response = await fetch('/api/youtube/playlists');
                    if (response.ok) {
                        const data = await response.json();
                        setYoutubePlaylists(data.playlists || []);
                    }
                } catch (error) {
                    console.error('Error fetching YouTube playlists:', error);
                    toast.error('Failed to fetch YouTube playlists');
                } finally {
                    setLoadingYoutubePlaylists(false);
                }
            };

            fetchPlaylists();
        } else if (selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') {
            const fetchPages = async () => {
                try {
                    setLoadingFacebookPages(true);
                    const response = await fetch('/api/socialmedia/facebook/pages');
                    if (response.ok) {
                        const data = await response.json();
                        setFacebookPages(data.pages || []);

                        // If only one page, select it
                        if (data.pages && data.pages.length === 1) {
                            setSelectedFacebookPageId(data.pages[0].id);
                            setSelectedFacebookPageAccessToken(data.pages[0].access_token);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching Facebook pages:', error);
                    toast.error('Failed to fetch Facebook pages');
                } finally {
                    setLoadingFacebookPages(false);
                }
            };
            fetchPages();
        }
    }, [selectedPlatform]);

    // Get preview content with variables replaced
    const getPreviewContent = () => {
        // Use first contact from campaign for preview, or fallback to placeholder
        const sampleContact = campaignContacts.length > 0 ? campaignContacts[0] : null;

        return message
            .replace(/{{name}}/g, sampleContact?.contactName || 'John Doe')
            .replace(/{{email}}/g, sampleContact?.contactEmail || 'john@example.com')
            .replace(/{{phone}}/g, sampleContact?.contactMobile || '+1234567890')
            .replace(/{{company}}/g, 'Acme Corp'); // Company field not in contact model
    };

    // Get platform icon
    const getPlatformIcon = (platform: string) => {
        switch (platform) {
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
            default:
                return Send;
        }
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

                // Use client-side upload
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
            if (selectedPlatform === 'INSTAGRAM' || selectedPlatform === 'FACEBOOK') {
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

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!selectedPlatform) {
            toast.error('Please select a platform');
            return;
        }

        // SMS validation
        if (selectedPlatform === 'SMS') {
            if (!message) {
                toast.error('Please enter a message for SMS');
                return;
            }
        }
        // Email validation
        if (selectedPlatform === 'EMAIL') {
            if (!senderEmail) {
                toast.error('Please enter sender email');
                return;
            }
            if (!subject) {
                toast.error('Please enter a subject');
                return;
            }
            if (!message) {
                toast.error('Please enter a message');
                return;
            }
        }

        // Social Media validation
        const isSocialPlatform = selectedPlatform && !['EMAIL', 'SMS'].includes(selectedPlatform);
        if (isSocialPlatform) {
            if (!subject && selectedPlatform !== 'SMS') {
                toast.error('Please enter a title');
                return;
            }
            if (!message) {
                toast.error('Please enter a message');
                return;
            }

            // Media validation
            if ((selectedPlatform === 'INSTAGRAM' || selectedPlatform === 'YOUTUBE' || selectedPlatform === 'PINTEREST') && mediaUrls.length === 0) {
                toast.error(`Instagram, YouTube, and Pinterest posts require media`);
                return;
            }

            // YouTube specific validation
            if (selectedPlatform === 'YOUTUBE' && mediaUrls.length > 0 && !mediaUrls[0].match(/\.(mp4|mov|webm)$/i)) {
                toast.error('YouTube requires a video file');
                return;
            }

            // Page validation
            if ((selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && !selectedFacebookPageId && organisationPlatforms.includes(selectedPlatform)) {
                toast.error('Please select a Facebook Page');
                return;
            }
        }

        try {
            setSaving(true);

            const response = await fetch(`/api/campaigns/${campaignId}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject || null,
                    message: message || null,
                    type: selectedPlatform, // Send single type
                    senderEmail: selectedPlatform === 'EMAIL' ? senderEmail : null,
                    scheduledPostTime: scheduledPostTime ? new Date(scheduledPostTime).toISOString() : null,
                    mediaUrls: mediaUrls, // Send array
                    youtubeTags: youtubeTags ? youtubeTags.split(',').map(t => t.trim()) : [],
                    youtubePrivacy,
                    youtubeContentType, // NEW: YouTube content type (VIDEO, SHORT, PLAYLIST)
                    youtubePlaylistTitle, // NEW: Playlist title if creating playlist
                    youtubePlaylistId, // NEW: Existing Playlist ID
                    pinterestBoardId,
                    pinterestLink,
                    isReel, // Send isReel flag
                    contentType, // NEW: Facebook/Instagram content type (POST, REEL)
                    thumbnailUrl, // Send thumbnail
                    facebookPageId: selectedFacebookPageId, // NEW: Selected Facebook Page
                    facebookPageAccessToken: selectedFacebookPageAccessToken, // NEW: Selected Facebook Page Access Token
                    instagramBusinessId: selectedInstagramBusinessId // NEW: Linked Instagram ID
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create post');
            }

            toast.success('Post created successfully');
            router.push(`/organisation/campaigns/${campaignId}/posts`);
        } catch (error) {
            console.error('Error creating post:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create post');
        } finally {
            setSaving(false);
        }
    };

    // Handle platform selection toggle
    const togglePlatform = (platform: string) => {
        setSelectedPlatform(prev => prev === platform ? null : platform);
    };

    // Reset other fields when changing YouTube content type
    useEffect(() => {
        if (selectedPlatform === 'YOUTUBE') {
            // Default to public for all types unless user changes it
            setYoutubePrivacy('public');
        }
    }, [youtubeContentType, selectedPlatform]);

    // Fetch templates when platform changes
    useEffect(() => {
        if (selectedPlatform) {
            fetchTemplates(selectedPlatform);
        } else {
            setTemplates([]);
            setSelectedTemplateId('none');
        }
    }, [selectedPlatform]);

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
    // Handle template selection
    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId);

        if (!templateId || templateId === 'none') {
            // Clear the form if "none" is selected
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
            if (meta.postType && selectedPlatform === 'YOUTUBE') {
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
            if (meta.postType && (selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM')) {
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

    return (
        <div className="p-6 overflow-hidden  mx-auto space-y-6">
            {/* Header */}
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
                    <h1 className="text-3xl font-bold tracking-tight">New Post</h1>
                    <p className="text-muted-foreground mt-1">
                        Create a new post for this campaign
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Post Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Post Details</CardTitle>
                            <CardDescription>
                                Create content for your campaign
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
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
                                                const isSelected = selectedPlatform === platform;
                                                const Icon = getPlatformIcon(platform);

                                                return (
                                                    <button
                                                        key={platform}
                                                        type="button"
                                                        onClick={() => togglePlatform(platform)}
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
                                        <p className="text-xs text-muted-foreground">
                                            Select a platform to configure your post
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Other Platforms Form */}
                            {selectedPlatform && selectedPlatform !== 'EMAIL' && (
                                <div className="space-y-4">
                                    {/* Template Selection */}
                                    {!loadingTemplates && templates.length > 0 && (
                                        <div className="space-y-2 p-4 bg-muted/20 rounded-lg border border-dashed">
                                            <Label htmlFor="template" className="text-xs font-semibold uppercase text-muted-foreground">Quick Start with Template</Label>
                                            <Select value={selectedTemplateId || "none"} onValueChange={handleTemplateSelect}>
                                                <SelectTrigger id="template" className="bg-background border border-2 border-gray-200">
                                                    <SelectValue placeholder="Select a template..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None - Start from scratch</SelectItem>
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
                                                Selecting a template will populate the fields below. You can still edit them.
                                            </p>
                                        </div>
                                    )}
                                    {/* Title Field for Social Media & WhatsApp */}
                                    {selectedPlatform !== 'SMS' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="subject">Title *</Label>
                                            <Input
                                                id="subject"
                                                placeholder="Enter post title"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                required={selectedPlatform !== 'SMS' && selectedPlatform !== 'EMAIL'}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                This will be displayed as the bold header of your post
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="message">Message *</Label>
                                        <div className="relative">
                                            <Textarea
                                                id="message"
                                                placeholder="Enter your message"
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                rows={6}
                                                required={true}
                                                className="pr-12 border border-2 border-gray-300 rounded-2xl"
                                            />
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="absolute bottom-2 right-2 size-8 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 shadow-lg"
                                                onClick={() => setShowAIAssistant(true)}
                                                title="Generate content with AI"
                                            >
                                                <Sparkles className="size-4" />
                                            </Button>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>
                                                {message.length} characters
                                            </span>
                                            <span>
                                                {selectedPlatform === 'SMS' && `Limit: 160 | `}
                                                {selectedPlatform === 'TWITTER' && `Limit: 280 | `}
                                                {selectedPlatform === 'INSTAGRAM' && `Limit: 2200`}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedPlatform === 'SMS' && 'SMS messages are limited to 160 characters. '}
                                            {selectedPlatform === 'WHATSAPP' && 'WhatsApp messages support rich formatting. '}
                                            {selectedPlatform === 'FACEBOOK' && 'Create engaging content for your Facebook audience. '}
                                            {selectedPlatform === 'INSTAGRAM' && 'Share visual content with your Instagram followers. '}
                                            {selectedPlatform === 'LINKEDIN' && 'Professional content for your LinkedIn network. '}
                                            {selectedPlatform === 'YOUTUBE' && 'Video description or community post. '}
                                        </p>
                                    </div>

                                </div>
                            )}

                            {/* Email Form */}
                            {selectedPlatform === 'EMAIL' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="senderEmail">Sender Email *</Label>
                                        <Input
                                            id="senderEmail"
                                            type="email"
                                            placeholder="sender@example.com"
                                            value={senderEmail}
                                            onChange={(e) => setSenderEmail(e.target.value)}
                                            required={selectedPlatform === 'EMAIL'}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject *</Label>
                                        <Input
                                            id="subject"
                                            placeholder="Enter email subject"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            required={selectedPlatform === 'EMAIL'}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="message">Message *</Label>
                                        <div className="relative">
                                            <Textarea
                                                id="message"
                                                placeholder="Enter your email message (HTML supported)"
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                rows={10}
                                                required={selectedPlatform === 'EMAIL'}
                                                className="pr-12 border border-2 border-gray-300 rounded-2xl"
                                            />
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="absolute bottom-2 right-2 size-8 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 shadow-lg"
                                                onClick={() => setShowAIAssistant(true)}
                                                title="Generate content with AI"
                                            >
                                                <Sparkles className="size-4" />
                                            </Button>

                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <p className="text-xs text-muted-foreground w-full">
                                                Insert variables:
                                            </p>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('name')}
                                            >
                                                {'{{name}}'}
                                            </Button>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('email')}
                                            >
                                                {'{{email}}'}
                                            </Button>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('phone')}
                                            >
                                                {'{{phone}}'}
                                            </Button>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('company')}
                                            >
                                                {'{{company}}'}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Variables will be replaced with actual contact data when sent
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="scheduledPostTime">Schedule Email (Optional)</Label>
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




                                    {/* Email Attachments */}
                                    <div className="space-y-2 pt-4 border-t">
                                        <div className="flex items-center justify-between mb-1">
                                            <Label className="text-xs">
                                                Attachments (Docs, Images, etc.)
                                            </Label>
                                            <span className="text-[10px] text-muted-foreground">{mediaUrls.length}/10</span>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {mediaUrls.map((url, index) => (
                                                <div key={index} className="relative rounded-md overflow-hidden border bg-muted/50 size-20 group">
                                                    {url.match(/\.(mp4|mov|webm)$/i) ? (
                                                        <div className="flex items-center justify-center h-full">
                                                            <Video className="size-6 text-muted-foreground" />
                                                        </div>
                                                    ) : url.match(/\.(pdf|doc|docx|xls|xlsx|txt|csv)$/i) ? (
                                                        <div className="flex items-center justify-center h-full">
                                                            <FileText className="size-6 text-muted-foreground" />
                                                        </div>
                                                    ) : (
                                                        <Image
                                                            src={url}
                                                            alt={`Attachment ${index + 1}`}
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMedia(index)}
                                                        className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            ))}

                                            {mediaUrls.length < 10 && (
                                                <label htmlFor="email-attachment-upload" className="flex flex-col items-center justify-center size-20 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                                    <div className="flex flex-col items-center">
                                                        <Upload className="size-4 text-muted-foreground mb-0.5" />
                                                        <span className="text-[10px] text-muted-foreground">Add</span>
                                                    </div>
                                                    <input
                                                        id="email-attachment-upload"
                                                        type="file"
                                                        className="hidden"
                                                        accept="*/*"
                                                        onChange={handleFileUpload}
                                                        disabled={uploadingMedia}
                                                        multiple
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Other Platforms Form */}
                            {selectedPlatform && selectedPlatform !== 'EMAIL' && (
                                <div className="space-y-4">


                                    {/* Media Upload */}
                                    {/* Media Upload */}
                                    {['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST', 'EMAIL', 'WHATSAPP'].includes(selectedPlatform) && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <Label className="text-xs">
                                                    {selectedPlatform === 'YOUTUBE' ? 'Video *' :
                                                        selectedPlatform === 'EMAIL' ? 'Attachments (Docs, Images, etc.)' :
                                                            selectedPlatform === 'WHATSAPP' ? 'Media (Images, Video, PDF)' :
                                                                'Media (Photo/Video)'}
                                                    {(selectedPlatform === 'INSTAGRAM' || selectedPlatform === 'PINTEREST') && ' *'}
                                                </Label>
                                                <span className="text-[10px] text-muted-foreground">{mediaUrls.length}/10</span>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {mediaUrls.map((url, index) => (
                                                    <div key={index} className="relative rounded-md overflow-hidden border bg-muted/50 size-20 group">
                                                        {url.match(/\.(mp4|mov|webm)$/i) ? (
                                                            <div className="flex items-center justify-center h-full">
                                                                <Video className="size-6 text-muted-foreground" />
                                                            </div>
                                                        ) : url.match(/\.(pdf|doc|docx|xls|xlsx|txt|csv)$/i) ? (
                                                            <div className="flex items-center justify-center h-full">
                                                                <FileText className="size-6 text-muted-foreground" />
                                                            </div>
                                                        ) : (
                                                            <Image
                                                                src={url}
                                                                alt={`Media ${index + 1}`}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeMedia(index)}
                                                            className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                        >
                                                            <X className="size-3" />
                                                        </button>
                                                    </div>
                                                ))}

                                                {mediaUrls.length < 10 && (
                                                    <div className="flex gap-2">
                                                        <label htmlFor="media-upload" className="flex flex-col items-center justify-center size-20 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                                            {uploadingMedia ? (
                                                                <div className="flex flex-col items-center">
                                                                    <Loader2 className="size-4 text-muted-foreground animate-spin mb-0.5" />
                                                                    <span className="text-[10px] text-muted-foreground">{uploadProgress}%</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center">
                                                                    <Upload className="size-4 text-muted-foreground mb-0.5" />
                                                                    <span className="text-[10px] text-muted-foreground">Add</span>
                                                                </div>
                                                            )}
                                                            <input
                                                                id="media-upload"
                                                                type="file"
                                                                className="hidden"
                                                                accept={
                                                                    selectedPlatform === 'YOUTUBE' ? 'video/*' :
                                                                        selectedPlatform === 'EMAIL' ? '*/*' :
                                                                            selectedPlatform === 'WHATSAPP' ? 'image/*,video/*,application/pdf' :
                                                                                'image/*,video/*'
                                                                }
                                                                onChange={handleFileUpload}
                                                                disabled={uploadingMedia}
                                                                multiple
                                                            />
                                                        </label>

                                                        {/* AI Image Generation Shortcut */}
                                                        {selectedPlatform !== 'SMS' && selectedPlatform !== 'EMAIL' && (
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

                                    {/* Facebook & Instagram Page Selection */}
                                    {(selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && (
                                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <Label className="text-sm font-medium flex items-center gap-2">
                                                <Facebook className="size-4 text-blue-600" />
                                                Select Facebook Page
                                            </Label>
                                            {loadingFacebookPages ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="size-3 animate-spin" />
                                                    Loading pages...
                                                </div>
                                            ) : facebookPages.length === 0 ? (
                                                <p className="text-xs text-red-500">No Facebook Pages found. Make sure you've connected your account and granted permissions.</p>
                                            ) : (
                                                <Select
                                                    value={selectedFacebookPageId}
                                                    onValueChange={(val) => {
                                                        setSelectedFacebookPageId(val);
                                                        const page = facebookPages.find(p => p.id === val);
                                                        if (page) {
                                                            setSelectedFacebookPageAccessToken(page.access_token);
                                                            if (page.instagram_business_account?.id) {
                                                                setSelectedInstagramBusinessId(page.instagram_business_account.id);
                                                            } else {
                                                                setSelectedInstagramBusinessId('');
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className='border border-gray200'>
                                                        <SelectValue placeholder="Select a page to post to" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {facebookPages.map((page) => (
                                                            <SelectItem key={page.id} value={page.id}>
                                                                {page.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            <p className="text-[10px] text-muted-foreground">
                                                Posts will be published to the selected page.
                                            </p>
                                        </div>
                                    )}

                                    {/* Facebook & Instagram Content Type Selection */}
                                    {(selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && (
                                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <Label className="text-sm font-medium">Content Type</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {['POST', 'REEL'].map((type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => {
                                                            setContentType(type);
                                                            setIsReel(type === 'REEL');
                                                        }}
                                                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-all ${contentType === type
                                                            ? 'border-primary bg-primary/10 text-primary cursor-pointer'
                                                            : 'border-border bg-background hover:bg-muted cursor-pointer'
                                                            }`}
                                                    >
                                                        {type === 'POST' ? 'Standard Post' : 'Reel / Short Video'}
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
                                                            <ImageIcon className="size-4" />
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
                                                                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 cursor-pointer"
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
                                    {selectedPlatform === 'YOUTUBE' && (
                                        <div className="space-y-4 pt-4 border-t">
                                            <h3 className="font-medium flex items-center gap-2">
                                                <Youtube className="size-4 text-red-600" />
                                                YouTube Settings
                                            </h3>

                                            {/* Content Type Selection */}
                                            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                                <Label className="text-sm font-medium">Content Type</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['VIDEO', 'SHORT', 'PLAYLIST'].map((type) => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => setYoutubeContentType(type)}
                                                            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-all ${youtubeContentType === type
                                                                ? 'border-primary bg-primary/10 text-primary cursor-pointer'
                                                                : 'border-border bg-background hover:bg-muted cursor-pointer'
                                                                }`}
                                                        >
                                                            {type === 'VIDEO' ? 'Standard Video' : type === 'SHORT' ? 'YouTube Short' : 'Playlist'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Playlist Options */}
                                                {youtubeContentType === 'PLAYLIST' && (
                                                    <div className="space-y-3 pt-2">
                                                        {loadingYoutubePlaylists ? (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Loader2 className="size-3 animate-spin" />
                                                                Loading playlists...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="border rounded-md">
                                                                    <Select
                                                                        value={isCreatingPlaylist ? 'create_new' : (youtubePlaylistId || 'select')}
                                                                        onValueChange={(val) => {
                                                                            if (val === 'create_new') {
                                                                                setIsCreatingPlaylist(true);
                                                                                setYoutubePlaylistId('');
                                                                                return;
                                                                            }
                                                                            // Explicitly handle "select" to clear value, though it shouldn't be selectable if disabled
                                                                            if (val === 'select') {
                                                                                setYoutubePlaylistId('');
                                                                                return;
                                                                            }

                                                                            setIsCreatingPlaylist(false);
                                                                            setYoutubePlaylistId(val);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger id="youtubePlaylist">
                                                                            <SelectValue placeholder="Select a playlist" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="select" disabled>Select a playlist...</SelectItem>
                                                                            <SelectItem value="create_new" className="text-primary font-medium cursor-pointer bg-primary/5 focus:bg-primary/10">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Plus className="size-4" />
                                                                                    Create New Playlist
                                                                                </div>
                                                                            </SelectItem>
                                                                            {youtubePlaylists.map(playlist => (
                                                                                <SelectItem key={playlist.id} value={playlist.id}>
                                                                                    {playlist.title}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select></div>
                                                            </>
                                                        )}

                                                        {isCreatingPlaylist && (
                                                            <div className="space-y-2 pt-2 border-l-2 border-primary pl-4 ml-1">
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
                                                        )}
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
                                            <div className="space-y-2 pt-2">
                                                <Label className="text-sm font-medium">Custom Thumbnail</Label>
                                                <div className="flex items-center gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => document.getElementById('yt-thumbnail-upload')?.click()}
                                                        disabled={uploadingMedia}
                                                        className="gap-2 cursor-pointer"
                                                    >
                                                        <ImageIcon className="size-4" />
                                                        {uploadingMedia ? `Uploading... ${uploadProgress}%` : "Upload Thumbnail"}
                                                    </Button>
                                                    <input
                                                        id="yt-thumbnail-upload"
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleThumbnailUpload}
                                                        className="hidden"
                                                    />
                                                    {thumbnailUrl && (
                                                        <div className="relative aspect-video w-32 overflow-hidden rounded border bg-muted group cursor-pointer">
                                                            <Image src={thumbnailUrl} alt="Thumbnail" fill className="object-cover" unoptimized />
                                                            <button
                                                                type="button"
                                                                onClick={() => setThumbnailUrl(null)}
                                                                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X className="size-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pinterest Specific Fields */}
                                    {selectedPlatform === 'PINTEREST' && (
                                        <div className="space-y-4 pt-4 border-t">
                                            <h3 className="font-medium flex items-center gap-2">
                                                <div className="p-1 bg-red-600 rounded-full">
                                                    <span className="text-white text-[10px] font-bold">P</span>
                                                </div>
                                                Pinterest Settings
                                            </h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-2 ">
                                                    <Label htmlFor="pinterestBoard">Select Board</Label>
                                                    {loadingPinterestBoards ? (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Loader2 className="size-3 animate-spin" />
                                                            Loading boards...
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
                                                                    <SelectTrigger id="pinterestBoard">
                                                                        <SelectValue placeholder="Select a board" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="create_new" className="text-primary font-medium cursor-pointer bg-primary/5 focus:bg-primary/10">
                                                                            <div className="flex items-center gap-2">
                                                                                <Plus className="size-4" />
                                                                                Create New Board
                                                                            </div>
                                                                        </SelectItem>
                                                                        {pinterestBoards.map(board => (
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
                                                                                className='border border-primary/20 rounded-md resize-none'
                                                                                id="boardDesc"
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
                                                <div className="space-y-2">
                                                    <Label htmlFor="pinterestLink">Destination Link (Optional)</Label>
                                                    <Input
                                                        id="pinterestLink"
                                                        placeholder="https://example.com"
                                                        value={pinterestLink}
                                                        onChange={(e) => setPinterestLink(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Schedule Field */}
                                    {selectedPlatform && (
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
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* WYSIWYG Live Preview */}
                    {selectedPlatform && (
                        <WYSIWYGPreview
                            platform={selectedPlatform}
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

                    <div className="flex  justify-end gap-4">
                        <Button
                            className='cursor-pointer'
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            className='cursor-pointer'
                            type="submit" disabled={saving || !selectedPlatform || uploadingMedia}>
                            {saving ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="size-4 mr-2" />
                                    Create Post
                                </>
                            )}
                        </Button>

                        {/* Preview Button - Opens Modal */}
                        {/* <Dialog>
                                        <DialogTrigger asChild>
                                            <Button type="button" variant="secondary" disabled={!selectedPlatform}>
                                                <Eye className="size-4 mr-2" />
                                                Preview
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    {selectedPlatform && (() => {
                                                        const Icon = getPlatformIcon(selectedPlatform);
                                                        return <Icon className="size-5" />;
                                                    })()}
                                                    Post Preview
                                                </DialogTitle>
                                                <DialogDescription>
                                                    See how your post will look on {selectedPlatform?.charAt(0)}{selectedPlatform?.slice(1).toLowerCase()}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="mt-4">
                                                <PostPreview
                                                    platforms={selectedPlatform ? [selectedPlatform] : []}
                                                    subject={subject}
                                                    message={message}
                                                    mediaUrls={mediaUrls}
                                                    thumbnailUrl={thumbnailUrl}
                                                    isReel={isReel}
                                                    user={{
                                                        name: user?.fullName || user?.firstName || 'User',
                                                        image: user?.imageUrl
                                                    }}
                                                />
                                            </div>
                                        </DialogContent>
                                    </Dialog> */}
                    </div>
                </form>

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
                        platform: selectedPlatform || undefined,
                        existingContent: message,
                    }}
                />
            </div>
        </div >
    );
}



