"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationItem } from "./notification-item";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
    id: number;
    message: string;
    type: string | null;
    isRead: boolean;
    createdAt: string;
}

export function NotificationBell() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await fetch('/api/notifications?page=1&limit=5');
            const data = await response.json();

            if (data.isSuccess) {
                setNotifications(data.data.notifications);
                setUnreadCount(data.data.unreadCount);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        fetchNotifications();

        // Poll for new notifications
        const pollInterval = isOpen ? 10000 : 30000; // 10s when open, 30s when closed
        const interval = setInterval(fetchNotifications, pollInterval);

        return () => clearInterval(interval);
    }, [mounted, isOpen, fetchNotifications]);

    const handleMarkAsRead = async (id: number) => {
        try {
            const response = await fetch(`/api/notifications/${id}`, {
                method: 'PATCH',
            });

            const data = await response.json();

            if (data.isSuccess) {
                setNotifications(prev =>
                    prev.map(n => n.id === id ? { ...n, isRead: true } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            } else {
                toast.error(data.message || 'Failed to mark notification as read');
            }
        } catch (error) {
            toast.error('Failed to mark notification as read');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const response = await fetch(`/api/notifications/${id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.isSuccess) {
                const deletedNotification = notifications.find(n => n.id === id);
                setNotifications(prev => prev.filter(n => n.id !== id));
                if (deletedNotification && !deletedNotification.isRead) {
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }
                toast.success('Notification deleted');
            } else {
                toast.error(data.message || 'Failed to delete notification');
            }
        } catch (error) {
            toast.error('Failed to delete notification');
        }
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/notifications', {
                method: 'PATCH',
            });

            const data = await response.json();

            if (data.isSuccess) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
                toast.success('All notifications marked as read');
            } else {
                toast.error(data.message || 'Failed to mark all as read');
            }
        } catch (error) {
            toast.error('Failed to mark all as read');
        } finally {
            setIsLoading(false);
        }
    };

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="relative">
                <Bell className="size-5" />
            </Button>
        );
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="size-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 size-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-medium">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[400px] max-w-[calc(100vw-2rem)] p-0">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            disabled={isLoading}
                            className="text-xs h-7"
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[400px]">
                    <div className="p-2 space-y-2">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Bell className="size-12 mb-2 opacity-20" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    id={notification.id}
                                    message={notification.message}
                                    type={notification.type as any}
                                    isRead={notification.isRead}
                                    createdAt={notification.createdAt}
                                    compact
                                    onMarkAsRead={handleMarkAsRead}
                                    onDelete={handleDelete}
                                />
                            ))
                        )}
                    </div>
                </ScrollArea>

                {notifications.length > 0 && (
                    <div className="p-2 border-t">
                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                setIsOpen(false);
                                router.push('/organisation/notifications');
                            }}
                        >
                            View All Notifications
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
