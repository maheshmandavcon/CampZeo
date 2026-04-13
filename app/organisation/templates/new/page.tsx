"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Play, Sparkles, Mail, MessageSquare, Facebook, Instagram, Linkedin, Youtube, Twitter, Image as ImageIcon, Send, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, ThumbsUp, Repeat2, Upload, X, Phone, Pin, MoreVertical } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { uploadToServer, deleteFromDriveImmediate } from '@/lib/upload-helper';
import { useMediaCleanup } from '@/hooks/use-media-cleanup';
import { getMediaPreviewUrl } from '@/lib/media-utils';

const ALL_PLATFORMS = [
    { value: "EMAIL", label: "Email", icon: Mail },
    { value: "SMS", label: "SMS", icon: MessageSquare },
    { value: "FACEBOOK", label: "Facebook", icon: Facebook },
    { value: "INSTAGRAM", label: "Instagram", icon: Instagram },
    { value: "LINKEDIN", label: "LinkedIn", icon: Linkedin },
    { value: "YOUTUBE", label: "YouTube", icon: Youtube },
    { value: "TWITTER", label: "Twitter", icon: Twitter },
    { value: "WHATSAPP", label: "WhatsApp", icon: Phone },
    { value: "PINTEREST", label: "Pinterest", icon: Pin },
];

