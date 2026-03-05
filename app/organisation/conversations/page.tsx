"use client";

import React, { useState, useEffect } from "react";
import { InboxList } from "./_components/inbox-list";
import { ChatView } from "./_components/chat-view";
import { MetaConversation } from "@/lib/meta-messaging";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConversationsPage() {
    const [conversations, setConversations] = useState<MetaConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<MetaConversation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pageId, setPageId] = useState<string | null>(null);

    const fetchConversations = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/conversations");
            const data = await res.json();
            console.log("Conversations API Response:", data);
            if (data.conversations) {
                setConversations(data.conversations);
            }
            if (data.pageId) {
                setPageId(data.pageId);
            }
        } catch (error) {
            console.error("Failed to fetch conversations:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    return (
        <div className="flex h-[calc(100vh-80px)] bg-background overflow-hidden border rounded-lg m-4">
            {/* Sidebar / Inbox List */}
            <div className="w-80 border-r flex flex-col bg-muted/30">
                <div className="p-4 border-b flex items-center justify-between">
                    <h1 className="text-xl font-bold">Conversations</h1>
                    <button
                        onClick={() => fetchConversations()}
                        disabled={isLoading}
                        className="p-2 hover:bg-muted rounded-full transition-colors disabled:opacity-50"
                        title="Refresh conversations"
                    >
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <InboxList
                        conversations={conversations}
                        selectedId={selectedConversation?.id}
                        onSelect={setSelectedConversation}
                        isLoading={isLoading}
                    />
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-background">
                {selectedConversation ? (
                    <ChatView
                        conversation={selectedConversation}
                        pageId={pageId}
                        onRefresh={() => fetchConversations()}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <p className="text-lg">Select a conversation to start messaging</p>
                            <p className="text-sm">View messages from Facebook and Instagram in one place.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
