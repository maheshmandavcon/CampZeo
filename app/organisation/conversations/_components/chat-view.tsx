"use client";

import React, { useState, useEffect, useRef } from "react";
import { MetaConversation, MetaMessage, isWithin24HourWindow } from "@/lib/meta-messaging";
import { Send, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";

interface ChatViewProps {
    conversation: MetaConversation;
    pageId: string | null;
    onRefresh?: () => void;
}

export function ChatView({ conversation, pageId, onRefresh }: ChatViewProps) {
    const [messages, setMessages] = useState<MetaMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [nextPage, setNextPage] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const canReply = isWithin24HourWindow(conversation.updated_time);
    const participant = conversation.participants.data[0];
    const profilePic = participant.picture?.data?.url;

    useEffect(() => {
        fetchMessages();
    }, [conversation.id]);

    const fetchMessages = async (after?: string) => {
        if (after) setIsLoadingMore(true);
        else setIsLoading(true);

        try {
            const url = `/api/conversations/${conversation.id}/messages${after ? `?after=${after}` : ""}`;
            const res = await fetch(url);
            const data = await res.json();

            if (after) {
                setMessages(prev => [...prev, ...data.messages]);
            } else {
                setMessages(data.messages);
            }

            setNextPage(data.paging?.cursors?.after || null);
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            if (!after) scrollToBottom();
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            const res = await fetch("/api/conversations/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientId: participant.id,
                    message: newMessage,
                    lastMessageTime: conversation.updated_time
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Optimistically add message or refetch
            const sentMsg: MetaMessage = {
                id: Date.now().toString(),
                message: newMessage,
                from: { name: "Me", id: pageId || "me" },
                created_time: new Date().toISOString()
            };
            setMessages(prev => [sentMsg, ...prev]);
            setNewMessage("");
            scrollToBottom();

            // Optionally notify parent to refresh if needed
            if (onRefresh) onRefresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsSending(false);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header */}
            <div className="p-4 border-b bg-muted/10 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {profilePic ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border">
                            <Image
                                src={profilePic}
                                alt={participant.name}
                                fill
                                className="object-cover"
                                unoptimized // Meta URLs can have token issues with next/image optimization sometimes
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                            {participant.name[0]}
                        </div>
                    )}
                    <div>
                        <h2 className="font-semibold">{participant.name}</h2>
                        <p className="text-xs text-muted-foreground capitalize">{conversation.platform.toLowerCase()}</p>
                    </div>
                </div>

                <button
                    onClick={() => fetchMessages()}
                    disabled={isLoading}
                    className="p-2 hover:bg-muted rounded-full transition-colors disabled:opacity-50"
                    title="Refresh messages"
                >
                    <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
                <div ref={messagesEndRef} />

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => {
                            const isMe = pageId ? msg.from.id === pageId : (msg.from.id === "me" || msg.from.name === "Me");
                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex flex-col max-w-[70%]",
                                        isMe ? "self-end items-end" : "self-start items-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "px-4 py-2 rounded-2xl text-sm shadow-sm",
                                            isMe
                                                ? "bg-primary text-primary-foreground rounded-br-none"
                                                : "bg-muted text-foreground rounded-bl-none"
                                        )}
                                    >
                                        {msg.message}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground mt-1">
                                        {format(new Date(msg.created_time), "p")}
                                    </span>
                                </div>
                            );
                        })}

                        {nextPage && (
                            <button
                                onClick={() => fetchMessages(nextPage)}
                                disabled={isLoadingMore}
                                className="self-center text-xs text-primary hover:underline py-2 disabled:no-underline disabled:text-muted-foreground"
                            >
                                {isLoadingMore ? "Loading..." : "Load older messages"}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Reply Area */}
            <div className="p-4 border-t bg-muted/5">
                {!canReply && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2 text-amber-800 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>
                            This conversation is outside the 24-hour messaging window.
                            Meta policy prevents sending standard messages to users who haven't messaged you recently.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSend} className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={!canReply || isSending}
                        placeholder={canReply ? "Type a message..." : "Messaging window closed"}
                        className="flex-1 bg-background border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:bg-muted disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={!canReply || !newMessage.trim() || isSending}
                        className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-colors"
                    >
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </form>
            </div>
        </div>
    );
}
