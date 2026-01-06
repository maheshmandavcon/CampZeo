"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Organisation {
    id: number;
    name: string;
    email: string | null;
}

export function AdminBroadcastNotification() {
    const [message, setMessage] = useState("");
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [selectedOrgs, setSelectedOrgs] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingOrgs, setIsFetchingOrgs] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchOrganisations();
    }, []);

    const fetchOrganisations = async () => {
        setIsFetchingOrgs(true);
        try {
            const response = await fetch('/api/admin/organisations?pageNumber=1&pageSize=1000&isDeleted=false&isApproved=true');
            const data = await response.json();

            if (data.isSuccess) {
                setOrganisations(data.data.list || []);
            } else {
                toast.error('Failed to fetch organizations');
            }
        } catch (error) {
            toast.error('Failed to fetch organizations');
        } finally {
            setIsFetchingOrgs(false);
        }
    };

    const handleBroadcastToAll = async () => {
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });

            const data = await response.json();

            if (data.isSuccess) {
                toast.success(data.message || 'Notification sent to all organizations');
                setMessage("");
            } else {
                toast.error(data.message || 'Failed to send notification');
            }
        } catch (error) {
            toast.error('Failed to send notification');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBroadcastToSelected = async () => {
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        if (selectedOrgs.length === 0) {
            toast.error('Please select at least one organization');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    organisationIds: selectedOrgs
                }),
            });

            const data = await response.json();

            if (data.isSuccess) {
                toast.success(data.message || `Notification sent to ${selectedOrgs.length} organization(s)`);
                setMessage("");
                setSelectedOrgs([]);
            } else {
                toast.error(data.message || 'Failed to send notification');
            }
        } catch (error) {
            toast.error('Failed to send notification');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleOrganisation = (orgId: number) => {
        setSelectedOrgs(prev =>
            prev.includes(orgId)
                ? prev.filter(id => id !== orgId)
                : [...prev, orgId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedOrgs.length === filteredOrganisations.length) {
            setSelectedOrgs([]);
        } else {
            setSelectedOrgs(filteredOrganisations.map(org => org.id));
        }
    };

    const filteredOrganisations = organisations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (org.email && org.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        
        <Card>
            <CardHeader>
                <CardTitle>Broadcast Notifications</CardTitle>
                <CardDescription>
                    Send notifications to all organizations or specific ones
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Message Input */}
                <div className="space-y-2">
                    <Label htmlFor="broadcast-message">Message *</Label>
                    <Textarea
                        id="broadcast-message"
                        placeholder="Type your notification message here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        className="resize-none border rounded-md border-dark"
                    />
                </div>

                {/* Organization Selection */}
                <div className="space-y-2">
                    <Label>Select Organizations (Optional)</Label>
                    <p className="text-sm text-muted-foreground">
                        Leave unselected to broadcast to all organizations
                    </p>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search organizations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Organization List */}
                    <Card className="border">
                        <CardContent className="p-0">
                            {isFetchingOrgs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    {/* Select All */}
                                    <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
                                        <Checkbox
                                            id="select-all"
                                            checked={selectedOrgs.length === filteredOrganisations.length && filteredOrganisations.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                        <Label htmlFor="select-all" className="cursor-pointer font-medium">
                                            Select All ({selectedOrgs.length} of {filteredOrganisations.length} selected)
                                        </Label>
                                    </div>

                                    {/* Organization List */}
                                    <ScrollArea className="h-[300px]">
                                        {filteredOrganisations.length === 0 ? (
                                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                                <p className="text-sm">No organizations found</p>
                                            </div>
                                        ) : (
                                            <div className="p-2">
                                                {filteredOrganisations.map((org) => (
                                                    <div
                                                        key={org.id}
                                                        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                                                        onClick={() => toggleOrganisation(org.id)}
                                                    >
                                                        <Checkbox
                                                            id={`org-${org.id}`}
                                                            checked={selectedOrgs.includes(org.id)}
                                                            onCheckedChange={() => toggleOrganisation(org.id)}
                                                        />
                                                        <Label
                                                            htmlFor={`org-${org.id}`}
                                                            className="flex-1 cursor-pointer"
                                                        >
                                                            <div className="font-medium">{org.name}</div>
                                                            {org.email && (
                                                                <div className="text-xs text-muted-foreground">{org.email}</div>
                                                            )}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <Button
                        onClick={handleBroadcastToAll}
                        disabled={isLoading || !message.trim()}
                        className="flex-1"
                    >
                        {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                        <MessageSquare className="mr-2 size-4" />
                        Broadcast to All Organizations
                    </Button>
                    <Button
                        onClick={handleBroadcastToSelected}
                        disabled={isLoading || !message.trim() || selectedOrgs.length === 0}
                        variant="secondary"
                        className="flex-1"
                    >
                        {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                        <MessageSquare className="mr-2 size-4" />
                        Broadcast to Selected ({selectedOrgs.length})
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
