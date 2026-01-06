"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationItem } from "@/components/notifications/notification-item";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";

interface Notification {
    id: number;
    message: string;
    type: string | null;
    isRead: boolean;
    createdAt: string;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async (page: number = 1, filterType: 'all' | 'unread' = filter) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/notifications?page=${page}&limit=20&filter=${filterType}`);
            const data = await response.json();

            if (data.isSuccess) {
                setNotifications(data.data.notifications);
                setTotalPages(data.data.totalPages);
                setTotalCount(data.data.totalCount);
                setUnreadCount(data.data.unreadCount);
                setCurrentPage(page);
            } else {
                toast.error(data.message || 'Failed to fetch notifications');
            }
        } catch (error) {
            toast.error('Failed to fetch notifications');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications(1, filter);
    }, [filter]);

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
                setTotalCount(prev => prev - 1);
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
        if (unreadCount === 0) {
            toast.info('No unread notifications');
            return;
        }

        setIsMarkingAllRead(true);
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
            setIsMarkingAllRead(false);
        }
    };

    return (
        <div className="container mx-auto p-6 ">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">Notifications</CardTitle>
                            <CardDescription>
                                {totalCount} total notification{totalCount !== 1 ? 's' : ''}, {unreadCount} unread
                            </CardDescription>
                        </div>
                        {unreadCount > 0 && (
                            <Button
                                onClick={handleMarkAllAsRead}
                                disabled={isMarkingAllRead}
                                variant="outline"
                            >
                                {isMarkingAllRead && <Loader2 className="mr-2 size-4 animate-spin" />}
                                Mark All as Read
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
                        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="unread">
                                Unread {unreadCount > 0 && `(${unreadCount})`}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value={filter} className="space-y-3">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="size-8 animate-spin text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">Loading notifications...</p>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <Bell className="size-16 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">No notifications</p>
                                    <p className="text-sm">
                                        {filter === 'unread' ? "You're all caught up!" : "You don't have any notifications yet"}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {notifications.map((notification) => (
                                        <NotificationItem
                                            key={notification.id}
                                            id={notification.id}
                                            message={notification.message}
                                            type={notification.type as any}
                                            isRead={notification.isRead}
                                            createdAt={notification.createdAt}
                                            onMarkAsRead={handleMarkAsRead}
                                            onDelete={handleDelete}
                                        />
                                    ))}

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 pt-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fetchNotifications(currentPage - 1)}
                                                disabled={currentPage === 1 || isLoading}
                                            >
                                                Previous
                                            </Button>
                                            <span className="text-sm text-muted-foreground">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fetchNotifications(currentPage + 1)}
                                                disabled={currentPage === totalPages || isLoading}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
