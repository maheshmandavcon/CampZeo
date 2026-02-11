"use client";

import React from "react";
import { MetaConversation } from "@/lib/meta-messaging";
import { Facebook, Instagram, User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

interface InboxListProps {
    conversations: MetaConversation[];
    selectedId?: string;
    onSelect: (conv: MetaConversation) => void;
    isLoading: boolean;
}

export function InboxList({ conversations, selectedId, onSelect, isLoading }: InboxListProps) {
    if (isLoading) {
        return (
            <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4 animate-pulse">
                        <div className="w-10 h-10 bg-muted rounded-full" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                No conversations found.
            </div>
        );
    }

    return (
        <div className="divide-y">
            {conversations.map((conv) => (
                <button
                    key={conv.id}
                    onClick={() => onSelect(conv)}
                    className={cn(
                        "w-full p-4 text-left flex items-start space-x-3 hover:bg-muted/50 transition-colors",
                        selectedId === conv.id && "bg-muted shadow-inner border-l-4 border-primary"
                    )}
                >
                    <div className="relative">
                        {conv.participants.data?.[0]?.picture?.data?.url ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden border">
                                <Image
                                    src={conv.participants.data[0].picture.data.url}
                                    alt={conv.participants.data[0].name}
                                    width={40}
                                    height={40}
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-primary" />
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border">
                            {conv.platform === 'FACEBOOK' ? (
                                <Facebook className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                                <Instagram className="w-3.5 h-3.5 text-pink-600" />
                            )}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                            <p className="font-semibold truncate">
                                {conv.participants.data?.[0]?.name || "Meta User"}
                            </p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                {formatDistanceToNow(new Date(conv.updated_time), { addSuffix: false })}
                            </span>
                        </div>
                        <p className={cn(
                            "text-sm truncate",
                            conv.unread_count > 0 ? "font-bold text-foreground" : "text-muted-foreground"
                        )}>
                            {conv.snippet}
                        </p>
                    </div>
                    {conv.unread_count > 0 && (
                        <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    )}
                </button>
            ))}
        </div>
    );
}
