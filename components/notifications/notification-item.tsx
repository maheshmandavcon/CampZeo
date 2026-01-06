"use client";

import { useState } from "react";
import { getNotificationIcon, getRelativeTime, NotificationType } from "@/lib/notification-utils";
import { cn } from "@/lib/utils";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface NotificationItemProps {
    id: number;
    message: string;
    type: NotificationType;
    isRead: boolean;
    createdAt: Date | string;
    compact?: boolean;
    onMarkAsRead?: (id: number) => void;
    onDelete?: (id: number) => void;
}

export function NotificationItem({
    id,
    message,
    type,
    isRead,
    createdAt,
    compact = false,
    onMarkAsRead,
    onDelete,
}: NotificationItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const iconConfig = getNotificationIcon(type);
    const Icon = iconConfig.icon;

    // Helper to clean and truncate the message
    const processMessage = (msg: string) => {
        let displayMsg = msg;
        let isTechnical = false;

        // Check for JSON-like error messages
        if (msg.includes('error":') || msg.includes('code":')) {
            isTechnical = true;
            try {
                // Try to find if there's a JSON block and parse it for a better message
                const jsonMatch = msg.match(/\{.*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const errorObj = JSON.parse(jsonStr);
                    const specificError =
                        errorObj.error?.message ||
                        errorObj.message ||
                        errorObj.error_user_msg ||
                        (typeof errorObj.error === 'string' ? errorObj.error : null);

                    if (specificError) {
                        displayMsg = msg.replace(jsonStr, specificError);
                    }
                }
            } catch (e) {
                // If parsing fails, just use the original message
            }
        }

        const needsTruncation = displayMsg.length > 120;
        const truncated = needsTruncation && !isExpanded
            ? displayMsg.substring(0, 120) + "..."
            : displayMsg;

        return { displayMsg: truncated, hasMore: needsTruncation || isTechnical, isTechnical };
    };

    const { displayMsg, hasMore } = processMessage(message);

    const handleClick = () => {
        if (!isRead && onMarkAsRead) {
            onMarkAsRead(id);
        }
    };

    return (
        <div
            className={cn(
                "flex items-start gap-3 p-3 rounded-lg transition-colors border",
                !isRead && "bg-blue-50/50 border-blue-200",
                isRead && "bg-background border-border hover:bg-muted/50",
                !compact && "cursor-pointer",
                compact && "text-sm"
            )}
            onClick={handleClick}
        >
            {/* Icon */}
            <div className={cn("rounded-full p-2 flex-shrink-0", iconConfig.bgColor)}>
                <Icon className={cn("size-4", iconConfig.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-sm break-words",
                    !isRead && "font-medium text-foreground",
                    isRead && "text-muted-foreground"
                )}>
                    {displayMsg}
                </p>
                {hasMore && (
                    <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800 mt-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        {isExpanded ? (
                            <span className="flex items-center gap-1">Show less <ChevronUp className="size-3" /></span>
                        ) : (
                            <span className="flex items-center gap-1">Show more <ChevronDown className="size-3" /></span>
                        )}
                    </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                    {getRelativeTime(createdAt)}
                </p>
            </div>

            {/* Unread indicator & Delete button */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {!isRead && (
                    <div className="size-2 rounded-full bg-blue-600" title="Unread" />
                )}
                {onDelete && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Notification</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete this notification? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(id);
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </div>
    );
}
