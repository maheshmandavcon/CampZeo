"use client";

import Image from "next/image";
import {
    MoreHorizontal,
    ThumbsUp,
    MessageCircle,
    Share2,
    Heart,
    Send,
    Bookmark,
    ImageIcon,
    Play
} from "lucide-react";

interface TemplatePreviewProps {
    platform: string;
    content: string;
    subject?: string | null;
    mediaUrls?: string[];
    isCompact?: boolean;
}

export default function TemplatePreview({
    platform,
    content,
    subject,
    mediaUrls = [],
    isCompact = false
}: TemplatePreviewProps) {
    const hasMedia = mediaUrls && mediaUrls.length > 0;
    const firstMedia = hasMedia ? mediaUrls[0] : null;

    switch (platform) {
        case "FACEBOOK":
            return (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <div className="p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-full bg-blue-100">
                                <span className="text-xs font-semibold text-blue-600">YB</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">Your Brand</p>
                                <p className="text-xs text-gray-500">Just now · 🌎</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-900 whitespace-pre-wrap line-clamp-3 mb-2">
                            {content || "Your message will appear here..."}
                        </p>

                        {hasMedia && (
                            <div className="relative aspect-video w-full overflow-hidden rounded bg-gray-100">
                                <Image
                                    src={firstMedia!}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        )}

                        {!isCompact && (
                            <div className="flex items-center justify-between border-t pt-2 mt-2">
                                <div className="flex gap-1 text-xs text-gray-500">
                                    <ThumbsUp className="size-3" /> <span>Like</span>
                                </div>
                                <div className="flex gap-1 text-xs text-gray-500">
                                    <MessageCircle className="size-3" /> <span>Comment</span>
                                </div>
                                <div className="flex gap-1 text-xs text-gray-500">
                                    <Share2 className="size-3" /> <span>Share</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );

        case "INSTAGRAM":
            return (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <div className="border-b p-2">
                        <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                                <span className="text-xs font-semibold text-white">YB</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">yourbrand</p>
                        </div>
                    </div>

                    {hasMedia ? (
                        <div className="relative aspect-square w-full bg-black">
                            <Image
                                src={firstMedia!}
                                alt="Preview"
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>
                    ) : (
                        <div className="flex aspect-square items-center justify-center bg-gray-50">
                            <ImageIcon className="size-12 text-gray-400" />
                        </div>
                    )}

                    <div className="p-2">
                        {!isCompact && (
                            <div className="mb-2 flex items-center gap-3">
                                <Heart className="size-5 text-gray-900" />
                                <MessageCircle className="size-5 text-gray-900" />
                                <Send className="size-5 text-gray-900" />
                            </div>
                        )}
                        <div className="text-xs">
                            <span className="font-semibold text-gray-900">yourbrand</span>{" "}
                            <span className="text-gray-900 line-clamp-2">{content || "Caption..."}</span>
                        </div>
                    </div>
                </div>
            );

        case "LINKEDIN":
            return (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <div className="p-3">
                        <div className="mb-2 flex items-start gap-2">
                            <div className="flex size-10 items-center justify-center rounded-full bg-gray-400">
                                <span className="text-xs font-semibold text-white">YB</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">Your Brand</p>
                                <p className="text-xs text-gray-500">Company · 1m</p>
                            </div>
                        </div>

                        {subject && (
                            <h3 className="mb-1 text-sm font-semibold text-gray-900 line-clamp-1">{subject}</h3>
                        )}

                        <p className="text-xs text-gray-900 whitespace-pre-wrap line-clamp-3 mb-2">
                            {content || "Your post content..."}
                        </p>

                        {hasMedia && (
                            <div className="relative aspect-video w-full overflow-hidden rounded bg-gray-100">
                                <Image
                                    src={firstMedia!}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        )}

                        {!isCompact && (
                            <div className="flex items-center gap-2 border-t pt-2 mt-2 text-xs text-gray-600">
                                <button className="flex items-center gap-1">
                                    <ThumbsUp className="size-3" /> Like
                                </button>
                                <button className="flex items-center gap-1">
                                    <MessageCircle className="size-3" /> Comment
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );

        case "YOUTUBE":
            return (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    {hasMedia ? (
                        <div className="relative aspect-video w-full bg-black">
                            <Image
                                src={firstMedia!}
                                alt="Preview"
                                fill
                                className="object-cover"
                                unoptimized
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="rounded-full bg-red-600 p-3">
                                    <Play className="size-6 text-white fill-white" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex aspect-video items-center justify-center bg-gray-900">
                            <Play className="size-16 text-gray-600" />
                        </div>
                    )}
                    <div className="p-3">
                        {subject && (
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{subject}</h3>
                        )}
                        <p className="text-xs text-gray-600 line-clamp-2">{content || "Description..."}</p>
                    </div>
                </div>
            );

        case "EMAIL":
            return (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <div className="border-b bg-gray-50 p-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-medium">From:</span>
                            <span>your-brand@company.com</span>
                        </div>
                        {subject && (
                            <div className="mt-1 text-sm font-semibold text-gray-900 line-clamp-1">
                                {subject}
                            </div>
                        )}
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-gray-900 whitespace-pre-wrap line-clamp-4">
                            {content || "Email content..."}
                        </p>
                        {hasMedia && (
                            <div className="mt-2 relative aspect-video w-full overflow-hidden rounded bg-gray-100">
                                <Image
                                    src={firstMedia!}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        )}
                    </div>
                </div>
            );

        case "SMS":
        case "WHATSAPP":
            return (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    <div className="p-3 bg-gradient-to-b from-green-50 to-white">
                        <div className="bg-white rounded-lg shadow-sm p-3 max-w-[85%]">
                            <p className="text-xs text-gray-900 whitespace-pre-wrap line-clamp-4">
                                {content || "Message text..."}
                            </p>
                            {hasMedia && (
                                <div className="mt-2 relative aspect-video w-full overflow-hidden rounded bg-gray-100">
                                    <Image
                                        src={firstMedia!}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                            )}
                            <p className="text-xs text-gray-400 text-right mt-1">Just now</p>
                        </div>
                    </div>
                </div>
            );

        case "PINTEREST":
            return (
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden mx-auto" style={{ maxWidth: "240px" }}>
                    <div className="relative w-full aspect-[3/4] bg-gray-100">
                        {hasMedia ? (
                            <Image
                                src={firstMedia!}
                                alt="Pin Preview"
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                                <ImageIcon className="mb-2 size-8 text-gray-300" />
                            </div>
                        )}
                        <div className="absolute right-2 top-2 rounded-full bg-white p-1.5 shadow-sm opacity-80">
                            <MoreHorizontal className="size-3 text-gray-700" />
                        </div>
                    </div>
                    <div className="p-3">
                        {subject && (
                            <h3 className="mb-1 text-xs font-bold text-gray-900 leading-tight line-clamp-2">{subject}</h3>
                        )}
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="size-4 rounded-full bg-gray-200 overflow-hidden relative">
                                <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold">YB</div>
                            </div>
                            <span className="text-[10px] font-medium text-gray-700">Your Brand</span>
                        </div>
                        <p className="text-[10px] text-gray-600 line-clamp-2 text-left">
                            {content || "Pin description..."}
                        </p>
                    </div>
                </div>
            );

        default:
            return (
                <div className="rounded-lg border bg-gray-50 p-8 text-center">
                    <p className="text-sm text-gray-500">Preview not available</p>
                </div>
            );
    }
}
