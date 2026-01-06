"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, Loader2, FileEdit, Mail, MessageSquare, Facebook, Instagram, Linkedin, Youtube, Twitter, Image as ImageIcon, Send, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, ThumbsUp, Repeat2, Upload, X, Pin, Phone } from "lucide-react";
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

export default function EditTemplatePage() {
    const router = useRouter();
    const params = useParams();
    const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        name: "",
        subject: "",
        content: "",
        platform: "FACEBOOK",
        category: "CUSTOM",
        isActive: true,
        mediaUrls: [] as string[],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        fetchConnectedPlatforms();
        fetchTemplate();
    }, [params.id]);

    const fetchConnectedPlatforms = async () => {
        try {
            const res = await fetch("/api/Organisation/GetPlatforms");
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.platforms) {
                    setConnectedPlatforms(data.platforms);
                }
            }
        } catch (error) {
            console.error("Failed to fetch connected platforms", error);
        }
    };

    // Filter platforms to only show connected ones
    const PLATFORMS = ALL_PLATFORMS.filter(p => connectedPlatforms.includes(p.value));

    const fetchTemplate = async () => {
        try {
            const response = await fetch(`/api/templates/${params.id}`);
            const data = await response.json();

            if (data.success) {
                setFormData({
                    name: data.data.name,
                    subject: data.data.subject || "",
                    content: data.data.content,
                    platform: data.data.platform,
                    category: data.data.category,
                    isActive: data.data.isActive,
                    mediaUrls: data.data.mediaUrls || [],
                });
            } else {
                toast.error("Failed to load template");
                router.push("/organisation/templates");
            }
        } catch (error) {
            console.error("Error fetching template:", error);
            toast.error("Failed to load template");
        } finally {
            setIsLoading(false);
        }
    };

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
                const formDataUpload = new FormData();
                formDataUpload.append('file', file);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formDataUpload,
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

            toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
        } catch (error) {
            console.error('Error uploading images:', error);
            toast.error('Failed to upload images');
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

    const handleUpdate = async () => {
        try {
            if (!formData.name) {
                toast.error("Template name is required");
                return;
            }
            if (!formData.content) {
                toast.error("Template content is required");
                return;
            }

            setIsSaving(true);
            const response = await fetch(`/api/templates/${params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Template updated successfully");
                router.push("/organisation/templates");
            } else {
                toast.error(data.error || "Failed to update template");
            }
        } catch (error) {
            console.error("Error updating template:", error);
            toast.error("Failed to update template");
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

                            {/* Image Placeholder */}
                            <div className="mb-3 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                                <div className="text-center">
                                    <ImageIcon className="mx-auto size-12 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                </div>
                            </div>

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
                        <div className="border-b p-3">
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

                        {/* Image Placeholder */}
                        <div className="flex aspect-square items-center justify-center border-b bg-gray-50">
                            <div className="text-center">
                                <ImageIcon className="mx-auto size-16 text-gray-400" />
                                <p className="mt-2 text-sm text-gray-500">Image preview</p>
                            </div>
                        </div>

                        <div className="p-3">
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

            case "TWITTER":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        <div className="p-4">
                            <div className="mb-3 flex gap-3">
                                <div className="flex size-12 items-center justify-center rounded-full bg-blue-100">
                                    <span className="text-sm font-semibold text-blue-600">YB</span>
                                </div>
                                <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-1">
                                        <span className="font-bold text-gray-900">Your Brand</span>
                                        <span className="text-gray-500">@yourbrand · 1m</span>
                                    </div>

                                    <textarea
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        placeholder="What's happening?"
                                        className="mb-3 w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                        style={{ whiteSpace: 'pre-wrap', minHeight: '80px' }}
                                    />

                                    {/* Image Placeholder */}
                                    <div className="mb-3 flex items-center justify-center rounded-2xl border border-gray-300 bg-gray-50 p-12">
                                        <div className="text-center">
                                            <ImageIcon className="mx-auto size-12 text-gray-400" />
                                            <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-12 text-gray-500">
                                        <div className="flex items-center gap-2 text-sm">
                                            <MessageCircle className="size-4" /> <span>0</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Repeat2 className="size-4" /> <span>0</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Heart className="size-4" /> <span>0</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Share2 className="size-4" /> <span>0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "LINKEDIN":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        <div className="p-4">
                            <div className="mb-3 flex items-start gap-3">
                                <div className="flex size-12 items-center justify-center rounded-full bg-blue-700">
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
                                style={{ whiteSpace: 'pre-wrap', minHeight: '100px' }}
                            />

                            {/* Image Placeholder */}
                            <div className="mb-3 flex items-center justify-center rounded border border-gray-300 bg-gray-50 p-12">
                                <div className="text-center">
                                    <ImageIcon className="mx-auto size-12 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                </div>
                            </div>

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
                        {/* Video Thumbnail Placeholder */}
                        <div className="relative flex aspect-video items-center justify-center bg-black">
                            <div className="text-center">
                                <ImageIcon className="mx-auto size-16 text-gray-400" />
                                <p className="mt-2 text-sm text-gray-400">Video thumbnail</p>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex size-16 items-center justify-center rounded-full bg-red-600">
                                    <div className="ml-1 size-0 border-y-8 border-l-12 border-y-transparent border-l-white"></div>
                                </div>
                            </div>
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
                                    className="mb-2 w-full border-0 bg-transparent p-0 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
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

                            {/* Image Placeholder */}
                            <div className="mt-4 flex items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                                <div className="text-center">
                                    <ImageIcon className="mx-auto size-12 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">Image preview</p>
                                </div>
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
                        <div className="rounded-2xl bg-white shadow-md overflow-hidden" style={{ width: '236px' }}>
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

            default:
                return null;
        }
    };

    const showSubjectField = ["EMAIL", "FACEBOOK", "LINKEDIN", "YOUTUBE", "PINTEREST"].includes(formData.platform);

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="space-y-3 text-center">
                    <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading template...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6  mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => router.back()}>
                        <ChevronLeft className="size-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <FileEdit className="size-5 text-primary" />
                        <div>
                            <h1 className="text-lg font-semibold">Edit Template</h1>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">ID: {params.id}</p>
                                <Badge variant="secondary" className="text-xs">{formData.platform}</Badge>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpdate} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
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

                    {/* Image Upload Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Upload Images (Optional)</label>
                        <div className="space-y-3">
                            {/* Upload Button */}
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => document.getElementById('image-upload')?.click()}
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
                                            Upload Images
                                        </>
                                    )}
                                </Button>
                                <input
                                    id="image-upload"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Images can be changed when creating posts
                                </p>
                            </div>

                            {/* Image Previews */}
                            {formData.mediaUrls.length > 0 && (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                    {formData.mediaUrls.map((url, index) => (
                                        <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                                            <Image
                                                src={url}
                                                alt={`Upload ${index + 1}`}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                            <button
                                                onClick={() => removeImage(index)}
                                                className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </div>
                                    ))}
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
        </div>
    );
}
