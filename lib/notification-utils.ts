import {
    Bell,
    CheckCircle,
    XCircle,
    Send,
    CreditCard,
    Calendar,
    AlertCircle,
    Megaphone,
    FileText
} from 'lucide-react';

export type NotificationType =
    | 'CAMPAIGN_SENT'
    | 'POST_PUBLISHED'
    | 'PAYMENT_RECEIVED'
    | 'SUBSCRIPTION_UPDATED'
    | 'SYSTEM_BROADCAST'
    | 'SYSTEM_ALERT'
    | null;

export interface NotificationIconConfig {
    icon: any;
    color: string;
    bgColor: string;
}

export function getNotificationIcon(type: NotificationType): NotificationIconConfig {
    switch (type) {
        case 'CAMPAIGN_SENT':
            return {
                icon: Megaphone,
                color: 'text-blue-600',
                bgColor: 'bg-blue-100'
            };
        case 'POST_PUBLISHED':
            return {
                icon: Send,
                color: 'text-green-600',
                bgColor: 'bg-green-100'
            };
        case 'PAYMENT_RECEIVED':
            return {
                icon: CreditCard,
                color: 'text-emerald-600',
                bgColor: 'bg-emerald-100'
            };
        case 'SUBSCRIPTION_UPDATED':
            return {
                icon: Calendar,
                color: 'text-purple-600',
                bgColor: 'bg-purple-100'
            };
        case 'SYSTEM_BROADCAST':
            return {
                icon: Bell,
                color: 'text-orange-600',
                bgColor: 'bg-orange-100'
            };
        case 'SYSTEM_ALERT':
            return {
                icon: AlertCircle,
                color: 'text-red-600',
                bgColor: 'bg-red-100'
            };
        default:
            return {
                icon: FileText,
                color: 'text-gray-600',
                bgColor: 'bg-gray-100'
            };
    }
}

export function getRelativeTime(date: Date | string): string {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

export function formatNotificationMessage(message: string, maxLength: number = 100): string {
    if (message.length <= maxLength) {
        return message;
    }
    return message.substring(0, maxLength) + '...';
}
