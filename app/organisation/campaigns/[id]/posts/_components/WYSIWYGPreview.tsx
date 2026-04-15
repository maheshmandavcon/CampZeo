"use client";

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
    Heart,
    MessageCircle,
    Send,
    Bookmark,
    MoreHorizontal,
    ThumbsUp,
    Share2,
    ImageIcon,
    Repeat2,
    Play,
    Video,
    ChevronLeft,
    ChevronRight,
    FileText,
    FileSpreadsheet,
    File,
    Download,
    ExternalLink,
    Eye,
    FileIcon,
    FileQuestion
} from 'lucide-react';
import { isVideoUrl, isImageUrl, isDocumentUrl, getMediaPreviewUrl as getPreviewUrl } from '@/lib/media-utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface WYSIWYGPreviewProps {
    platform: string;
    subject: string;
    message: string;
    mediaUrls: string[];
    thumbnailUrl?: string | null;
    isReel?: boolean;
    onSubjectChange: (value: string) => void;
    onMessageChange: (value: string) => void;
    user?: {
        name?: string;
        image?: string;
    } | null;
}

export function WYSIWYGPreview({
    platform,
    subject,
    message,
    mediaUrls,
    thumbnailUrl,
    isReel,
    onSubjectChange,
    onMessageChange,
    user
}: WYSIWYGPreviewProps) {
    const [isPlayingVideo, setIsPlayingVideo] = React.useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = React.useState(0);
    const [selectedFile, setSelectedFile] = React.useState<string | null>(null);

    // Reset slide index when media or platform changes
    React.useEffect(() => {
        setCurrentSlideIndex(0);
    }, [mediaUrls, platform]);

    const getFileIcon = (url: string) => {
        const ext = url.split('.').pop()?.split('?')[0].toLowerCase() || '';
        if (['csv', 'xlsx', 'xls'].includes(ext)) return <FileSpreadsheet className="size-10 text-green-600" />;
        if (ext === 'pdf') return <FileText className="size-10 text-red-500" />;
        if (['doc', 'docx'].includes(ext)) return <FileText className="size-10 text-blue-600" />;
        return <File className="size-10 text-gray-500" />;
    };

    const getFileName = (url: string) => {
        try {
            const decoded = decodeURIComponent(url);
            if (decoded.includes('google-drive/view') && decoded.includes('#')) {
                return decoded.split('#').pop() || 'Attachment';
            }
            return decoded.split('/').pop()?.split('?')[0] || 'Attachment';
        } catch {
            return 'Attachment';
        }
    };

    const userName = user?.name || "Your Brand";
    const userImage = user?.image;
    const userInitials = userName.substring(0, 2).toUpperCase();

    const renderMediaGallery = () => {
        if (mediaUrls.length === 0) {
            return (
                <div className="mb-3 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                    <div className="text-center">
                        <ImageIcon className="mx-auto size-12 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500">Media preview</p>
                    </div>
                </div>
            );
        }

        const renderMediaItem = (url: string, className?: string) => {
            const isVid = isVideoUrl(url);
            const isImg = isImageUrl(url);
            const isDoc = isDocumentUrl(url);
            const previewUrl = getPreviewUrl(url);

            return (
                <div
                    className={cn(
                        "relative overflow-hidden bg-muted/20 cursor-pointer group/media",
                        className
                    )}
                    onClick={() => {
                        if (isDoc || isVid || !isImg) {
                            setSelectedFile(url);
                        }
                    }}
                >
                    {isVid ? (
                        <video
                            src={previewUrl}
                            className="size-full object-fill"
                            autoPlay
                            muted
                            loop
                            playsInline
                        />
                    ) : isImg ? (
                        <Image
                            src={previewUrl}
                            alt="Preview"
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-2 bg-gray-50 p-4">
                            {getFileIcon(url)}
                            <p className="max-w-full truncate text-[10px] font-medium text-gray-600 px-2">
                                {getFileName(url)}
                            </p>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/media:bg-black/5 transition-colors">
                                <Eye className="size-5 text-gray-400 opacity-0 group-hover/media:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    )}
                    {isVid && (
                        <div className="absolute top-2 right-2 opacity-50">
                            <Video className="size-4 text-white" />
                        </div>
                    )}
                </div>
            );
        };

        // Platform specific layout logic
        if (platform === "INSTAGRAM" || platform === "PINTEREST") {
            const isInstagram = platform === "INSTAGRAM";
            const isPinterest = platform === "PINTEREST";

            // Standard Instagram Feed usually allows 1:1 or 4:5.
            // Reels MUST be 9:16.
            let containerClass = "relative w-full overflow-hidden bg-black group";

            if (isReel) {
                containerClass = cn(containerClass, "aspect-[9/16] rounded-2xl max-w-[340px] mx-auto shadow-2xl");
            } else if (isInstagram) {
                containerClass = cn(containerClass, "aspect-[4/5]");
            } else if (isPinterest) {
                containerClass = cn(containerClass, "aspect-[2/3] rounded-2xl");
            }

            const nextSlide = () => {
                setCurrentSlideIndex((prev) => (prev + 1) % mediaUrls.length);
            };

            const prevSlide = () => {
                setCurrentSlideIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
            };

            return (
                <div className={containerClass}>
                    <div
                        className="flex h-full transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}
                    >
                        {mediaUrls.map((url, idx) => (
                            <div key={idx} className="min-w-full h-full relative">
                                {renderMediaItem(url, "h-full w-full")}
                                <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm shadow-md">
                                    {idx + 1}/{mediaUrls.length}
                                </div>
                            </div>
                        ))}
                    </div>

                    {mediaUrls.length > 1 && (
                        <>
                            {/* Navigation Arrows */}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border bg-white p-1.5 text-white backdrop-blur-md transition-all hover:bg-white/40   shadow-sm"
                            >
                                <ChevronLeft className="size-4 text-black " />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border bg-white p-1.5 text-white backdrop-blur-md transition-all hover:bg-white/40   shadow-sm"
                            >
                                <ChevronRight className="size-4  text-black " />
                            </button>

                            {/* Pagination Dots */}
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                {mediaUrls.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "size-1.5 rounded-full transition-all duration-300 shadow-sm",
                                            currentSlideIndex === idx ? "bg-white w-3" : "bg-white/40"
                                        )}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            );
        }

        if (platform === "FACEBOOK" || platform === "LINKEDIN" || platform === "WHATSAPP") {
            const count = mediaUrls.length;
            if (count === 1) return renderMediaItem(mediaUrls[0], "aspect-video rounded-lg border");

            if (count === 2) {
                return (
                    <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
                        {renderMediaItem(mediaUrls[0], "aspect-square")}
                        {renderMediaItem(mediaUrls[1], "aspect-square")}
                    </div>
                );
            }

            if (count === 3) {
                return (
                    <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
                        {renderMediaItem(mediaUrls[0], "col-span-2 aspect-video")}
                        {renderMediaItem(mediaUrls[1], "aspect-square")}
                        {renderMediaItem(mediaUrls[2], "aspect-square")}
                    </div>
                );
            }

            // 4+ media
            return (
                <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
                    {renderMediaItem(mediaUrls[0], "aspect-square")}
                    {renderMediaItem(mediaUrls[1], "aspect-square")}
                    {renderMediaItem(mediaUrls[2], "aspect-square")}
                    <div className="relative aspect-square">
                        {renderMediaItem(mediaUrls[3], "size-full")}
                        {count > 4 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                                <span className="text-xl font-bold text-white">+{count - 4}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (platform === "EMAIL") {
            return (
                <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        {mediaUrls.map((url, idx) => (
                            <div key={idx} className="space-y-1">
                                {renderMediaItem(url, "aspect-video rounded border")}
                                <p className="text-[10px] text-gray-500 truncate px-1">Attachment {idx + 1}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (platform === "PINTEREST") {
            // Handled in the combined INSTAGRAM/PINTEREST block above for multi-media
            return null;
        }

        if (platform === "YOUTUBE") {
            const videoUrl = mediaUrls[0];
            const isYouTubeUrl = videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be');

            // Extract Video ID for iframe if it's a YouTube URL
            let embedUrl = videoUrl;
            if (isYouTubeUrl) {
                let videoId = '';
                if (videoUrl.includes('v=')) {
                    videoId = videoUrl.split('v=')[1].split('&')[0];
                } else if (videoUrl.includes('youtu.be/')) {
                    videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
                } else if (videoUrl.includes('embed/')) {
                    videoId = videoUrl.split('embed/')[1].split('?')[0];
                }

                if (videoId) {
                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
                }
            }

            return (
                <div className={cn(
                    "relative flex items-center justify-center bg-black overflow-hidden",
                    isReel ? "aspect-[9/16] mx-auto w-10/12" : "aspect-video"
                )}>
                    {(isPlayingVideo || isYouTubeUrl) && videoUrl ? (
                        isYouTubeUrl ? (
                            <iframe
                                src={embedUrl}
                                className="size-full border-0"
                                allow="autoplay; encrypted-media"
                                allowFullScreen
                            />
                        ) : (
                            <video
                                src={videoUrl}
                                className="size-full object-fill"
                                controls={!isYouTubeUrl}
                                autoPlay
                                muted
                                onEnded={() => setIsPlayingVideo(false)}
                            />
                        )
                    ) : (
                        <>
                            {thumbnailUrl ? (
                                <Image
                                    src={getPreviewUrl(thumbnailUrl)}
                                    alt="Thumbnail"
                                    fill
                                    className="object-fill"
                                    unoptimized
                                />
                            ) : (
                                renderMediaItem(videoUrl, "size-full opacity-80")
                            )}
                            <button
                                type="button"
                                onClick={() => setIsPlayingVideo(true)}
                                disabled={!mediaUrls.length || (!isYouTubeUrl && !isVideoUrl(videoUrl))}
                                className="absolute cursor-pointer inset-0 flex items-center justify-center disabled:cursor-not-allowed group"
                            >
                                <div className="flex size-14 items-center justify-center rounded-full bg-red-600/90 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110 disabled:opacity-50">
                                    <div className="ml-1 size-0 border-y-8 border-l-12 border-y-transparent border-l-white"></div>
                                </div>
                            </button>
                            {isReel && (
                                <div className="absolute bottom-4 left-4">
                                    <div className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-md">
                                        <span className="text-white text-[10px] font-bold">Shorts</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            );
        }

        return renderMediaItem(mediaUrls[0], "aspect-video rounded-lg");
    };

    const renderPlatformPreview = () => {
        switch (platform) {
            case "FACEBOOK":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-4">
                            <div className="mb-3 flex items-center gap-3">
                                {userImage ? (
                                    <div className="relative size-10 overflow-hidden rounded-full">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
                                        <span className="text-sm font-semibold text-blue-600">{userInitials}</span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{userName}</p>
                                    <p className="text-xs text-gray-500">Just now · 🌎</p>
                                </div>
                                <button type="button" className="text-gray-500 cursor-pointer hover:bg-gray-100 rounded-full p-1">
                                    <MoreHorizontal className="size-5" />
                                </button>
                            </div>

                            <div className="mb-3 text-sm text-gray-900 whitespace-pre-wrap px-1">
                                {message || "What's on your mind?"}
                            </div>

                            <div className="mb-3">
                                {renderMediaGallery()}
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                                <div className="flex gap-1 items-center text-sm font-medium text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded flex-1 justify-center">
                                    <ThumbsUp className="size-4" /> <span>Like</span>
                                </div>
                                <div className="flex gap-1 items-center text-sm font-medium text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded flex-1 justify-center">
                                    <MessageCircle className="size-4" /> <span>Comment</span>
                                </div>
                                <div className="flex gap-1 items-center text-sm font-medium text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded flex-1 justify-center">
                                    <Share2 className="size-4" /> <span>Share</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "INSTAGRAM":
                if (isReel) {
                    return (
                        <div className="rounded-2xl border bg-black shadow-2xl overflow-hidden h-[600px] relative max-w-[340px] mx-auto group">
                            {renderMediaGallery()}

                            {/* Reels Overlay */}
                            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-full border border-white/20 bg-zinc-800" />
                                    <p className="font-semibold text-xs text-white">{userName.toLowerCase().replace(/\s/g, '')}</p>
                                    <button className="h-6 px-3 rounded-md border border-white/50 text-[10px] font-bold text-white bg-transparent">Follow</button>
                                </div>
                                <div className="text-xs text-white line-clamp-2 pr-12">
                                    {message || "Reels description..."}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-300">
                                    <Video className="size-3" />
                                    <span>Original Audio</span>
                                </div>
                            </div>

                            {/* Reels Sidebar */}
                            <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 text-white">
                                <div className="flex flex-col items-center gap-1">
                                    <Heart className="size-8 stroke-[1.5]" />
                                    <span className="text-[10px] font-medium">1.2k</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <MessageCircle className="size-8 stroke-[1.5]" />
                                    <span className="text-[10px] font-medium">84</span>
                                </div>
                                <Send className="size-8 stroke-[1.5]" />
                                <MoreHorizontal className="size-6" />
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-3">
                            <div className="flex items-center gap-3">
                                {userImage ? (
                                    <div className="relative size-8 overflow-hidden rounded-full border border-gray-200">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                                        <span className="text-xs font-semibold text-white">{userInitials}</span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{userName.toLowerCase().replace(/\s/g, '')}</p>
                                </div>
                                <MoreHorizontal className="size-5 text-gray-900" />
                            </div>
                        </div>

                        {renderMediaGallery()}

                        <div className="p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex gap-4">
                                    <Heart className="size-6 text-gray-900" />
                                    <MessageCircle className="size-6 text-gray-900" />
                                    <Send className="size-6 text-gray-900" />
                                </div>
                                <Bookmark className="size-6 text-gray-900" />
                            </div>

                            <div className="text-sm">
                                <span className="font-semibold text-gray-900 mr-2">{userName.toLowerCase().replace(/\s/g, '')}</span>
                                {subject && <span className="font-bold mr-1">{subject}</span>}
                                <span className="text-gray-900 whitespace-pre-wrap">{message || "Write a caption..."}</span>
                            </div>
                        </div>
                    </div>
                );

            case "LINKEDIN":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-4">
                            <div className="mb-3 flex items-start gap-4">
                                {userImage ? (
                                    <div className="relative size-12 overflow-hidden rounded border border-gray-100">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-12 items-center justify-center rounded bg-gray-500">
                                        <span className="text-sm font-semibold text-white">{userInitials}</span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{userName}</p>
                                    <p className="text-[10px] text-gray-500">Social Media Expert · 1m · 🌎</p>
                                </div>
                                <MoreHorizontal className="size-5 text-gray-500" />
                            </div>

                            {subject && (
                                <h3 className="mb-2 text-sm font-semibold text-gray-900">{subject}</h3>
                            )}

                            <div className="mb-3 text-sm text-gray-900 whitespace-pre-wrap">
                                {message || "Share your thoughts..."}
                            </div>

                            <div className="mb-3">
                                {renderMediaGallery()}
                            </div>

                            <div className="flex items-center gap-1 border-t border-gray-100 pt-1 text-gray-600">
                                <div className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded py-2 hover:bg-black/5">
                                    <ThumbsUp className="size-4" /> <span className="text-xs font-semibold">Like</span>
                                </div>
                                <div className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded py-2 hover:bg-black/5">
                                    <MessageCircle className="size-4" /> <span className="text-xs font-semibold">Comment</span>
                                </div>
                                <div className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded py-2 hover:bg-black/5">
                                    <Share2 className="size-4" /> <span className="text-xs font-semibold">Share</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "WHATSAPP":
                return (
                    <div className="mx-auto max-w-[320px] rounded-lg border bg-[#E5DDD5] shadow-sm overflow-hidden">
                        <div className="bg-[#075E54] px-3 py-2 text-white flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-gray-200 overflow-hidden">
                                {userImage ? (
                                    <Image src={userImage} alt={userName} width={32} height={32} className="object-cover size-full" unoptimized />
                                ) : (
                                    <span className="text-xs font-semibold text-gray-600">{userInitials}</span>
                                )}
                            </div>
                            <div className="flex-1 leading-tight">
                                <p className="text-xs font-semibold text-white truncate">{userName}</p>
                                <p className="text-[8px] text-white/80">online</p>
                            </div>
                        </div>
                        <div className="p-2 min-h-[300px] flex flex-col justify-end bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-[length:150px]">
                            <div className="ml-auto w-full max-w-[90%] rounded-lg bg-[#DCF8C6] p-1.5 shadow-sm">
                                {renderMediaGallery()}
                                <div className="mt-1.5 text-xs text-gray-900 whitespace-pre-wrap px-0.5">
                                    {message || "Type a message"}
                                </div>
                                <div className="mt-1 flex items-center justify-end gap-1 px-0.5">
                                    <span className="text-[8px] text-gray-500">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="text-[#34B7F1] text-[10px]">✓✓</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "YOUTUBE":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        {renderMediaGallery()}

                        <div className="p-4">
                            <h3 className="mb-2 text-sm font-semibold text-gray-900 leading-snug">
                                {subject || "Video title goes here"}
                            </h3>

                            <div className="mb-4 flex items-center gap-2">
                                {userImage ? (
                                    <Image src={userImage} alt={userName} width={36} height={36} className="rounded-full" unoptimized />
                                ) : (
                                    <div className="flex size-9 items-center justify-center rounded-full bg-red-100">
                                        <span className="text-xs font-semibold text-red-600">{userInitials}</span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-gray-900">{userName}</p>
                                    <p className="text-[10px] text-gray-500">1M subscribers</p>
                                </div>
                                <button type="button" className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">
                                    Subscribe
                                </button>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-900">
                                <p className="font-semibold mb-1">Description</p>
                                <p className="whitespace-pre-wrap opacity-80 line-clamp-3">
                                    {message || "Video description goes here..."}
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case "EMAIL":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="border-b bg-gray-50 p-4">
                            <div className="mb-1 text-[10px] text-gray-500">
                                <span className="font-bold uppercase tracking-wider">From:</span> {userName} &lt;contact@brand.com&gt;
                            </div>
                            <div className="mb-3 text-[10px] text-gray-500">
                                <span className="font-bold uppercase tracking-wider">To:</span> Customer &lt;customer@example.com&gt;
                            </div>
                            <div className="text-sm font-bold text-gray-900">
                                {subject || "(No Subject)"}
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="text-sm text-gray-900 whitespace-pre-wrap min-h-[150px]">
                                {message || "Email body content..."}
                            </div>

                            {renderMediaGallery()}
                        </div>
                    </div>
                );

            case "SMS":
                return (
                    <div className="mx-auto max-w-[280px]">
                        <div className="rounded-2xl border-4 border-gray-100 overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-center gap-2">
                                <div className="size-2 rounded-full bg-gray-400" />
                                <span className="text-[10px] font-bold text-gray-500">iMessage</span>
                            </div>
                            <div className="bg-white p-4 h-[200px] flex flex-col justify-end">
                                <div className="max-w-[85%] rounded-2xl bg-[#34C759] px-3 py-2 text-sm text-white relative mb-2">
                                    {message || "SMS content"}
                                    <div className="absolute -bottom-0.5 right-1 text-[8px] opacity-70">12:34</div>
                                </div>
                            </div>
                        </div>
                        <p className="mt-2 text-center text-[10px] text-gray-400 font-medium">Text Message · Yesterday 12:34 PM</p>
                    </div>
                );

            case "TWITTER":
                return (
                    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="p-4">
                            <div className="mb-3 flex gap-3">
                                {userImage ? (
                                    <div className="relative size-10 overflow-hidden rounded-full border border-gray-100">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
                                        <span className="text-sm font-semibold text-blue-600">{userInitials}</span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-1">
                                        <span className="font-bold text-sm text-gray-900">{userName}</span>
                                        <span className="text-gray-500 text-xs">@{userName.toLowerCase().replace(/\s/g, '')} · 1m</span>
                                    </div>

                                    <div className="mb-3 text-sm text-gray-900 whitespace-pre-wrap">
                                        {message || "What's happening?"}
                                    </div>

                                    <div className="mb-3">
                                        {renderMediaGallery()}
                                    </div>

                                    <div className="flex items-center justify-between text-gray-500 max-w-[300px]">
                                        <MessageCircle className="size-4 hover:text-blue-400 cursor-pointer" />
                                        <Repeat2 className="size-4 hover:text-green-400 cursor-pointer" />
                                        <Heart className="size-4 hover:text-red-400 cursor-pointer" />
                                        <Share2 className="size-4 hover:text-blue-400 cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "PINTEREST":
                return (
                    <div className="mx-auto max-w-[236px] overflow-hidden rounded-3xl bg-white shadow-lg border">
                        {renderMediaGallery()}
                        <div className="p-3">
                            {subject && (
                                <h3 className="mb-1 text-sm font-bold text-gray-900 leading-tight">{subject}</h3>
                            )}
                            <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{message || "No description provided"}</p>

                            <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2">
                                    {userImage ? (
                                        <Image src={userImage} alt={userName} width={24} height={24} className="rounded-full" unoptimized />
                                    ) : (
                                        <div className="flex size-6 items-center justify-center rounded-full bg-gray-100">
                                            <span className="text-[10px] font-bold text-gray-600">{userInitials}</span>
                                        </div>
                                    )}
                                    <span className="text-[10px] font-semibold text-gray-900 truncate max-w-[100px]">{userName}</span>
                                </div>
                                <Heart className="size-4 text-gray-400" />
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-lg border-2 bg-muted/30 p-6">
                <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Live Preview</h3>
                    <p className="text-xs text-muted-foreground">
                        Type directly in the preview to see how your content will appear on {platform}
                    </p>
                </div>
                <div className="mx-auto max-w-2xl">
                    {renderPlatformPreview()}
                </div>
            </div>

            <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
                <DialogContent className="gap-0 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none bg-transparent shadow-none">
                    <DialogHeader className="p-4 bg-white rounded-t-lg border-b">
                        <DialogTitle className="text-gray-900 truncate pr-8">
                            {selectedFile ? getFileName(selectedFile) : 'File Preview'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 bg-gray-100/50 backdrop-blur-md overflow-hidden relative ">
                        {selectedFile && (
                            <>
                                {isVideoUrl(selectedFile) ? (
                                    <video src={getPreviewUrl(selectedFile)} className="size-full" controls autoPlay />
                                ) : isImageUrl(selectedFile) ? (
                                    <div className="relative size-full flex items-center justify-center p-4">
                                        <Image
                                            src={getPreviewUrl(selectedFile)}
                                            alt="Preview"
                                            fill
                                            className="object-fit: fill;"
                                            unoptimized
                                        />
                                    </div>
                                ) : isDocumentUrl(selectedFile) && selectedFile.toLowerCase().includes('.pdf') ? (
                                    <iframe
                                        src={getPreviewUrl(selectedFile)}
                                        className="size-full border-0 min-h-[600px] overflow-hidden"
                                        title="PDF Preview"
                                    />
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center p-12 text-center bg-white">
                                        <div className="mb-6 rounded-2xl bg-muted p-8">
                                            {getFileIcon(selectedFile)}
                                        </div>
                                        <h3 className="mb-2 text-lg font-semibold text-gray-900">
                                            {getFileName(selectedFile)}
                                        </h3>
                                        <p className="mb-8 max-w-md text-sm text-gray-500">
                                            This file type cannot be previewed directly in the browser. You can download it to view the content.
                                        </p>
                                        <div className="flex gap-3">
                                            <a
                                                href={selectedFile}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-md"
                                            >
                                                <ExternalLink className="size-4" />
                                                Open in New Tab
                                            </a>
                                            <a
                                                href={selectedFile}
                                                download
                                                className="flex items-center gap-2 rounded-full border bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 shadow-sm"
                                            >
                                                <Download className="size-4" />
                                                Download File
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
