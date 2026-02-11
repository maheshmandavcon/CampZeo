'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, Users, RefreshCw, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LeadFormModal } from './_components/lead-form-modal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function LeadsAnalyticsPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [boostedPosts, setBoostedPosts] = useState<any[]>([]);
    const [selectedPostId, setSelectedPostId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Lead Form Creation State
    const [facebookPages, setFacebookPages] = useState<any[]>([]);
    const [loadingPages, setLoadingPages] = useState(false);
    const [selectedPageId, setSelectedPageId] = useState<string>('');
    const [selectedPageAccessToken, setSelectedPageAccessToken] = useState<string>('');
    const [isLeadFormModalOpen, setIsLeadFormModalOpen] = useState(false);

    const fetchFacebookPages = async () => {
        try {
            setLoadingPages(true);
            const response = await fetch('/api/socialmedia/facebook/pages');
            if (response.ok) {
                const data = await response.json();
                setFacebookPages(data.pages || []);
                if (data.pages?.length === 1) {
                    setSelectedPageId(data.pages[0].id);
                    setSelectedPageAccessToken(data.pages[0].access_token);
                }
            }
        } catch (error) {
            console.error('Error fetching Facebook pages:', error);
        } finally {
            setLoadingPages(false);
        }
    };

    const fetchLeadsData = async (postId?: string, isInit = false) => {
        try {
            if (isInit) setLoading(true);
            else setRefreshing(true);

            let url = `/api/analytics/leads?init=${isInit}`;
            if (postId) url += `&boosted_post_id=${postId}`;

            const response = await fetch(url);
            const contentType = response.headers.get("content-type");

            if (!response.ok) {
                if (contentType && contentType.includes("application/json")) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to fetch leads');
                } else {
                    const text = await response.text();
                    console.error('Non-JSON error response:', text.substring(0, 200));
                    throw new Error(`Server returned an error (${response.status}). Please check logs.`);
                }
            }

            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();
                if (isInit) {
                    setBoostedPosts(data.boostedPosts || []);
                    if (data.boostedPosts?.length > 0 && !selectedPostId) {
                        setSelectedPostId(data.boostedPosts[0].id);
                    }
                }
                setLeads(data.leads || []);
            } else {
                const text = await response.text();
                console.error('Expected JSON but got:', text.substring(0, 200));
                throw new Error('Received invalid data format from server');
            }
        } catch (error) {
            console.error('Error fetching leads:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load leads');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchLeadsData(undefined, true);
        fetchFacebookPages();
    }, []);

    useEffect(() => {
        if (selectedPostId && !loading) {
            fetchLeadsData(selectedPostId);
        }
    }, [selectedPostId]);

    const handleExport = async (format: 'csv' | 'xlsx') => {
        if (!selectedPostId) {
            toast.error('Please select a boosted post first');
            return;
        }

        try {
            setExporting(true);
            const response = await fetch(`/api/analytics/leads/export?boosted_post_id=${selectedPostId}&format=${format}`);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_export_${selectedPostId}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(`Leads exported to ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export leads');
        } finally {
            setExporting(false);
        }
    };

    const getFieldValue = (lead: any, fieldName: string) => {
        const field = lead.field_data.find((f: any) => f.name.toLowerCase().includes(fieldName.toLowerCase()));
        return field ? field.values.join(', ') : 'N/A';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading Leads Management...</p>
            </div>
        );
    }

    const selectedPage = facebookPages.find(p => p.id === selectedPageId);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Leads Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Track and manage leads from your Facebook boosted posts.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="cursor-pointer" variant="outline">
                                <Plus className="size-4 mr-2" />
                                Create Lead Form
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Create Lead Form</DialogTitle>
                                <DialogDescription>
                                    Select a Facebook Page to create a new lead form for.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Facebook Page</Label>
                                    <Select value={selectedPageId} onValueChange={(val) => {
                                        setSelectedPageId(val);
                                        const p = facebookPages.find(page => page.id === val);
                                        if (p) setSelectedPageAccessToken(p.access_token);
                                    }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a Page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {loadingPages ? (
                                                <div className="p-2 text-center"><Loader2 className="size-4 animate-spin inline mr-2" /> Loading...</div>
                                            ) : facebookPages.length === 0 ? (
                                                <div className="p-2 text-center text-sm text-muted-foreground">No pages found. Connect Facebook in Settings.</div>
                                            ) : (
                                                facebookPages.map((page) => (
                                                    <SelectItem key={page.id} value={page.id}>
                                                        {page.name}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    className="w-full"
                                    disabled={!selectedPageId || !selectedPageAccessToken}
                                    onClick={() => setIsLeadFormModalOpen(true)}
                                >
                                    Continue to Form Design
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button
                        variant="outline"
                        onClick={() => fetchLeadsData(selectedPostId)}
                        disabled={refreshing}
                        className="cursor-pointer"
                    >
                        <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <div className="flex gap-1">
                        <Button
                            variant="default"
                            onClick={() => handleExport('csv')}
                            disabled={exporting || !selectedPostId}
                            className="cursor-pointer"
                        >
                            <Download className="size-4 mr-2" />
                            CSV
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => handleExport('xlsx')}
                            disabled={exporting || !selectedPostId}
                            className="cursor-pointer"
                        >
                            <Download className="size-4 mr-2" />
                            Excel
                        </Button>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle>Select Boosted Post</CardTitle>
                            <CardDescription>Filter leads by active Facebook ads.</CardDescription>
                        </div>
                        <div className="w-full md:w-[300px]">
                            <Select value={selectedPostId} onValueChange={setSelectedPostId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an Ad" />
                                </SelectTrigger>
                                <SelectContent>
                                    {boostedPosts.length === 0 ? (
                                        <SelectItem value="none" disabled>No active boosted posts found</SelectItem>
                                    ) : (
                                        boostedPosts.map((post) => (
                                            <SelectItem key={post.id} value={post.id}>
                                                {post.name} ({post.status})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {leads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-3 bg-muted rounded-full mb-4">
                                <Users className="size-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium">No Leads Found</h3>
                            <p className="text-muted-foreground max-w-md mx-auto mt-1">
                                {selectedPostId
                                    ? "There are no leads currently associated with this boosted post."
                                    : "Please select a boosted post from the dropdown to view leads."}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lead Name</TableHead>
                                        <TableHead>Contact Details</TableHead>
                                        <TableHead>Ad Set Source</TableHead>
                                        <TableHead>Timestamp</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leads.map((lead) => (
                                        <TableRow key={lead.id}>
                                            <TableCell className="font-medium">
                                                {getFieldValue(lead, 'full_name') || getFieldValue(lead, 'name') || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs space-y-1">
                                                    <div className="font-semibold">{getFieldValue(lead, 'email')}</div>
                                                    <div className="text-muted-foreground">{getFieldValue(lead, 'phone_number')}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {lead.adset_name || 'Individual Ad'}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {format(new Date(lead.created_time), 'MMM d, h:mm a')}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{leads.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Form</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-medium truncate">
                            {leads.length > 0 ? (leads[0].form_id || 'N/A') : 'N/A'}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Source Platform</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            <Users className="size-5 text-blue-600" />
                            Facebook
                        </div>
                    </CardContent>
                </Card>
            </div>

            {selectedPageId && selectedPageAccessToken && (
                <LeadFormModal
                    isOpen={isLeadFormModalOpen}
                    onClose={() => setIsLeadFormModalOpen(false)}
                    pageId={selectedPageId}
                    pageAccessToken={selectedPageAccessToken}
                    onSuccess={(form: any) => {
                        toast.success(`Form "${form.name}" created successfully!`);
                        setIsLeadFormModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
