import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, MoreHorizontal, ThumbsUp, MessageSquare, Repeat, Send } from 'lucide-react';
import Image from 'next/image';

interface TemplatePreviewProps {
    platform: string;
    subject: string;
    message: string;
    mediaUrls?: string[];
    user?: {
        name?: string;
        image?: string;
    };
}

export function TemplatePreview({ platform, subject, message, mediaUrls = [], user }: TemplatePreviewProps) {
    // Determine active tab/view based on single platform
    const displayPlatform = platform || 'EMAIL';

    return (
        <Card className="h-full sticky top-4 border-none shadow-none">
            <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg font-medium">Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-black">
                    {displayPlatform === 'FACEBOOK' && (
                        <FacebookPreview
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            user={user}
                        />
                    )}
                    {displayPlatform === 'INSTAGRAM' && (
                        <InstagramPreview
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            user={user}
                        />
                    )}
                    {displayPlatform === 'LINKEDIN' && (
                        <LinkedInPreview
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            user={user}
                        />
                    )}
                    {(displayPlatform === 'TWITTER' || displayPlatform === 'X') && (
                        <TwitterPreview
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            user={user}
                        />
                    )}
                    {displayPlatform === 'YOUTUBE' && (
                        <YouTubePreview
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            user={user}
                        />
                    )}
                    {displayPlatform === 'PINTEREST' && (
                        <PinterestPreview
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            user={user}
                        />
                    )}
                    {displayPlatform === 'SMS' && (
                        <SMSPreview message={message} />
                    )}
                    {(displayPlatform === 'EMAIL' || displayPlatform === 'WHATSAPP') && (
                        <EmailPreview subject={subject} message={message} type={displayPlatform} />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function FacebookPreview({ subject, message, mediaUrls, user }: any) {
    return (
        <div className="p-4 space-y-3 font-sans">
            <div className="flex items-center gap-2">
                <Avatar className="size-10">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{user?.name || 'Your Page Name'}</p>
                    <p className="text-xs text-gray-500">Just now · <span className="text-xs">🌎</span></p>
                </div>
                <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                    <MoreHorizontal className="size-4" />
                </Button>
            </div>
            {subject && <p className="font-bold text-gray-900 dark:text-gray-100">{subject}</p>}
            <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{message || 'Your post content...'}</p>
            {mediaUrls && mediaUrls.length > 0 && (
                <MediaGrid mediaUrls={mediaUrls} />
            )}
            <div className="flex items-center justify-between pt-2 border-t text-gray-500">
                <Button variant="ghost" size="sm" className="flex-1 gap-2">
                    <ThumbsUp className="size-4" /> Like
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 gap-2">
                    <MessageCircle className="size-4" /> Comment
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 gap-2">
                    <Share2 className="size-4" /> Share
                </Button>
            </div>
        </div>
    );
}

function LinkedInPreview({ subject, message, mediaUrls, user }: any) {
    return (
        <div className="p-4 space-y-3 bg-white dark:bg-gray-900 font-sans">
            <div className="flex items-center gap-2">
                <Avatar className="size-12 rounded-sm">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback className="rounded-sm">Co</AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                    <p className="font-semibold text-sm">{user?.name || 'Company Name'}</p>
                    <p className="text-xs text-muted-foreground">1,234 followers</p>
                    <p className="text-xs text-muted-foreground">Just now • <span className="text-xs">🌐</span></p>
                </div>
                <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                    <MoreHorizontal className="size-4" />
                </Button>
            </div>
            {subject && <p className="font-bold text-gray-900 dark:text-gray-100">{subject}</p>}
            <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{message || 'Your post content...'}</p>
            {mediaUrls && mediaUrls.length > 0 && (
                <MediaGrid mediaUrls={mediaUrls} />
            )}
            <div className="flex items-center justify-between pt-2 border-t text-muted-foreground">
                <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-1 text-xs px-2">
                    <ThumbsUp className="size-4" /> Like
                </Button>
                <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-1 text-xs px-2">
                    <MessageCircle className="size-4" /> Comment
                </Button>
                <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-1 text-xs px-2">
                    <Repeat className="size-4" /> Repost
                </Button>
                <Button variant="ghost" size="sm" className="flex-col h-auto py-2 gap-1 text-xs px-2">
                    <Send className="size-4" /> Send
                </Button>
            </div>
        </div>
    );
}

function InstagramPreview({ subject, message, mediaUrls, user }: any) {
    return (
        <div className="space-y-3 pb-4 font-sans bg-white dark:bg-black">
            <div className="flex items-center gap-2 p-3">
                <Avatar className="size-8 ring-2 ring-pink-500 ring-offset-2">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm">{user?.name || 'username'}</p>
                <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                    <MoreHorizontal className="size-4" />
                </Button>
            </div>
            {mediaUrls && mediaUrls.length > 0 ? (
                <MediaGrid mediaUrls={mediaUrls} square />
            ) : (
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Image/Video Placeholder</p>
                </div>
            )}
            <div className="px-3 space-y-2">
                <div className="flex items-center gap-4 text-gray-900 dark:text-white">
                    <Heart className="size-6" />
                    <MessageCircle className="size-6" />
                    <Send className="size-6" />
                    <div className="ml-auto">
                        <div className="size-6 border-2 border-current rounded-sm" />
                    </div>
                </div>
                <div className="text-sm">
                    <p><span className="font-semibold">{user?.name || 'username'}</span> {subject ? <span className="font-bold mr-1">{subject}</span> : ''} {message}</p>
                </div>
            </div>
        </div>
    );
}

function TwitterPreview({ subject, message, mediaUrls, user }: any) {
    return (
        <div className="p-4 space-y-3 font-sans">
            <div className="flex gap-3">
                <Avatar className="size-10">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-1">
                        <p className="font-bold text-sm">{user?.name || 'Name'}</p>
                        <p className="text-sm text-muted-foreground">@{user?.name?.toLowerCase().replace(/\s/g, '') || 'handle'} · Just now</p>
                        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </div>
                    {subject && <p className="font-bold">{subject}</p>}
                    <p className="text-sm whitespace-pre-wrap">{message || 'What is happening?!'}</p>
                    {mediaUrls && mediaUrls.length > 0 && (
                        <MediaGrid mediaUrls={mediaUrls} rounded />
                    )}
                    <div className="flex items-center justify-between text-muted-foreground max-w-md pt-2">
                        <MessageSquare className="size-4" />
                        <Repeat className="size-4" />
                        <Heart className="size-4" />
                        <Share2 className="size-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function YouTubePreview({ subject, message, mediaUrls, user }: any) {
    const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');
    const hasVideo = mediaUrls && mediaUrls.length > 0 && mediaUrls[0].match(/\.(mp4|mov|webm)$/i);
    const hasImage = mediaUrls && mediaUrls.length > 0 && !hasVideo;

    return (
        <div className="space-y-3 pb-4 font-sans">
            {hasVideo ? (
                <div className="aspect-video bg-black flex items-center justify-center text-white relative">
                    <div className="size-16 rounded-full bg-red-600 flex items-center justify-center">
                        <div className="ml-1 size-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-white" />
                    </div>
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded">0:00</span>
                </div>
            ) : hasImage ? (
                <div className="aspect-video relative bg-muted overflow-hidden">
                    <Image
                        src={mediaUrls[0]}
                        alt="Video Thumbnail"
                        fill
                        className="object-cover"
                        unoptimized={isExternalUrl(mediaUrls[0])}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="size-16 rounded-full bg-red-600/90 flex items-center justify-center">
                            <div className="ml-1 size-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-white" />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="aspect-video bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-muted-foreground">
                    Video Thumbnail
                </div>
            )}
            <div className="px-3 flex gap-3">
                <Avatar className="size-9">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <p className="font-semibold text-sm line-clamp-2">{subject || 'Video Title'}</p>
                    <p className="text-xs text-muted-foreground">{user?.name || 'Channel Name'} · 0 views · Just now</p>
                </div>
            </div>
        </div>
    );
}

function PinterestPreview({ subject, message, mediaUrls, user }: any) {
    const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

    return (
        <div className="p-4 max-w-[236px] mx-auto font-sans">
            <div className="rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-800 mb-2">
                {mediaUrls && mediaUrls.length > 0 ? (
                    <Image
                        src={mediaUrls[0]}
                        alt="Pin"
                        width={236}
                        height={354}
                        className="object-cover w-full h-auto"
                        unoptimized={isExternalUrl(mediaUrls[0])}
                    />
                ) : (
                    <div className="aspect-[2/3] flex items-center justify-center text-muted-foreground">
                        Pin Image
                    </div>
                )}
            </div>
            <p className="font-semibold text-sm truncate">{subject || 'Pin Title'}</p>
            <div className="flex items-center gap-2 mt-1">
                <Avatar className="size-6">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <p className="text-xs text-muted-foreground truncate">{user?.name || 'Username'}</p>
            </div>
        </div>
    );
}

function SMSPreview({ message }: { message: string }) {
    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg max-w-sm mx-auto my-4 font-sans">
            <div className="flex flex-col space-y-2">
                <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none max-w-[80%] mr-auto">
                    <div className="w-32 h-2 bg-gray-300 dark:bg-gray-600 rounded"></div>
                </div>
                <div className="bg-blue-500 text-white p-3 rounded-2xl rounded-tr-none max-w-[80%] ml-auto">
                    <p className="text-sm">{message || 'Message content...'}</p>
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-1">Delivered</p>
        </div>
    );
}

function EmailPreview({ subject, message, type }: { subject: string, message: string, type: string }) {
    return (
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-black font-sans">
            <div className="bg-gray-50 dark:bg-gray-900 p-3 border-b text-xs space-y-2">
                <p><span className="text-muted-foreground w-16 inline-block">To:</span> <span className="font-medium">Recipient Name</span></p>
                <p><span className="text-muted-foreground w-16 inline-block">From:</span> <span className="font-medium">Your Brand &lt;contact@brand.com&gt;</span></p>
                {type === 'EMAIL' && (
                    <p><span className="text-muted-foreground w-16 inline-block">Subject:</span> <span className="font-medium">{subject || 'No Subject'}</span></p>
                )}
            </div>
            <div className="p-6 min-h-[200px] text-sm whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">
                {message || 'Email content...'}
            </div>
        </div>
    );
}

function MediaGrid({ mediaUrls, square, rounded }: { mediaUrls: string[], square?: boolean, rounded?: boolean }) {
    const count = mediaUrls.length;
    const displayUrls = mediaUrls.slice(0, 4);

    // Check if URL is external (Vercel Blob, etc.)
    const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

    return (
        <div className={`grid gap-0.5 ${count === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${rounded ? 'rounded-xl overflow-hidden border' : ''}`}>
            {displayUrls.map((url, index) => (
                <div key={index} className={`relative ${square ? 'aspect-square' : (count === 1 ? 'aspect-video' : 'aspect-square')} bg-muted overflow-hidden`}>
                    {url.match(/\.(mp4|mov|webm)$/i) ? (
                        <div className="flex items-center justify-center h-full bg-black/10">
                            <div className="size-8 rounded-full bg-white/80 flex items-center justify-center">
                                <div className="ml-1 size-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-black" />
                            </div>
                        </div>
                    ) : isExternalUrl(url) ? (
                        <Image
                            src={url}
                            alt={`Media ${index}`}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    ) : (
                        <Image
                            src={url}
                            alt={`Media ${index}`}
                            fill
                            className="object-cover"
                        />
                    )}
                    {index === 3 && count > 4 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl">
                            +{count - 4}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
