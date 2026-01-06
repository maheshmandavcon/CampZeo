"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronLeft, Sparkles, Mail, MessageSquare, Facebook, Instagram, Linkedin, Youtube, Twitter, Image as ImageIcon, Send, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, ThumbsUp, Repeat2, Upload, X, Phone, Pin, MoreVertical } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

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
    const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(true);
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
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
        // Reset subject and content when platform changes
        setFormData({
            ...formData,
            platform: newPlatform,
            subject: "",
            content: "",
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const uploadedUrls: string[] = [];

            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/socialmedia/upload-media-file', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();
                if (data.url) {
                    uploadedUrls.push(data.url);
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
        }
    };

    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const file = files[0];
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/socialmedia/upload-media-file', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.url) {
                setFormData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, thumbnailUrl: data.url }
                }));
                toast.success('Thumbnail uploaded successfully');
            }
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            toast.error('Failed to upload thumbnail');
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            mediaUrls: prev.mediaUrls.filter((_, i) => i !== index)
        }));
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
        switch (formData.platform) {
            case "FACEBOOK":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        <div className="p-4">
                            <div className="mb-3 flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
                                    <span className="text-sm font-semibold text-blue-600">YB</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">Your Brand</p>
                                    <p className="text-xs text-gray-500">Just now · 🌎</p>
                                </div>
                                <button className="text-gray-500 hover:bg-gray-100 rounded-full p-1">
                                    <MoreHorizontal className="size-5" />
                                </button>
                            </div>

                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="What's on your mind?"
                                className="mb-3 w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                style={{ whiteSpace: 'pre-wrap', minHeight: '100px', padding: "10px" }}
                            />

                            {/* Image Preview */}
                            {formData.mediaUrls.length > 0 ? (
                                <div className="mb-3">
                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-gray-100">
                                        <Image
                                            src={formData.mediaUrls[0]}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                    {formData.mediaUrls.length > 1 && (
                                        <div className="mt-1 text-xs text-gray-500">
                                            +{formData.mediaUrls.length - 1} more photos
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mb-3 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                                    <div className="text-center">
                                        <ImageIcon className="mx-auto size-12 text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between border-t pt-2">
                                <div className="flex gap-1 text-sm text-gray-500">
                                    <ThumbsUp className="size-4" /> <span>Like</span>
                                </div>
                                <div className="flex gap-1 text-sm text-gray-500">
                                    <MessageCircle className="size-4" /> <span>Comment</span>
                                </div>
                                <div className="flex gap-1 text-sm text-gray-500">
                                    <Share2 className="size-4" /> <span>Share</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "INSTAGRAM":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        <div className="border-b p-3" style={{ padding: "10px" }}>
                            <div className="flex items-center gap-3">
                                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                                    <span className="text-xs font-semibold text-white">YB</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">yourbrand</p>
                                </div>
                                <button className="text-gray-900">
                                    <MoreHorizontal className="size-5" />
                                </button>
                            </div>
                        </div>

                        {/* Image Preview */}
                        {formData.mediaUrls.length > 0 ? (
                            <div className="relative flex aspect-square w-full items-center justify-center bg-black">
                                <Image
                                    src={formData.mediaUrls[0]}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                                {formData.mediaUrls.length > 1 && (
                                    <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                                        1/{formData.mediaUrls.length}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex aspect-square items-center justify-center border-b bg-gray-50">
                                <div className="text-center">
                                    <ImageIcon className="mx-auto size-16 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                </div>
                            </div>
                        )}

                        <div className="p-3" style={{ padding: "10px" }}>
                            <div className="mb-3 flex items-center gap-4">
                                <Heart className="size-6 text-gray-900" />
                                <MessageCircle className="size-6 text-gray-900" />
                                <Send className="size-6 text-gray-900" />
                                <Bookmark className="ml-auto size-6 text-gray-900" />
                            </div>

                            <div className="text-sm">
                                <span className="font-semibold text-gray-900">yourbrand</span>{" "}
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Write a caption..."
                                    className="w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                    style={{ whiteSpace: 'pre-wrap', minHeight: '60px' }}
                                />
                            </div>
                        </div>
                    </div>
                );


            case "LINKEDIN":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        <div className="p-4">
                            <div className="mb-3 flex items-start gap-3">
                                <div className="flex size-12 items-center justify-center rounded-full " style={{ backgroundColor: "grey" }}>
                                    <span className="text-sm font-semibold text-white">YB</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">Your Brand</p>
                                    <p className="text-xs text-gray-500">Company · 1m</p>
                                </div>
                                <button className="text-gray-500">
                                    <MoreHorizontal className="size-5" />
                                </button>
                            </div>

                            {formData.subject && (
                                <h3 className="mb-2 text-lg font-semibold text-gray-900">{formData.subject}</h3>
                            )}

                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Share your thoughts..."
                                className="mb-3 w-full resize-none border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                style={{ whiteSpace: 'pre-wrap', minHeight: '100px', padding: "10px" }}
                            />

                            {/* Image Preview */}
                            {formData.mediaUrls.length > 0 ? (
                                <div className="mb-3">
                                    <div className="relative aspect-video w-full overflow-hidden rounded border bg-gray-100">
                                        <Image
                                            src={formData.mediaUrls[0]}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-3 flex items-center justify-center rounded border border-gray-300 bg-gray-50 p-12">
                                    <div className="text-center">
                                        <ImageIcon className="mx-auto size-12 text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 border-t pt-2 text-sm text-gray-600">
                                <button className="flex items-center gap-1 hover:bg-gray-100 rounded px-3 py-1">
                                    <ThumbsUp className="size-4" /> Like
                                </button>
                                <button className="flex items-center gap-1 hover:bg-gray-100 rounded px-3 py-1">
                                    <MessageCircle className="size-4" /> Comment
                                </button>
                                <button className="flex items-center gap-1 hover:bg-gray-100 rounded px-3 py-1">
                                    <Share2 className="size-4" /> Share
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case "YOUTUBE":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        {/* Video Thumbnail Preview */}
                        <div className={cn(
                            "relative flex items-center justify-center bg-black overflow-hidden",
                            formData.metadata?.postType === 'SHORT' ? "aspect-[9/16] mx-auto w-1/2" : "aspect-video"
                        )}>
                            {isPlayingVideo && formData.mediaUrls.length > 0 && formData.mediaUrls[0].match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                // Show video player when playing
                                <video
                                    src={formData.mediaUrls[0]}
                                    className="size-full object-cover"
                                    controls
                                    autoPlay
                                    onEnded={() => setIsPlayingVideo(false)}
                                />
                            ) : (
                                <>
                                    {formData.metadata?.thumbnailUrl ? (
                                        <Image
                                            src={formData.metadata.thumbnailUrl}
                                            alt="Thumbnail"
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : formData.mediaUrls.length > 0 ? (
                                        formData.mediaUrls[0].match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                            <video
                                                src={formData.mediaUrls[0]}
                                                className="size-full object-cover opacity-80"
                                                preload="metadata"
                                            />
                                        ) : (
                                            <Image
                                                src={formData.mediaUrls[0]}
                                                alt="Preview"
                                                fill
                                                className="object-cover opacity-80"
                                                unoptimized
                                            />
                                        )
                                    ) : (
                                        <div className="text-center">
                                            <ImageIcon className="mx-auto size-16 text-gray-400" />
                                            <p className="mt-2 text-sm text-gray-400">Video thumbnail</p>
                                        </div>
                                    )}

                                    {/* Play Button Overlay */}
                                    <button
                                        onClick={() => setIsPlayingVideo(true)}
                                        disabled={!formData.mediaUrls.length || !formData.mediaUrls[0].match(/\.(mp4|webm|ogg|mov)$/i)}
                                        className="absolute inset-0 flex items-center justify-center disabled:cursor-not-allowed"
                                    >
                                        <div className="flex size-16 items-center justify-center rounded-full bg-red-600/90 shadow-lg backdrop-blur-sm transition-transform hover:scale-110 disabled:opacity-50">
                                            <div className="ml-1 size-0 border-y-8 border-l-12 border-y-transparent border-l-white"></div>
                                        </div>
                                    </button>

                                    {formData.metadata?.postType === 'SHORT' && (
                                        <div className="absolute bottom-4 right-4 animate-bounce">
                                            <div className="rounded-full bg-white/20 p-2 backdrop-blur-md">
                                                <span className="text-white text-xs font-bold">Shorts</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="p-4">
                            {formData.subject ? (
                                <h3 className="mb-2 text-base font-semibold text-gray-900">{formData.subject}</h3>
                            ) : (
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="Video title..."
                                    className="mb-2 w-full border-0 bg-transparent p-0 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0" style={{ padding: "10px" }}
                                />
                            )}

                            <div className="mb-3 flex items-center gap-2">
                                <div className="flex size-9 items-center justify-center rounded-full bg-red-100">
                                    <span className="text-xs font-semibold text-red-600">YB</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Your Brand</p>
                                    <p className="text-xs text-gray-500">1K subscribers</p>
                                </div>
                            </div>

                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Video description..."
                                className="w-full resize-none border-0 bg-transparent p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                style={{ whiteSpace: 'pre-wrap', minHeight: '80px' }}
                            />
                        </div>
                    </div>
                );

            case "EMAIL":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        <div className="border-b bg-gray-50 p-4">
                            <div className="mb-2 text-xs text-gray-500">
                                <span className="font-medium">From:</span> your.brand@company.com
                            </div>
                            <div className="mb-2 text-xs text-gray-500">
                                <span className="font-medium">To:</span> customer@example.com
                            </div>
                            <div className="text-sm">
                                <span className="font-medium text-gray-700">Subject:</span>{" "}
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="Email subject..."
                                    className="w-full border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                />
                            </div>
                        </div>

                        <div className="p-6">
                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Email body..."
                                className="w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                style={{ whiteSpace: 'pre-wrap', minHeight: '200px' }}
                            />

                            {/* Image Preview */}
                            {formData.mediaUrls.length > 0 ? (
                                <div className="mt-4">
                                    <div className="relative aspect-video w-full overflow-hidden rounded border bg-gray-100">
                                        <Image
                                            src={formData.mediaUrls[0]}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4 flex items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                                    <div className="text-center">
                                        <ImageIcon className="mx-auto size-12 text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case "WHATSAPP":
                return (
                    <div className="mx-auto max-w-sm">
                        <div className="rounded-2xl bg-[#e5ddd5] p-4 shadow-sm" style={{ minHeight: '300px' }}>
                            <div className="flex flex-col gap-2">
                                <div className="self-start rounded-lg bg-white p-3 shadow-sm rounded-tl-none">
                                    <p className="text-xs font-bold text-red-500 mb-1">Your Business</p>

                                    {/* Image Preview */}
                                    {formData.mediaUrls.length > 0 && (
                                        <div className="mb-2 relative aspect-video w-full max-w-[240px] overflow-hidden rounded-lg">
                                            <Image
                                                src={formData.mediaUrls[0]}
                                                alt="Preview"
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    )}

                                    <textarea
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        placeholder="Type your WhatsApp message..."
                                        className="w-full resize-none border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                        style={{ whiteSpace: 'pre-wrap', minWidth: '200px' }}
                                    />
                                    <div className="mt-1 flex justify-end gap-1 text-[10px] text-gray-500">
                                        <span>12:00 PM</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "PINTEREST":
                return (
                    <div className="mx-auto max-w-sm">
                        <div className="rounded-2xl bg-white shadow-md overflow-hidden" style={{ width: '236px' }}> {/* Typical Pinterest column width */}
                            {/* Image Preview - Pinterest is image first */}
                            <div className="relative w-full bg-gray-100" style={{ minHeight: '300px' }}>
                                {formData.mediaUrls.length > 0 ? (
                                    <Image
                                        src={formData.mediaUrls[0]}
                                        alt="Pin Preview"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
                                        <Pin className="mb-2 size-8 text-red-600" />
                                        <p className="text-xs text-gray-400">Upload an image to see preview</p>
                                    </div>
                                )}
                                <div className="absolute right-2 top-2 rounded-full bg-white p-2 shadow-sm opacity-0 hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="size-4 text-gray-700" />
                                </div>
                            </div>

                            <div className="p-3">
                                {formData.subject ? (
                                    <h3 className="mb-1 text-sm font-bold text-gray-900 leading-tight">{formData.subject}</h3>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        placeholder="Add a title"
                                        className="w-full font-bold text-sm border-none p-0 placeholder:text-gray-400 focus:ring-0 mb-1"
                                    />
                                )}

                                <div className="flex items-center gap-2 mb-2">
                                    <div className="size-6 rounded-full bg-gray-200 overflow-hidden relative">
                                        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">YB</div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">Your Brand</span>
                                </div>

                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Add a detailed description..."
                                    className="w-full resize-none border-0 bg-transparent p-0 text-xs text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                    style={{ whiteSpace: 'pre-wrap', minHeight: '40px' }}
                                />
                            </div>
                        </div>
                    </div>
                );

            case "SMS":
                return (
                    <div className="mx-auto max-w-sm">
                        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-1">
                            <div className="rounded-2xl bg-white p-4">
                                <div className="mb-2 text-xs text-gray-500">SMS Message</div>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Type your SMS message..."
                                    className="w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                    style={{ whiteSpace: 'pre-wrap', minHeight: '100px' }}
                                />
                                <div className="mt-2 text-right text-xs text-gray-500">
                                    {formData.content.length} / 160 characters
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
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
                                            {isUploading ? "Uploading..." : "Upload Thumbnail"}
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
                                            <Image src={formData.metadata.thumbnailUrl} alt="Thumbnail" fill className="object-cover" unoptimized />
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
                                            {isUploading ? "Uploading..." : "Upload Cover"}
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
                                            <Image src={formData.metadata.thumbnailUrl} alt="Cover" fill className="object-cover" unoptimized />
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
                                            Uploading...
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
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                    {formData.mediaUrls.map((url, index) => {
                                        const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
                                        return (
                                            <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                                                {isVideo ? (
                                                    <video
                                                        src={url}
                                                        className="size-full object-cover"
                                                        controls
                                                        preload="metadata"
                                                    />
                                                ) : (
                                                    <Image
                                                        src={url}
                                                        alt={`Upload ${index + 1}`}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />
                                                )}
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
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
