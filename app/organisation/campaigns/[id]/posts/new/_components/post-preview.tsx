import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, MoreHorizontal, ThumbsUp, MessageSquare, Repeat, Send } from 'lucide-react';
import Image from 'next/image';

interface PostPreviewProps {
    platforms: string[];
    subject: string;
    message: string;
    mediaUrls: string[];
    thumbnailUrl?: string | null;
    isReel?: boolean;
    user?: {
        name?: string;
        image?: string;
    };
}

export function PostPreview({ platforms, subject, message, mediaUrls, thumbnailUrl, isReel, user }: PostPreviewProps) {
    const [activeTab, setActiveTab] = useState(platforms[0] || 'FACEBOOK');

    if (platforms.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Select a platform to see preview
                </CardContent>
            </Card>
        );
    }

    // Update active tab if current active tab is not in selected platforms
    if (!platforms.includes(activeTab) && platforms.length > 0) {
        setActiveTab(platforms[0]);
    }

    return (
        <Card className="h-full sticky top-4">
            <CardHeader>
                <CardTitle>Post Preview</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto mb-4">
                        {platforms.map(platform => (
                            <TabsTrigger key={platform} value={platform}>
                                {platform.charAt(0) + platform.slice(1).toLowerCase()}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {platforms.map(platform => (
                        <TabsContent key={platform} value={platform} className="mt-0">
                            <div className="border rounded-lg overflow-hidden bg-white dark:bg-black">
                                {platform === 'FACEBOOK' && (
                                    <FacebookPreview
                                        subject={subject}
                                        message={message}
                                        mediaUrls={mediaUrls}
                                        thumbnailUrl={thumbnailUrl}
                                        user={user}
                                    />
                                )}
                                {platform === 'INSTAGRAM' && (
                                    <InstagramPreview
                                        subject={subject}
                                        message={message}
                                        mediaUrls={mediaUrls}
                                        thumbnailUrl={thumbnailUrl}
                                        user={user}
                                    />
                                )}
                                {platform === 'LINKEDIN' && (
                                    <LinkedInPreview
                                        subject={subject}
                                        message={message}
                                        mediaUrls={mediaUrls}
                                        user={user}
                                    />
                                )}
                                {platform === 'TWITTER' && (
                                    <TwitterPreview
                                        subject={subject}
                                        message={message}
                                        mediaUrls={mediaUrls}
                                        user={user}
                                    />
                                )}
                                {platform === 'YOUTUBE' && (
                                    <YouTubePreview
                                        subject={subject}
                                        message={message}
                                        mediaUrls={mediaUrls}
                                        thumbnailUrl={thumbnailUrl}
                                        user={user}
                                        isReel={isReel}
                                    />
                                )}
                                {platform === 'PINTEREST' && (
                                    <PinterestPreview
                                        subject={subject}
                                        message={message}
                                        mediaUrls={mediaUrls}
                                        user={user}
                                    />
                                )}
                                {platform === 'SMS' && (
                                    <SMSPreview message={message} />
                                )}
                                {platform === 'EMAIL' && (
                                    <EmailPreview subject={subject} message={message} />
                                )}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>
        </Card>
    );
}

function FacebookPreview({ subject, message, mediaUrls, thumbnailUrl, user }: any) {
    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Avatar className="size-10">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-sm">{user?.name || 'Your Page Name'}</p>
                    <p className="text-xs text-muted-foreground">Just now · <span className="text-xs">🌎</span></p>
                </div>
                <Button variant="ghost" size="icon" className="ml-auto cursor-pointer h-8 w-8">
                    <MoreHorizontal className="size-4" />
                </Button>
            </div>
            {subject && <p className="font-bold">{subject}</p>}
            <p className="text-sm whitespace-pre-wrap">{message || 'Your post content...'}</p>
            {mediaUrls && mediaUrls.length > 0 && (
                <MediaGrid mediaUrls={mediaUrls} thumbnailUrl={thumbnailUrl} />
            )}
            <div className="flex items-center justify-between pt-2 border-t text-muted-foreground">
                <Button variant="ghost" size="sm" className="flex-1 gap-2 cursor-pointer">
                    <ThumbsUp className="size-4" /> Like
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 gap-2 cursor-pointer">
                    <MessageCircle className="size-4" /> Comment
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 gap-2 cursor-pointer">
                    <Share2 className="size-4" /> Share
                </Button>
            </div>
        </div>
    );
}

function LinkedInPreview({ subject, message, mediaUrls, user }: any) {
    return (
        <div className="p-4 space-y-3 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2">
                <Avatar className="size-12 rounded-none">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback className="rounded-none">Co</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-sm">{user?.name || 'Company Name'}</p>
                    <p className="text-xs text-muted-foreground">1,234 followers</p>
                    <p className="text-xs text-muted-foreground">Just now • <span className="text-xs">🌐</span></p>
                </div>
                <Button variant="ghost" size="icon" className="ml-auto cursor-pointer h-8 w-8">
                    <MoreHorizontal className="size-4" />
                </Button>
            </div>
            {subject && <p className="font-bold">{subject}</p>}
            <p className="text-sm whitespace-pre-wrap">{message || 'Your post content...'}</p>
            {mediaUrls && mediaUrls.length > 0 && (
                <MediaGrid mediaUrls={mediaUrls} />
            )}
            <div className="flex items-center justify-between pt-2 border-t text-muted-foreground">
                <Button variant="ghost" size="sm" className="flex-col h-auto cursor-pointer py-2 gap-1 text-xs">
                    <ThumbsUp className="size-4" /> Like
                </Button>
                <Button variant="ghost" size="sm" className="flex-col h-auto cursor-pointer py-2 gap-1 text-xs">
                    <MessageCircle className="size-4" /> Comment
                </Button>
                <Button variant="ghost" size="sm" className="flex-col h-auto cursor-pointer py-2 gap-1 text-xs">
                    <Repeat className="size-4" /> Repost
                </Button>
                <Button variant="ghost" size="sm" className="flex-col h-auto cursor-pointer py-2 gap-1 text-xs">
                    <Send className="size-4" /> Send
                </Button>
            </div>
        </div>
    );
}

function InstagramPreview({ subject, message, mediaUrls, thumbnailUrl, user }: any) {
    return (
        <div className="space-y-3 pb-4">
            <div className="flex items-center gap-2 p-3">
                <Avatar className="size-8">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm">{user?.name || 'username'}</p>
                <Button variant="ghost" size="icon" className="ml-auto cursor-pointer h-8 w-8">
                    <MoreHorizontal className="size-4" />
                </Button>
            </div>
            {mediaUrls && mediaUrls.length > 0 ? (
                <MediaGrid mediaUrls={mediaUrls} thumbnailUrl={thumbnailUrl} square />
            ) : (
                <div className="aspect-square bg-muted flex items-center justify-center text-muted-foreground">
                    No media
                </div>
            )}
            <div className="px-3 space-y-2">
                <div className="flex items-center gap-4">
                    <Heart className="size-6" />
                    <MessageCircle className="size-6" />
                    <Send className="size-6" />
                    <div className="ml-auto">
                        <div className="size-6 border-2 border-current rounded-none" />
                    </div>
                </div>
                <div className="text-sm">
                    <p><span className="font-semibold">{user?.name || 'username'}</span> {subject ? <span className="font-bold mr-1">{subject}</span> : ''}{message}</p>
                </div>
            </div>
        </div>
    );
}

function TwitterPreview({ subject, message, mediaUrls, user }: any) {
    return (
        <div className="p-4 space-y-3">
            <div className="flex gap-3">
                <Avatar className="size-10">
                    <AvatarImage src={user?.image} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-1">
                        <p className="font-bold text-sm">{user?.name || 'Name'}</p>
                        <p className="text-sm text-muted-foreground">@{user?.name?.toLowerCase().replace(/\s/g, '') || 'handle'} · Just now</p>
                        <Button variant="ghost" size="icon" className="ml-auto cursor-pointer h-8 w-8">
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

function YouTubePreview({ subject, message, mediaUrls, thumbnailUrl, user, isReel }: any) {
    const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');
    const hasVideo = mediaUrls && mediaUrls.length > 0 && mediaUrls[0].match(/\.(mp4|mov|webm)$/i);
    const hasImage = mediaUrls && mediaUrls.length > 0 && !hasVideo;

    return (
        <div className="space-y-3 pb-4">
            {thumbnailUrl ? (
                <div className={`${isReel ? 'aspect-[9/16] max-w-[240px] mx-auto' : 'aspect-video'} relative bg-muted overflow-hidden`}>
                    <Image
                        src={thumbnailUrl}
                        alt="Video Thumbnail"
                        fill
                        className="object-cover"
                        unoptimized={isExternalUrl(thumbnailUrl)}
                    />
                    {hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="size-16 rounded-full bg-red-600/90 flex items-center justify-center">
                                <div className="ml-1 size-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-white" />
                            </div>
                        </div>
                    )}
                    {isReel && (
                        <div className="absolute top-2 right-2 bg-black/60 p-1 rounded-sm">
                            <div className="border-2 border-white size-5 rounded-sm flex items-center justify-center">
                                <div className="size-2 bg-white rounded-full"></div>
                            </div>
                        </div>
                    )}
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded">0:00</span>
                </div>
            ) : hasVideo ? (
                <div className={`${isReel ? 'aspect-[9/16] max-w-[240px] mx-auto' : 'aspect-video'} bg-black flex items-center justify-center text-white relative`}>
                    <div className="size-16 rounded-full bg-red-600 flex items-center justify-center">
                        <div className="ml-1 size-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-white" />
                    </div>
                    {isReel && (
                        <div className="absolute top-2 right-2 bg-black/60 p-1 rounded-sm">
                            <div className="border-2 border-white size-5 rounded-sm flex items-center justify-center">
                                <div className="size-2 bg-white rounded-full"></div>
                            </div>
                        </div>
                    )}
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
                <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground">
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
        <div className="p-4 max-w-[236px] mx-auto">
            <div className="rounded-2xl overflow-hidden bg-muted mb-2">
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
        <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg max-w-sm mx-auto my-4">
            <div className="bg-blue-500 text-white p-3 rounded-2xl rounded-tr-none max-w-[80%] ml-auto mb-1">
                <p className="text-sm">{message || 'Message content...'}</p>
            </div>
            <p className="text-[10px] text-muted-foreground text-right">Delivered</p>
        </div>
    );
}

function EmailPreview({ subject, message }: { subject: string, message: string }) {
    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted p-2 border-b text-xs space-y-1">
                <p><span className="text-muted-foreground">To:</span> Recipient</p>
                <p><span className="text-muted-foreground">Subject:</span> {subject || 'No Subject'}</p>
            </div>
            <div className="p-4 min-h-[200px] text-sm whitespace-pre-wrap">
                {message || 'Email content...'}
            </div>
        </div>
    );
}

function MediaGrid({ mediaUrls, square, rounded, thumbnailUrl }: { mediaUrls: string[], square?: boolean, rounded?: boolean, thumbnailUrl?: string | null }) {
    const count = mediaUrls.length;
    const displayUrls = mediaUrls.slice(0, 4);

    // Check if URL is external (Vercel Blob, etc.)
    const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

    return (
        <div className={`grid gap-0.5 ${count === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${rounded ? 'rounded-xl overflow-hidden border' : ''}`}>
            {displayUrls.map((url, index) => {
                const isVideo = url.match(/\.(mp4|mov|webm)$/i);
                // Use thumbnail if it's the first item, it's a video, and thumbnail is provided
                const imageUrl = (index === 0 && isVideo && thumbnailUrl) ? thumbnailUrl : url;

                return (
                    <div key={index} className={`relative ${square ? 'aspect-square' : (count === 1 ? 'aspect-video' : 'aspect-square')} bg-muted overflow-hidden`}>
                        {isVideo ? (
                            <>
                                {thumbnailUrl && index === 0 ? (
                                    <Image
                                        src={thumbnailUrl}
                                        alt={`Media ${index}`}
                                        fill
                                        className="object-cover"
                                        unoptimized={isExternalUrl(thumbnailUrl)}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-black/10">
                                        {/* Fallback pattern if no thumbnail */}
                                    </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="size-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
                                        <div className="ml-1 size-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-black" />
                                    </div>
                                </div>
                            </>
                        ) : isExternalUrl(url) ? (
                            // Use unoptimized for external URLs (Vercel Blob, etc.)
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
                );
            })}
        </div>
    );
}
