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
    Video
} from 'lucide-react';

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

    const isVideo = (url: string) => url.match(/\.(mp4|webm|ogg|mov)$/i);
    const userName = user?.name || "Your Brand";
    const userImage = user?.image;
    const userInitials = userName.substring(0, 2).toUpperCase();

    const renderPlatformPreview = () => {
        switch (platform) {
            case "FACEBOOK":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
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

                            <textarea
                                value={message}
                                onChange={(e) => onMessageChange(e.target.value)}
                                placeholder="What's on your mind?"
                                className="mb-3 w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                style={{ whiteSpace: 'pre-wrap', minHeight: '100px', padding: "10px" }}
                            />

                            {/* Media Preview */}
                            {mediaUrls.length > 0 ? (
                                <div className="mb-3">
                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-gray-100 bg-black">
                                        {isVideo(mediaUrls[0]) ? (
                                            <>
                                                <video src={mediaUrls[0]} className="size-full object-cover opacity-80" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                    <button type="button" className="flex cursor-pointer items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white hover:bg-black/80 backdrop-blur-sm transition-all">
                                                        <Play className="size-4 fill-current" />
                                                        Watch Video
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <Image
                                                src={mediaUrls[0]}
                                                alt="Preview"
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        )}
                                    </div>
                                    {mediaUrls.length > 1 && (
                                        <div className="mt-1 text-xs text-gray-500">
                                            +{mediaUrls.length - 1} more items
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mb-3 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                                    <div className="text-center">
                                        <ImageIcon className="mx-auto size-12 text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500">Image/Video preview</p>
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
                                <button type="button" className="text-gray-900 cursor-pointer">
                                    <MoreHorizontal className="size-5" />
                                </button>
                            </div>
                        </div>

                        {/* Media Preview */}
                        {mediaUrls.length > 0 ? (
                            <div className="relative flex aspect-square w-full items-center justify-center bg-black">
                                {isVideo(mediaUrls[0]) ? (
                                    <video
                                        src={mediaUrls[0]}
                                        className="size-full object-cover"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                    />
                                ) : (
                                    <Image
                                        src={mediaUrls[0]}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                )}
                                {mediaUrls.length > 1 && (
                                    <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                                        1/{mediaUrls.length}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex aspect-square items-center justify-center border-b bg-gray-50">
                                <div className="text-center">
                                    <ImageIcon className="mx-auto size-16 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">Media preview</p>
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
                                <span className="font-semibold text-gray-900">{userName.toLowerCase().replace(/\s/g, '')}</span>{" "}
                                <textarea
                                    value={message}
                                    onChange={(e) => onMessageChange(e.target.value)}
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
                                {userImage ? (
                                    <div className="relative size-12 overflow-hidden rounded-full border border-gray-200">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-12 items-center justify-center rounded-full bg-gray-500">
                                        <span className="text-sm font-semibold text-white">{userInitials}</span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{userName}</p>
                                    <p className="text-xs text-gray-500">Company · 1m</p>
                                </div>
                                <button type="button" className="text-gray-500 cursor-pointer">
                                    <MoreHorizontal className="size-5" />
                                </button>
                            </div>

                            {subject && (
                                <h3 className="mb-2 text-lg font-semibold text-gray-900">{subject}</h3>
                            )}

                            <textarea
                                value={message}
                                onChange={(e) => onMessageChange(e.target.value)}
                                placeholder="Share your thoughts..."
                                className="mb-3 w-full resize-none border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                style={{ whiteSpace: 'pre-wrap', minHeight: '100px', padding: "10px" }}
                            />

                            {/* Media Preview */}
                            {mediaUrls.length > 0 ? (
                                <div className="mb-3">
                                    <div className="relative aspect-video w-full overflow-hidden rounded border bg-gray-100 bg-black">
                                        {isVideo(mediaUrls[0]) ? (
                                            <>
                                                <video src={mediaUrls[0]} className="size-full object-cover opacity-80" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                    <button type="button" className="flex cursor-pointer items-center gap-2 rounded-md bg-white/90 px-4 py-2 text-sm font-semibold text-black hover:bg-white transition-all">
                                                        <Play className="size-4 fill-current" />
                                                        Watch Video
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <Image
                                                src={mediaUrls[0]}
                                                alt="Preview"
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-3 flex items-center justify-center rounded border border-gray-300 bg-gray-50 p-12">
                                    <div className="text-center">
                                        <ImageIcon className="mx-auto size-12 text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500">Image/Video preview</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 border-t pt-2 text-sm text-gray-600">
                                <button type="button" className="flex cursor-pointer items-center gap-1 hover:bg-gray-100 rounded px-3 py-1">
                                    <ThumbsUp className="size-4" /> Like
                                </button>
                                <button type="button" className="flex cursor-pointer items-center gap-1 hover:bg-gray-100 rounded px-3 py-1">
                                    <MessageCircle className="size-4" /> Comment
                                </button>
                                <button type="button" className="flex cursor-pointer items-center gap-1 hover:bg-gray-100 rounded px-3 py-1">
                                    <Share2 className="size-4" /> Share
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case "WHATSAPP":
                return (
                    <div className="rounded-lg border bg-[#E5DDD5] shadow-sm overflow-hidden">
                        <div className="bg-[#008069] px-4 py-3 text-white flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-gray-200 overflow-hidden">
                                {userImage ? (
                                    <Image src={userImage} alt={userName} width={40} height={40} className="object-cover size-full" unoptimized />
                                ) : (
                                    <span className="text-sm font-semibold text-gray-600">{userInitials}</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-white">{userName}</p>
                            </div>
                            <MoreHorizontal className="size-5 text-white" />
                        </div>
                        <div className="p-4 min-h-[300px] flex flex-col justify-end bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
                            <div className="ml-auto w-full max-w-[85%] rounded-lg bg-[#DCF8C6] p-2 shadow-sm relative">
                                {mediaUrls.length > 0 && (
                                    <div className="mb-2 overflow-hidden rounded-lg">
                                        {isVideo(mediaUrls[0]) ? (
                                            <video src={mediaUrls[0]} className="w-full" controls />
                                        ) : (
                                            <Image
                                                src={mediaUrls[0]}
                                                alt="Preview"
                                                width={400}
                                                height={300}
                                                className="w-full object-cover"
                                                unoptimized
                                            />
                                        )}
                                    </div>
                                )}
                                <textarea
                                    value={message}
                                    onChange={(e) => onMessageChange(e.target.value)}
                                    placeholder="Type a message"
                                    className="w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0"
                                    style={{ whiteSpace: 'pre-wrap', minHeight: '40px' }}
                                />
                                <div className="mt-1 text-right text-[10px] text-gray-500 flex items-center justify-end gap-1">
                                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="text-blue-500">✓✓</span>
                                </div>
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
                            isReel ? "aspect-[9/16] mx-auto w-1/2" : "aspect-video"
                        )}>
                            {isPlayingVideo && mediaUrls.length > 0 && isVideo(mediaUrls[0]) ? (
                                <video
                                    src={mediaUrls[0]}
                                    className="size-full object-cover"
                                    controls
                                    autoPlay
                                    onEnded={() => setIsPlayingVideo(false)}
                                />
                            ) : (
                                <>
                                    {thumbnailUrl ? (
                                        <Image
                                            src={thumbnailUrl}
                                            alt="Thumbnail"
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : mediaUrls.length > 0 ? (
                                        isVideo(mediaUrls[0]) ? (
                                            <video
                                                src={mediaUrls[0]}
                                                className="size-full object-cover opacity-80"
                                                preload="metadata"
                                            />
                                        ) : (
                                            <Image
                                                src={mediaUrls[0]}
                                                alt="Preview"
                                                fill
                                                className="object-cover opacity-80"
                                                unoptimized
                                            />
                                        )
                                    ) : (
                                        <div className="text-center">
                                            <Video className="mx-auto size-16 text-gray-400" />
                                            <p className="mt-2 text-sm text-gray-400">Video thumbnail</p>
                                        </div>
                                    )}

                                    {/* Play Button Overlay */}
                                    <button
                                        type="button"
                                        onClick={() => setIsPlayingVideo(true)}
                                        disabled={!mediaUrls.length || !isVideo(mediaUrls[0])}
                                        className="absolute cursor-pointer inset-0 flex items-center justify-center disabled:cursor-not-allowed"
                                    >
                                        <div className="flex size-16 items-center justify-center rounded-full bg-red-600/90 shadow-lg backdrop-blur-sm transition-transform hover:scale-110 disabled:opacity-50">
                                            <div className="ml-1 size-0 border-y-8 border-l-12 border-y-transparent border-l-white"></div>
                                        </div>
                                    </button>

                                    {isReel && (
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
                            {subject ? (
                                <h3 className="mb-2 text-base font-semibold text-gray-900">{subject}</h3>
                            ) : (
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => onSubjectChange(e.target.value)}
                                    placeholder="Video title..."
                                    className="mb-2 w-full border-0 bg-transparent p-0 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                    style={{ padding: "10px" }}
                                />
                            )}

                            <div className="mb-3 flex items-center gap-2">
                                {userImage ? (
                                    <div className="relative size-9 overflow-hidden rounded-full">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-9 items-center justify-center rounded-full bg-red-100">
                                        <span className="text-xs font-semibold text-red-600">{userInitials}</span>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{userName}</p>
                                    <p className="text-xs text-gray-500">1K subscribers</p>
                                </div>
                            </div>

                            <textarea
                                value={message}
                                onChange={(e) => onMessageChange(e.target.value)}
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
                                <span className="font-medium">From:</span> {user?.name || "your.brand"} &lt;sender@example.com&gt;
                            </div>
                            <div className="mb-2 text-xs text-gray-500">
                                <span className="font-medium">To:</span> customer@example.com
                            </div>
                            <div className="text-sm">
                                <span className="font-medium text-gray-700">Subject:</span>{" "}
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => onSubjectChange(e.target.value)}
                                    placeholder="Email subject..."
                                    className="w-full border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                />
                            </div>
                        </div>

                        <div className="p-6">
                            <textarea
                                value={message}
                                onChange={(e) => onMessageChange(e.target.value)}
                                placeholder="Email body..."
                                className="w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                style={{ whiteSpace: 'pre-wrap', minHeight: '200px' }}
                            />

                            {/* Image Preview */}
                            {mediaUrls.length > 0 ? (
                                <div className="mt-4">
                                    <div className="relative aspect-video w-full overflow-hidden rounded border bg-gray-100">
                                        <Image
                                            src={mediaUrls[0]}
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

            case "SMS":
                return (
                    <div className="mx-auto max-w-sm">
                        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-1">
                            <div className="rounded-2xl bg-white p-4">
                                <div className="mb-2 text-xs text-gray-500">SMS Message</div>
                                <textarea
                                    value={message}
                                    onChange={(e) => onMessageChange(e.target.value)}
                                    placeholder="Type your SMS message..."
                                    className="w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                    style={{ whiteSpace: 'pre-wrap', minHeight: '100px' }}
                                />
                                <div className="mt-2 text-right text-xs text-gray-500">
                                    {message.length} / 160 characters
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "TWITTER":
                return (
                    <div className="rounded-lg border bg-white shadow-sm">
                        <div className="p-4">
                            <div className="mb-3 flex gap-3">
                                {userImage ? (
                                    <div className="relative size-12 overflow-hidden rounded-full border border-gray-200">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-12 items-center justify-center rounded-full bg-blue-100">
                                        <span className="text-sm font-semibold text-blue-600">{userInitials}</span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-1">
                                        <span className="font-bold text-gray-900">{userName}</span>
                                        <span className="text-gray-500">@{userName.toLowerCase().replace(/\s/g, '')} · 1m</span>
                                    </div>

                                    <textarea
                                        value={message}
                                        onChange={(e) => onMessageChange(e.target.value)}
                                        placeholder="What's happening?"
                                        className="mb-3 w-full resize-none border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                        style={{ whiteSpace: 'pre-wrap', minHeight: '80px' }}
                                    />

                                    {/* Media Preview */}
                                    {mediaUrls.length > 0 ? (
                                        <div className="mb-3 overflow-hidden rounded-2xl border border-gray-300">
                                            {isVideo(mediaUrls[0]) ? (
                                                <video
                                                    src={mediaUrls[0]}
                                                    className="w-full object-cover"
                                                    controls
                                                />
                                            ) : (
                                                <Image
                                                    src={mediaUrls[0]}
                                                    alt="Preview"
                                                    width={500}
                                                    height={300}
                                                    className="w-full object-cover"
                                                    unoptimized
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mb-3 flex items-center justify-center rounded-2xl border border-gray-300 bg-gray-50 p-12">
                                            <div className="text-center">
                                                <ImageIcon className="mx-auto size-12 text-gray-400" />
                                                <p className="mt-2 text-sm text-gray-500">Media preview</p>
                                            </div>
                                        </div>
                                    )}

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

            case "PINTEREST":
                return (
                    <div className="mx-auto max-w-[236px] overflow-hidden rounded-2xl bg-white shadow-md">
                        {mediaUrls.length > 0 ? (
                            <div className="relative w-full">
                                {isVideo(mediaUrls[0]) ? (
                                    <video
                                        src={mediaUrls[0]}
                                        className="w-full object-cover rounded-2xl"
                                        controls={false}
                                        autoPlay
                                        muted
                                        loop
                                    />
                                ) : (
                                    <Image
                                        src={mediaUrls[0]}
                                        alt="Pin"
                                        width={236}
                                        height={350} // Aspect ratio approximation
                                        className="w-full object-cover rounded-2xl"
                                        unoptimized
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex h-[300px] w-full items-center justify-center bg-gray-100 rounded-2xl">
                                <div className="text-center">
                                    <ImageIcon className="mx-auto size-8 text-gray-400" />
                                    <p className="mt-2 text-xs text-gray-500">Pin image</p>
                                </div>
                            </div>
                        )}
                        <div className="p-3">
                            {subject && (
                                <h3 className="mb-1 text-sm font-semibold text-gray-900 leading-tight">{subject}</h3>
                            )}
                            <p className="text-xs text-gray-700 line-clamp-3 mb-2">{message || "No description"}</p>

                            <div className="flex items-center gap-2 mt-2">
                                {userImage ? (
                                    <div className="relative size-6 overflow-hidden rounded-full">
                                        <Image src={userImage} alt={userName} fill className="object-cover" unoptimized />
                                    </div>
                                ) : (
                                    <div className="flex size-6 items-center justify-center rounded-full bg-red-100">
                                        <span className="text-[10px] font-bold text-red-600">{userInitials}</span>
                                    </div>
                                )}
                                <span className="text-xs text-gray-600 truncate">{userName}</span>
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
        </div>
    );
}
