"use client";

import { useState, useMemo } from "react";
import { format, isToday, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isAfter, isTomorrow, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Calendar as CalendarIcon, Mail, MessageSquare, Facebook, Instagram, Linkedin, Youtube, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface Post {
    id: number;
    subject: string | null;
    message: string | null;
    type: string;
    scheduledPostTime: string;
    mediaUrls?: string[];
}

interface CalendarViewProps {
    posts: Post[];
}

export default function CalendarView({ posts }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week' | 'day'>('month');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showDetailSlider, setShowDetailSlider] = useState(false);

    // Get platform configuration
    const getPlatformConfig = (platform: string) => {
        const configs: Record<string, { bgColor: string; textColor: string; borderColor: string }> = {
            EMAIL: { bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-l-blue-500" },
            SMS: { bgColor: "bg-green-50", textColor: "text-green-700", borderColor: "border-l-green-500" },
            FACEBOOK: { bgColor: "bg-blue-50", textColor: "text-blue-600", borderColor: "border-l-blue-600" },
            INSTAGRAM: { bgColor: "bg-pink-50", textColor: "text-pink-600", borderColor: "border-l-pink-500" },
            LINKEDIN: { bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-l-blue-700" },
            YOUTUBE: { bgColor: "bg-red-50", textColor: "text-red-600", borderColor: "border-l-red-600" },
        };
        return configs[platform] || { bgColor: "bg-gray-50", textColor: "text-gray-700", borderColor: "border-l-gray-500" };
    };

    const getPlatformIcon = (platform: string, className = "w-4 h-4") => {
        const icons: Record<string, React.ReactElement> = {
            EMAIL: <Mail className={className} />,
            SMS: <MessageSquare className={className} />,
            FACEBOOK: <Facebook className={className} />,
            INSTAGRAM: <Instagram className={className} />,
            LINKEDIN: <Linkedin className={className} />,
            YOUTUBE: <Youtube className={className} />,
        };
        return icons[platform] || <CalendarIcon className={className} />;
    };

    // Generate calendar days
    const getCalendarDays = () => {
        if (view === 'month') {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const startDate = new Date(firstDay);
            startDate.setDate(startDate.getDate() - firstDay.getDay());

            const days = [];
            const current = new Date(startDate);

            for (let i = 0; i < 42; i++) {
                days.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }

            return days;
        } else if (view === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 0 });
            const end = endOfWeek(currentDate, { weekStartsOn: 0 });
            return eachDayOfInterval({ start, end });
        } else {
            return [currentDate];
        }
    };

    // Get posts for a specific day
    const getPostsForDay = (date: Date) => {
        return posts.filter(post =>
            isSameDay(new Date(post.scheduledPostTime), date)
        ).sort((a, b) =>
            new Date(a.scheduledPostTime).getTime() - new Date(b.scheduledPostTime).getTime()
        );
    };

    // Upcoming posts
    const upcomingPosts = useMemo(() => {
        const now = new Date();
        const today = startOfDay(now);

        const categorized = {
            today: [] as Post[],
            tomorrow: [] as Post[],
            later: [] as Post[]
        };

        posts.forEach(post => {
            const postDate = new Date(post.scheduledPostTime);
            if (isToday(postDate)) {
                categorized.today.push(post);
            } else if (isTomorrow(postDate)) {
                categorized.tomorrow.push(post);
            } else if (isAfter(postDate, today)) {
                categorized.later.push(post);
            }
        });

        categorized.today.sort((a, b) => new Date(a.scheduledPostTime).getTime() - new Date(b.scheduledPostTime).getTime());
        categorized.tomorrow.sort((a, b) => new Date(a.scheduledPostTime).getTime() - new Date(b.scheduledPostTime).getTime());
        categorized.later.sort((a, b) => new Date(a.scheduledPostTime).getTime() - new Date(b.scheduledPostTime).getTime());

        return categorized;
    }, [posts]);

    // Handle post click
    const handlePostClick = (post: Post) => {
        setSelectedPost(post);
        setShowDetailSlider(true);
    };

    // Navigation
    const goToPrevious = () => {
        const newDate = new Date(currentDate);
        if (view === 'month') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else if (view === 'week') {
            newDate.setDate(newDate.getDate() - 7);
        } else {
            newDate.setDate(newDate.getDate() - 1);
        }
        setCurrentDate(newDate);
    };

    const goToNext = () => {
        const newDate = new Date(currentDate);
        if (view === 'month') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else if (view === 'week') {
            newDate.setDate(newDate.getDate() + 7);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    // Render post card
    const renderPostCard = (post: Post, isLargeView = false) => {
        const config = getPlatformConfig(post.type);
        const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
        const firstMedia = hasMedia ? post.mediaUrls![0] : null;
        const isVideo = firstMedia?.match(/\.(mp4|webm|ogg|mov)$/i);

        // Day view uses horizontal layout with larger cards
        if (isLargeView) {
            return (
                <Card
                    key={post.id}
                    className={cn(
                        "cursor-pointer hover:shadow-lg transition-all border-l-4 overflow-hidden mb-3",
                        config.borderColor
                    )}
                    onClick={() => handlePostClick(post)}
                >
                    <div className="flex gap-4 p-4">
                        {/* Media Preview - Fixed size */}
                        {hasMedia && (
                            <div className="relative w-32 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                                {isVideo ? (
                                    <div className="flex items-center justify-center h-full bg-gray-900/5">
                                        <Video className="w-8 h-8 text-gray-400" />
                                    </div>
                                ) : (
                                    <Image
                                        src={firstMedia!}
                                        alt="Post media"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                )}
                                {post.mediaUrls!.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                        +{post.mediaUrls!.length - 1}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className={cn("p-2 rounded-full", config.bgColor, config.textColor)}>
                                    {getPlatformIcon(post.type, "w-4 h-4")}
                                </div>
                                <span className="text-sm font-semibold text-gray-600">
                                    {format(new Date(post.scheduledPostTime), 'h:mm a')}
                                </span>
                            </div>
                            <h3 className="text-base font-bold text-gray-900 line-clamp-2">
                                {post.subject || post.message?.substring(0, 60) || 'Untitled Post'}
                            </h3>
                            {post.message && (
                                <p className="text-sm text-gray-600 line-clamp-2">
                                    {post.message.substring(0, 120)}...
                                </p>
                            )}
                        </div>
                    </div>
                </Card>
            );
        }

        // Month/Week view uses compact vertical layout
        return (
            <Card
                key={post.id}
                className={cn(
                    "cursor-pointer hover:shadow-md transition-all border-l-4 overflow-hidden mb-2",
                    config.borderColor
                )}
                onClick={() => handlePostClick(post)}
            >
                {hasMedia && (
                    <div className="relative w-full h-20 bg-gray-100">
                        {isVideo ? (
                            <div className="flex items-center justify-center h-full bg-gray-900/5">
                                <Video className="w-6 h-6 text-gray-400" />
                            </div>
                        ) : (
                            <Image
                                src={firstMedia!}
                                alt="Post media"
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        )}
                        {post.mediaUrls!.length > 1 && (
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                +{post.mediaUrls!.length - 1}
                            </div>
                        )}
                    </div>
                )}

                <div className="p-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <div className={cn("p-1 rounded-full", config.bgColor, config.textColor)}>
                            {getPlatformIcon(post.type, "w-3 h-3")}
                        </div>
                        <span className="text-xs font-medium text-gray-500">
                            {format(new Date(post.scheduledPostTime), 'h:mm a')}
                        </span>
                    </div>
                    <p className="text-xs font-medium line-clamp-2">
                        {post.subject || post.message?.substring(0, 40) || 'Untitled Post'}
                    </p>
                </div>
            </Card>
        );
    };

    const calendarDays = getCalendarDays();

    return (
        <div className="flex gap-6">
            {/* Main Calendar */}
            <div className="flex-1 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold ">
                            {view === 'month' && format(currentDate, 'MMMM yyyy')}
                            {view === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`}
                            {view === 'day' && format(currentDate, 'MMMM d, yyyy')}
                        </h2>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="cursor-pointer" onClick={goToPrevious}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="cursor-pointer" onClick={goToToday}>
                                Today
                            </Button>
                            <Button variant="outline" size="icon" className="cursor-pointer" onClick={goToNext}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button
                            variant={view === 'month' ? 'default' : 'outline'}
                            size="sm" className="cursor-pointer"
                            onClick={() => setView('month')}
                        >
                            Month
                        </Button>
                        <Button
                            variant={view === 'week' ? 'default' : 'outline'}
                            size="sm" className="cursor-pointer"
                            onClick={() => setView('week')}
                        >
                            Week
                        </Button>
                        <Button
                            variant={view === 'day' ? 'default' : 'outline'}
                            size="sm" className="cursor-pointer"
                            onClick={() => setView('day')}
                        >
                            Day
                        </Button>
                    </div>
                </div>

                {/* Calendar Grid - Fixed Height */}
                <div className="bg-white rounded-lg border shadow-sm" style={{ height: '600px' }}>
                    {/* Day Headers */}
                    <div className={cn("grid border-b bg-gray-50", view === 'month' ? 'grid-cols-7' : view === 'week' ? 'grid-cols-7' : 'grid-cols-1')}>
                        {view === 'month' && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="p-2 text-center text-sm font-semibold text-gray-700 border-r last:border-r-0">
                                {day}
                            </div>
                        ))}
                        {view === 'week' && calendarDays.map((day, index) => (
                            <div key={index} className="p-2 text-center border-r last:border-r-0">
                                <div className="text-xs text-gray-500">{format(day, 'EEE')}</div>
                                <div className={cn("text-lg font-bold", isToday(day) && "text-blue-600")}>{format(day, 'd')}</div>
                            </div>
                        ))}
                        {view === 'day' && (
                            <div className="p-3 text-center">
                                <div className="text-sm text-gray-500">{format(currentDate, 'EEEE')}</div>
                                <div className="text-2xl font-bold">{format(currentDate, 'MMMM d, yyyy')}</div>
                            </div>
                        )}
                    </div>

                    {/* Calendar Days */}
                    <div className={cn("grid", view === 'month' ? 'grid-cols-7' : view === 'week' ? 'grid-cols-7' : 'grid-cols-1')} style={{ height: view === 'day' ? 'calc(600px - 65px)' : 'calc(600px - 41px)' }}>
                        {calendarDays.map((day, index) => {
                            const dayPosts = getPostsForDay(day);
                            const isCurrentMonth = view !== 'month' || day.getMonth() === currentDate.getMonth();
                            const isCurrentDay = isToday(day);

                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "border-r border-b last:border-r-0 p-1.5 overflow-hidden",
                                        !isCurrentMonth && "bg-gray-50/50",
                                        isCurrentDay && "bg-blue-50/30"
                                    )}
                                >
                                    {view === 'month' && (
                                        <div className={cn(
                                            "text-sm font-semibold mb-1 px-1",
                                            isCurrentDay && "text-blue-600",
                                            !isCurrentMonth && "text-gray-400"
                                        )}>
                                            {format(day, 'd')}
                                        </div>
                                    )}

                                    <ScrollArea className={view === 'month' ? "h-[calc(100%-24px)]" : "h-full"}>
                                        <div className="space-y-1">
                                            {dayPosts.map(post => renderPostCard(post, view === 'day'))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Upcoming Sidebar */}
            <div className="w-80 space-y-4 bg-white rounded-lg border p-5  shadow-sm">
                <h3 className="text-lg font-semibold">Upcoming</h3>
                <ScrollArea className="h-[600px]">
                    <div className="space-y-6">
                        {/* Today */}
                        {upcomingPosts.today.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Today</h4>
                                <div className="space-y-2">
                                    {upcomingPosts.today.map(post => {
                                        const config = getPlatformConfig(post.type);
                                        return (
                                            <Card
                                                key={post.id}
                                                className="cursor-pointer w-[80%] hover:shadow-md transition-shadow"
                                                onClick={() => handlePostClick(post)}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex items-start gap-2">
                                                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0", config.bgColor, config.textColor)}>
                                                            {getPlatformIcon(post.type, "w-4 h-4")}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">
                                                                {post.subject || post.message?.substring(0, 30) || 'Untitled Post'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {format(new Date(post.scheduledPostTime), 'h:mm a')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tomorrow */}
                        {upcomingPosts.tomorrow.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Tomorrow</h4>
                                <div className="space-y-2">
                                    {upcomingPosts.tomorrow.map(post => {
                                        const config = getPlatformConfig(post.type);
                                        return (
                                            <Card
                                                key={post.id}
                                                className="cursor-pointer w-[80%] hover:shadow-md transition-shadow"
                                                onClick={() => handlePostClick(post)}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex items-start gap-2">
                                                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0", config.bgColor, config.textColor)}>
                                                            {getPlatformIcon(post.type, "w-4 h-4")}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">
                                                                {post.subject || post.message?.substring(0, 30) || 'Untitled Post'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {format(new Date(post.scheduledPostTime), 'h:mm a')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Later */}
                        {upcomingPosts.later.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Later</h4>
                                <div className="space-y-2">
                                    {upcomingPosts.later.slice(0, 5).map(post => {
                                        const config = getPlatformConfig(post.type);
                                        return (
                                            <Card
                                                key={post.id}
                                                className="cursor-pointer w-[80%] hover:shadow-md transition-shadow"
                                                onClick={() => handlePostClick(post)}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex items-start gap-2">
                                                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0", config.bgColor, config.textColor)}>
                                                            {getPlatformIcon(post.type, "w-4 h-4")}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">
                                                                {post.subject || post.message?.substring(0, 30) || 'Untitled Post'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {format(new Date(post.scheduledPostTime), 'MMM d, h:mm a')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {upcomingPosts.today.length === 0 && upcomingPosts.tomorrow.length === 0 && upcomingPosts.later.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">No upcoming posts</p>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Detail Slider */}
            <Sheet open={showDetailSlider} onOpenChange={setShowDetailSlider}>
                <SheetContent className="w-[450px] sm:w-[500px] overflow-y-auto p-0">
                    <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                        <div className="flex items-center gap-3">
                            {selectedPost && (
                                <div className={cn("p-2 rounded-lg", getPlatformConfig(selectedPost.type).bgColor)}>
                                    {getPlatformIcon(selectedPost.type, "w-5 h-5")}
                                </div>
                            )}
                            <h2 className="text-xl font-bold">Post Details</h2>
                        </div>
                    </div>

                    {selectedPost && (
                        <div className="px-6 py-6 space-y-8">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Platform</label>
                                <p className={cn("text-lg font-semibold", getPlatformConfig(selectedPost.type).textColor)}>
                                    {selectedPost.type}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Scheduled Time</label>
                                <p className="text-base font-semibold text-gray-900">
                                    {format(new Date(selectedPost.scheduledPostTime), 'MMMM d, yyyy h:mm a')}
                                </p>
                            </div>

                            {selectedPost.mediaUrls && selectedPost.mediaUrls.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                                        Media ({selectedPost.mediaUrls.length})
                                    </label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedPost.mediaUrls.map((url, index) => {
                                            const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
                                            return (
                                                <div
                                                    key={index}
                                                    className="relative w-full rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-50 shadow-sm hover:shadow-md transition-shadow"
                                                    style={{ aspectRatio: '1/1' }}
                                                >
                                                    {isVideo ? (
                                                        <video
                                                            src={url}
                                                            className="w-full h-full object-cover"
                                                            controls
                                                            preload="metadata"
                                                        />
                                                    ) : (
                                                        <Image
                                                            src={url}
                                                            alt={`Media ${index + 1}`}
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {selectedPost.subject && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Subject</label>
                                    <p className="text-lg font-bold text-gray-900 leading-relaxed">
                                        {selectedPost.subject}
                                    </p>
                                </div>
                            )}

                            {selectedPost.message && (
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Message</label>
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                                        <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {selectedPost.message}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowDetailSlider(false)}
                                >
                                    Close
                                </Button>
                                {/* <Button
                                    className="flex-1"
                                    onClick={() => {
                                        window.location.href = `/organisation/campaigns/${selectedPost.id}/posts/${selectedPost.id}/edit`;
                                    }}
                                >
                                    Edit Post
                                </Button> */}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