export default function NewTemplatePage() {
    const router = useRouter();
    const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const { trackUpload, markAsSubmitted } = useMediaCleanup();
    const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        subject: "",
        content: "",
        platform: "",
        category: "CUSTOM",
        isActive: true,
        mediaUrls: [] as string[],
        metadata: {} as any,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

    useEffect(() => {
        fetchConnectedPlatforms();
    }, []);

    const fetchConnectedPlatforms = async () => {
        try {
            const res = await fetch("/api/Organisation/GetPlatforms");
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.platforms) {
                    setConnectedPlatforms(data.platforms);
                    setOrganisationId(data.organisationId);

                    // Set default platform to first connected one
                    if (data.platforms.length > 0 && !formData.platform) {
                        setFormData(prev => ({ ...prev, platform: data.platforms[0] }));
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch connected platforms", error);
            toast.error("Failed to load connected platforms");
        } finally {
            setIsLoadingPlatforms(false);
        }
    };

    // Filter platforms to only show connected ones
    const PLATFORMS = ALL_PLATFORMS.filter(p => connectedPlatforms.includes(p.value));

    const handlePlatformChange = (newPlatform: string) => {
        // Reset subject, content, mediaUrls and metadata when platform changes
        setFormData({
            ...formData,
            platform: newPlatform,
            subject: "",
            content: "",
            mediaUrls: [],
            metadata: {},
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);
        try {
            const uploadedUrls: string[] = [];

            for (const file of Array.from(files)) {
                const newBlob = await uploadToServer(file, organisationId || undefined);

                if (newBlob.url) {
                    console.log(`[Drive] Template Image tracked: ${newBlob.url}`);
                    trackUpload(newBlob.url);
                    uploadedUrls.push(newBlob.url);
                }
            }

            setFormData(prev => ({
                ...prev,
                mediaUrls: [...prev.mediaUrls, ...uploadedUrls]
            }));

            toast.success(`${uploadedUrls.length} file(s) uploaded successfully`);
        } catch (error) {
            console.error('Error uploading files:', error);
            toast.error('Failed to upload files');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            e.target.value = ''; // Reset file input to allow re-uploading same file
        }
    };

    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);
        try {
            const file = files[0];

            // Use client-side upload
            const newBlob = await uploadToServer(file, organisationId || undefined);

            if (newBlob.url) {
                console.log(`[Drive] Template Thumbnail tracked: ${newBlob.url}`);
                trackUpload(newBlob.url);
                setFormData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, thumbnailUrl: newBlob.url }
                }));
                toast.success('Thumbnail uploaded successfully');
            }
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            toast.error('Failed to upload thumbnail');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            e.target.value = ''; // Reset file input to allow re-uploading same file
        }
    };

    const removeImage = (index: number) => {
        const urlToRemove = formData.mediaUrls[index];
        setFormData(prev => ({
            ...prev,
            mediaUrls: prev.mediaUrls.filter((_, i) => i !== index)
        }));

        if (urlToRemove) {
            console.log(`[Drive] Manual template image removal: ${urlToRemove}`);
            deleteFromDriveImmediate([urlToRemove]).catch(err => {
                console.error('[Drive] Manual cleanup failed:', err);
            });
        }
    };

    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const isYouTube = (url: string) => !!getYouTubeId(url);
    const isPinterest = (url: string) => url.includes('pinterest.com/pin/') || url.includes('pin.it/');

    const isVideo = (url: string) => {
        return url.match(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i) || isYouTube(url) || isPinterest(url);
    };

    const handleCreate = async () => {
        try {
            // Validation
            if (!formData.name) {
                toast.error("Template name is required");
                return;
            }
            if (!formData.platform) {
                toast.error("Please select a platform");
                return;
            }
            if (!formData.content) {
                toast.error("Template content is required");
                return;
            }

            console.log('Creating template with data:', formData);

            setIsSaving(true);
            const response = await fetch("/api/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (response.ok && data.success) {
                markAsSubmitted();
                toast.success("Template created successfully");
                router.push("/organisation/templates");
            } else {
                const errorMessage = data.error || data.message || "Failed to create template";
                console.error('Template creation failed:', errorMessage);
                toast.error(errorMessage);
            }
        } catch (error) {
            console.error("Error creating template:", error);
            toast.error(error instanceof Error ? error.message : "Failed to create template");
        } finally {
            setIsSaving(false);
        }
    };

    const renderPlatformPreview = () => {
        const hasMedia = formData.mediaUrls.length > 0;
        const currentMediaUrl = hasMedia ? formData.mediaUrls[currentMediaIndex] : null;

        const nextImage = (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsPlayingVideo(false);
            setCurrentMediaIndex((prev) => (prev + 1) % formData.mediaUrls.length);
        };

        const prevImage = (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsPlayingVideo(false);
            setCurrentMediaIndex((prev) => (prev - 1 + formData.mediaUrls.length) % formData.mediaUrls.length);
        };

        const renderMediaItem = (url: string, aspectRatio: string = "aspect-video") => {
            const ytId = getYouTubeId(url);
            const coverImageUrl = formData.metadata?.thumbnailUrl ? getMediaPreviewUrl(formData.metadata.thumbnailUrl) : null;

            return (
                <div className="relative group">
                    <div
                        className={cn(
                            "relative w-full overflow-hidden rounded bg-gray-100",
                            aspectRatio,
                            isVideo(url) ? 'cursor-pointer' : ''
                        )}
                        onClick={() => {
                            if (isVideo(url)) {
                                setIsPlayingVideo(true);
                            }
                        }}
                    >
                        {isPlayingVideo ? (
                            ytId ? (
                                <iframe
                                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                                    className="absolute inset-0 size-full"
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                />
                            ) : isVideo(url) ? (
                                <video
                                    src={getMediaPreviewUrl(url)}
                                    className="size-full object-cover"
                                    controls
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                />
                            ) : null
                        ) : (
                            <>
                                {coverImageUrl && currentMediaIndex === 0 ? (
                                    <Image
                                        src={coverImageUrl}
                                        alt="Cover"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (isVideo(url) && !ytId) ? (
                                    <video
                                        src={getMediaPreviewUrl(url)}
                                        className="size-full object-cover"
                                        preload="metadata"
                                        muted
                                        playsInline
                                    />
                                ) : (
                                    <Image
                                        src={ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : getMediaPreviewUrl(url)}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                )}

                                {isVideo(url) && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                                        <div className="rounded-full bg-red-600 p-3 shadow-lg transform group-hover:scale-110 transition-transform">
                                            <Play className="size-8 text-white fill-white" />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Carousel Controls */}
                    {formData.mediaUrls.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 z-10"
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 z-10"
                            >
                                <ChevronRight className="size-4" />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                                {formData.mediaUrls.map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "size-1.5 rounded-full transition-all",
                                            i === currentMediaIndex ? "bg-white w-3" : "bg-white/50"
                                        )}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            );
        };

        const renderContentEditor = (placeholder: string, className: string = "", style: any = {}) => (
            <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder={placeholder}
                className={cn(
                    "w-full resize-none border-0 bg-transparent p-0 focus:outline-none focus:ring-0",
                    className
                )}
                style={{ whiteSpace: 'pre-wrap', ...style }}
            />
        );

        const renderSubjectEditor = (placeholder: string, className: string = "") => (
            <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder={placeholder}
                className={cn(
                    "w-full border-0 bg-transparent p-0 focus:outline-none focus:ring-0",
                    className
                )}
            />
        );

        switch (formData.platform) {
            case "FACEBOOK":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-3">
                            <div className="mb-2 flex items-center gap-2">
                                <div className="size-10 rounded-full bg-gray-200" />
                                <div>
                                    <p className="text-sm font-semibold">Your Brand</p>
                                    <p className="text-xs text-gray-500">Just now · 🌐</p>
                                </div>
                            </div>
                            <div className="mb-2 text-sm text-gray-900">
                                {renderContentEditor("Your message will appear here...", "min-h-[60px]")}
                            </div>
                            {hasMedia && renderMediaItem(currentMediaUrl!)}
                            <div className="flex items-center justify-between border-t pt-2 mt-2">
                                <div className="flex gap-4">
                                    <button className="flex items-center gap-1 text-xs text-gray-500"><ThumbsUp className="size-4" /> Like</button>
                                    <button className="flex items-center gap-1 text-xs text-gray-500"><MessageCircle className="size-4" /> Comment</button>
                                </div>
                                <button className="flex items-center gap-1 text-xs text-gray-500"><Share2 className="size-4" /> Share</button>
                            </div>
                        </div>
                    </div>
                );

            case "INSTAGRAM":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 p-3">
                            <div className="size-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-0.5">
                                <div className="h-full w-full rounded-full border-2 border-white bg-gray-200" />
                            </div>
                            <p className="text-sm font-semibold">yourbrand</p>
                            <MoreHorizontal className="ml-auto size-5" />
                        </div>
                        {hasMedia ? renderMediaItem(currentMediaUrl!, "aspect-square") : (
                            <div className="flex aspect-square items-center justify-center bg-gray-50">
                                <ImageIcon className="size-12 text-gray-400" />
                            </div>
                        )}
                        <div className="p-3">
                            <div className="mb-2 flex gap-4">
                                <Heart className="size-6" />
                                <MessageCircle className="size-6" />
                                <Send className="size-6" />
                                <Bookmark className="ml-auto size-6" />
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold mr-2">yourbrand</span>
                                {renderContentEditor("Write a caption...", "inline-block min-h-[40px]")}
                            </div>
                        </div>
                    </div>
                );

            case "LINKEDIN":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-3">
                            <div className="mb-2 flex items-start gap-2">
                                <div className="size-12 rounded bg-gray-200" />
                                <div>
                                    <p className="text-sm font-semibold">Your Brand</p>
                                    <p className="text-xs text-gray-500">1,234 followers</p>
                                    <p className="text-xs text-gray-500">Just now · 🌐</p>
                                </div>
                            </div>
                            {renderSubjectEditor("Post title...", "mb-1 text-sm font-semibold text-gray-900")}
                            <div className="mb-2 text-sm text-gray-900">
                                {renderContentEditor("Your post content...", "min-h-[60px]")}
                            </div>
                            {hasMedia && renderMediaItem(currentMediaUrl!)}
                            <div className="flex items-center gap-4 border-t pt-2 mt-2">
                                <button className="flex items-center gap-1 text-sm text-gray-500"><ThumbsUp className="size-4" /> Like</button>
                                <button className="flex items-center gap-1 text-sm text-gray-500"><MessageCircle className="size-4" /> Comment</button>
                                <button className="flex items-center gap-1 text-sm text-gray-500"><Repeat2 className="size-4" /> Repost</button>
                                <button className="flex items-center gap-1 text-sm text-gray-500"><Send className="size-4" /> Send</button>
                            </div>
                        </div>
                    </div>
                );

            case "YOUTUBE":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        {hasMedia ? renderMediaItem(currentMediaUrl!, formData.metadata?.postType === 'SHORT' ? "aspect-[9/16] mx-auto w-1/2" : "aspect-video") : (
                            <div className="flex aspect-video items-center justify-center bg-gray-900">
                                <Play className="size-16 text-gray-600" />
                            </div>
                        )}
                        <div className="p-3">
                            {renderSubjectEditor("Video title...", "text-sm font-semibold text-gray-900 mb-1")}
                            <div className="text-xs text-gray-500">
                                {renderContentEditor("Description...", "min-h-[40px]")}
                            </div>
                        </div>
                    </div>
                );

            case "TWITTER":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-3 flex gap-3">
                            <div className="size-10 rounded-full bg-gray-200 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <span className="font-semibold text-sm">Your Brand</span>
                                    <span className="text-gray-500 text-sm">@yourbrand · now</span>
                                </div>
                                <div className="mt-1 text-sm text-gray-900">
                                    {renderContentEditor("What's happening?", "min-h-[60px]")}
                                </div>
                                {hasMedia && <div className="mt-2">{renderMediaItem(currentMediaUrl!)}</div>}
                                <div className="mt-3 flex justify-between max-w-xs text-gray-500">
                                    <MessageCircle className="size-4" />
                                    <Repeat2 className="size-4" />
                                    <Heart className="size-4" />
                                    <Share2 className="size-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "EMAIL":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="border-b bg-gray-50 p-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="font-medium shrink-0">Subject:</span>
                                {renderSubjectEditor("Email subject...", "font-semibold text-gray-900")}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-medium shrink-0">From:</span>
                                <span>your-brand@company.com</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-sm text-gray-900">
                                {renderContentEditor("Email content...", "min-h-[150px]")}
                            </div>
                            {hasMedia && <div className="mt-4">{renderMediaItem(currentMediaUrl!)}</div>}
                        </div>
                    </div>
                );

            case "SMS":
            case "WHATSAPP":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-4 bg-[#e5ddd5] min-h-[200px] flex flex-col justify-end">
                            <div className="bg-white rounded-lg shadow-sm p-2 max-w-[85%] relative self-start">
                                <div className="text-sm text-gray-900 mb-2">
                                    {renderContentEditor("Message text...", "min-h-[40px]")}
                                </div>
                                {hasMedia && renderMediaItem(currentMediaUrl!, "aspect-video mb-1")}
                                <div className="flex items-center justify-end gap-1">
                                    <span className="text-[10px] text-gray-400">12:34 PM</span>
                                    {formData.platform === 'WHATSAPP' && <span className="text-blue-500">✓✓</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "PINTEREST":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden mx-auto" style={{ maxWidth: "300px" }}>
                        {hasMedia ? renderMediaItem(currentMediaUrl!, "aspect-[2/3]") : (
                            <div className="flex aspect-[2/3] items-center justify-center bg-gray-50">
                                <ImageIcon className="size-12 text-gray-300" />
                            </div>
                        )}
                        <div className="p-4">
                            {renderSubjectEditor("Add a title", "text-lg font-bold text-gray-900 mb-2")}
                            <div className="flex items-center gap-2 mb-3">
                                <div className="size-8 rounded-full bg-gray-200" />
                                <span className="text-sm font-semibold">yourbrand</span>
                            </div>
                            <div className="text-sm text-gray-600">
                                {renderContentEditor("Add a detailed description...", "min-h-[60px]")}
                            </div>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="rounded-lg border bg-gray-50 p-8 text-center">
                        <p className="text-sm text-gray-500">Preview not available for this platform</p>
                    </div>
                );
        }
    };

    const showSubjectField = ["EMAIL", "FACEBOOK", "LINKEDIN", "YOUTUBE", "PINTEREST"].includes(formData.platform);

    return (
        <div className="p-6  mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => router.back()}>
                        <ChevronLeft className="size-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <Sparkles className="size-5 text-primary" />
                        <div>
                            <h1 className="text-lg font-semibold">Create New Template</h1>
                            <p className="text-xs text-muted-foreground">Design reusable content for your campaigns</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-6">
                <div className="mx-auto space-y-6">
                    {/* Template Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Template Name</label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Weekly Newsletter"
                            className="text-base"
                        />
                    </div>

                    {/* Platform Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Select Platform</label>
                        <div className="flex flex-wrap gap-2">
                            {PLATFORMS.map((platform) => {
                                const Icon = platform.icon;
                                const isSelected = formData.platform === platform.value;
                                return (
                                    <button
                                        key={platform.value}
                                        onClick={() => handlePlatformChange(platform.value)}
                                        className={cn(
                                            "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all",
                                            isSelected
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border bg-background hover:border-primary/50"
                                        )}
                                    >
                                        <Icon className="size-5" />
                                        <span className="font-medium">{platform.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Platform Specific Options */}
                    {formData.platform === 'YOUTUBE' && (
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                            <label className="text-sm font-medium">Content Type</label>
                            <div className="flex flex-wrap gap-2">
                                {['VIDEO', 'SHORT', 'PLAYLIST'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFormData({
                                            ...formData,
                                            metadata: { ...formData.metadata, postType: type }
                                        })}
                                        className={cn(
                                            "rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                                            (formData.metadata.postType === type || (!formData.metadata.postType && type === 'VIDEO'))
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border bg-background hover:bg-muted"
                                        )}
                                    >
                                        {type === 'VIDEO' ? 'Standard Video' : type === 'SHORT' ? 'YouTube Short' : 'Playlist'}
                                    </button>
                                ))}
                            </div>

                            {formData.metadata.postType === 'PLAYLIST' && (
                                <div className="space-y-3 pt-2">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="playlistAction"
                                                checked={formData.metadata.playlistAction !== 'ADD_TO'}
                                                onChange={() => setFormData({
                                                    ...formData,
                                                    metadata: { ...formData.metadata, playlistAction: 'CREATE' }
                                                })}
                                            />
                                            Create New Playlist
                                        </label>
                                    </div>
                                    <Input
                                        placeholder="New Playlist Title"
                                        value={formData.metadata.playlistTitle || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            metadata: { ...formData.metadata, playlistTitle: e.target.value }
                                        })}
                                    />
                                </div>
                            )}

                            {/* Extra YouTube Fields */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Privacy Status</label>
                                    <div className="border rounded-md">
                                        <select
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            value={formData.metadata.youtubePrivacy || 'public'}
                                            onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, youtubePrivacy: e.target.value } })}
                                        >
                                            <option value="public">Public</option>
                                            <option value="unlisted">Unlisted</option>
                                            <option value="private">Private</option>
                                        </select></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tags (comma separated)</label>
                                    <Input
                                        placeholder="e.g. tutorial, vlog"
                                        value={formData.metadata.youtubeTags || ''}
                                        onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, youtubeTags: e.target.value } })}
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-sm font-medium">Custom Thumbnail</label>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById('thumbnail-upload')?.click()}
                                            disabled={isUploading}
                                            className="gap-2 w-full"
                                        >
                                            {isUploading ? `Uploading... ${uploadProgress > 0 ? `${uploadProgress.toFixed(0)}%` : ''}` : "Upload Thumbnail"}
                                        </Button>
                                        <input
                                            id="thumbnail-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailUpload}
                                            className="hidden"
                                        />
                                    </div>
                                    {formData.metadata.thumbnailUrl && (
                                        <div className="relative aspect-video w-32 overflow-hidden rounded border bg-muted">
                                            <Image src={getMediaPreviewUrl(formData.metadata.thumbnailUrl)} alt="Thumbnail" fill className="object-cover" unoptimized />
                                            <button
                                                onClick={() => setFormData({ ...formData, metadata: { ...formData.metadata, thumbnailUrl: null } })}
                                                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Facebook & Instagram Specific Options */}
                    {(formData.platform === 'FACEBOOK' || formData.platform === 'INSTAGRAM') && (
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                            <label className="text-sm font-medium">Content Type</label>
                            <div className="flex flex-wrap gap-2">
                                {['POST', 'REEL'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFormData({
                                            ...formData,
                                            metadata: { ...formData.metadata, postType: type }
                                        })}
                                        className={cn(
                                            "rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                                            (formData.metadata.postType === type || (!formData.metadata.postType && type === 'POST'))
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border bg-background hover:bg-muted"
                                        )}
                                    >
                                        {type === 'POST' ? 'Standard Post' : 'Reel / Short Video'}
                                    </button>
                                ))}
                            </div>

                            {formData.metadata.postType === 'REEL' && (
                                <div className="space-y-2 pt-2">
                                    <label className="text-sm font-medium">Cover Image (Optional)</label>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById('cover-upload')?.click()}
                                            disabled={isUploading}
                                            className="gap-2 w-full"
                                        >
                                            {isUploading ? `Uploading... ${uploadProgress > 0 ? `${uploadProgress.toFixed(0)}%` : ''}` : "Upload Cover"}
                                        </Button>
                                        <input
                                            id="cover-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailUpload}
                                            className="hidden"
                                        />
                                    </div>
                                    {formData.metadata.thumbnailUrl && (
                                        <div className="relative aspect-[9/16] w-20 overflow-hidden rounded border bg-muted">
                                            <Image src={getMediaPreviewUrl(formData.metadata.thumbnailUrl)} alt="Cover" fill className="object-cover" unoptimized />
                                            <button
                                                onClick={() => setFormData({ ...formData, metadata: { ...formData.metadata, thumbnailUrl: null } })}
                                                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pinterest Specific Options */}
                    {formData.platform === 'PINTEREST' && (
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Destination Link</label>
                                <Input
                                    placeholder="https://example.com/product"
                                    value={formData.metadata.destinationLink || ''}
                                    onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, destinationLink: e.target.value } })}
                                />
                                <p className="text-xs text-muted-foreground">The URL people go to when they click your Pin</p>
                            </div>
                        </div>
                    )}

                    {/* Email Specific Options */}
                    {formData.platform === 'EMAIL' && (
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Pre-header Text</label>
                                <Input
                                    placeholder="Summary text shown after the subject line..."
                                    value={formData.metadata.preheader || ''}
                                    onChange={(e) => setFormData({ ...formData, metadata: { ...formData.metadata, preheader: e.target.value } })}
                                />
                                <p className="text-xs text-muted-foreground">Short summary text shown in the inbox listing</p>
                            </div>
                        </div>
                    )}

                    {/* Media Upload Section */}
                    {formData.platform !== '' && formData.platform.toUpperCase() !== 'SMS' && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Upload Media (Optional)</label>
                            <div className="space-y-3">
                                {/* Upload Button */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => document.getElementById('media-upload')?.click()}
                                        disabled={isUploading}
                                        className="gap-2"
                                    >

                                        {isUploading ? (
                                            <>
                                                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                Uploading... {uploadProgress > 0 ? `${uploadProgress.toFixed(0)}%` : ''}
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="size-4" />
                                                Upload Images/Videos
                                            </>
                                        )}
                                    </Button>
                                    <input
                                        id="media-upload"
                                        type="file"
                                        accept="image/*,video/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Images and videos can be changed when creating posts
                                    </p>
                                </div>

                                {/* Media Previews */}
                                {formData.mediaUrls.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {formData.mediaUrls.map((url, index) => {
                                            const isVideoUrl = isVideo(url);
                                            return (
                                                <div key={index} className="group relative size-20 overflow-hidden rounded-md border bg-muted">
                                                    {isVideoUrl ? (
                                                        isYouTube(url) ? (
                                                            <div className="relative size-full">
                                                                <Image
                                                                    src={`https://i.ytimg.com/vi/${getYouTubeId(url) || 'default'}/hqdefault.jpg`}
                                                                    alt={`YouTube ${index + 1}`}
                                                                    fill
                                                                    className="object-cover"
                                                                    unoptimized
                                                                />
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                                    <Youtube className="size-6 text-white" />
                                                                </div>
                                                            </div>
                                                        ) : isPinterest(url) ? (
                                                            <div className="flex size-full items-center justify-center bg-gray-100">
                                                                <Pin className="size-6 text-red-600" />
                                                            </div>
                                                        ) : (
                                                            <video
                                                                src={getMediaPreviewUrl(url)}
                                                                className="size-full object-cover"
                                                                preload="metadata"
                                                            />
                                                        )
                                                    ) : (
                                                        <Image
                                                            src={getMediaPreviewUrl(url)}
                                                            alt={`Upload ${index + 1}`}
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    )}
                                                    <button
                                                        onClick={() => removeImage(index)}
                                                        className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Subject/Title (conditional) */}
                    {showSubjectField && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {formData.platform === 'YOUTUBE' ? 'Video Title' : formData.platform === 'EMAIL' ? 'Email Subject' : 'Post Title'}
                            </label>
                            <Input
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                placeholder={`Enter ${formData.platform === 'YOUTUBE' ? 'video title' : formData.platform === 'EMAIL' ? 'email subject' : 'post title'}`}
                                className="text-base"
                            />
                        </div>
                    )}

                    {/* Live Preview Header */}
                    <div className="pt-4">
                        <h3 className="mb-2 text-sm font-medium">Live Preview</h3>
                        <p className="text-xs text-muted-foreground">
                            Type directly in the preview to see how your content will appear on {formData.platform}
                        </p>
                    </div>

                    {/* Platform-Specific Preview */}
                    <div className="rounded-lg border-2 bg-muted/30 p-6">
                        <div className="mx-auto max-w-2xl">
                            {renderPlatformPreview()}

                            <p className="mt-4 text-center text-xs text-muted-foreground">
                                💡 Use variables like <code className="rounded bg-muted px-1 py-0.5">{`{{firstName}}`}</code> or <code className="rounded bg-muted px-1 py-0.5">{`{{companyName}}`}</code> to personalize
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end mb-2 mx-5 gap-2">
                <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isSaving}>
                    {isSaving ? "Creating..." : "Create Template"}
                </Button>
            </div>
        </div >
    );
}
