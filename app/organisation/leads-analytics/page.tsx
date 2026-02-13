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
import { Download, Loader2, Users, RefreshCw, AlertCircle, Plus, Eye, Copy } from 'lucide-react';
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
import { Input } from '@/components/ui/input';

export default function LeadsAnalyticsPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [boostedPosts, setBoostedPosts] = useState<any[]>([]);
    const [leadForms, setLeadForms] = useState<any[]>([]);
    const [selectedPostId, setSelectedPostId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingLeadForms, setLoadingLeadForms] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Lead Form Creation State
    const [facebookPages, setFacebookPages] = useState<any[]>([]);
    const [loadingPages, setLoadingPages] = useState(false);
    const [selectedPageId, setSelectedPageId] = useState<string>('');
    const [selectedPageAccessToken, setSelectedPageAccessToken] = useState<string>('');
    const [isLeadFormModalOpen, setIsLeadFormModalOpen] = useState(false);

    // Form Details State
    const [selectedFormForDetails, setSelectedFormForDetails] = useState<any>(null);
    const [isFormDetailsOpen, setIsFormDetailsOpen] = useState(false);

    // Pagination and Filtering for Lead Forms
    const [leadFormsPage, setLeadFormsPage] = useState(1);
    const [leadFormsFilter, setLeadFormsFilter] = useState('');
    const [leadFormsStatusFilter, setLeadFormsStatusFilter] = useState<string>('all');
    const leadFormsPerPage = 5;

    // Form duplication state
    const [formToDuplicate, setFormToDuplicate] = useState<any>(null);

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

    const fetchLeadForms = async (pageId: string, pageAccessToken: string) => {
        try {
            setLoadingLeadForms(true);
            const response = await fetch(`/api/socialmedia/facebook/lead-forms?pageId=${pageId}&pageAccessToken=${pageAccessToken}`);
            if (response.ok) {
                const data = await response.json();
                setLeadForms(data.forms || []);
            }
        } catch (error) {
            console.error('Error fetching lead forms:', error);
            toast.error('Failed to fetch lead forms');
        } finally {
            setLoadingLeadForms(false);
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
        if (selectedPageId && selectedPageAccessToken) {
            fetchLeadForms(selectedPageId, selectedPageAccessToken);
        }
    }, [selectedPageId, selectedPageAccessToken]);

    useEffect(() => {
        if (selectedPostId && !loading) {
            fetchLeadsData(selectedPostId);
        }
    }, [selectedPostId]);

    const handleExport = async (format: 'csv' | 'xlsx') => {
        const exportId = selectedPostId || (leads.length > 0 ? leads[0].form_id : null);

        if (!exportId) {
            toast.error('No lead data available to export');
            return;
        }

        try {
            setExporting(true);
            const response = await fetch(`/api/analytics/leads/export?boosted_post_id=${exportId}&format=${format}`);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_export_${exportId}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
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
                            disabled={exporting || leads.length === 0}
                            className="cursor-pointer"
                        >
                            <Download className="size-4 mr-2" />
                            CSV
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => handleExport('xlsx')}
                            disabled={exporting || leads.length === 0}
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
                            <CardTitle>Facebook Lead Forms</CardTitle>
                            <CardDescription>Available lead forms for the selected Facebook Page.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {loadingLeadForms && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                        </div>
                    </div>
                    {/* Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <Input
                            placeholder="Search by form name..."
                            value={leadFormsFilter}
                            onChange={(e) => {
                                setLeadFormsFilter(e.target.value);
                                setLeadFormsPage(1); // Reset to first page on filter change
                            }}
                            className="max-w-xs"
                        />
                        <Select value={leadFormsStatusFilter} onValueChange={(val) => {
                            setLeadFormsStatusFilter(val);
                            setLeadFormsPage(1); // Reset to first page on filter change
                        }}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="ARCHIVED">Archived</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {(() => {
                        // Apply filters
                        const filteredForms = leadForms.filter(form => {
                            const matchesName = form.name.toLowerCase().includes(leadFormsFilter.toLowerCase());
                            const matchesStatus = leadFormsStatusFilter === 'all' || form.status === leadFormsStatusFilter;
                            return matchesName && matchesStatus;
                        });

                        // Apply pagination
                        const totalPages = Math.ceil(filteredForms.length / leadFormsPerPage);
                        const startIndex = (leadFormsPage - 1) * leadFormsPerPage;
                        const paginatedForms = filteredForms.slice(startIndex, startIndex + leadFormsPerPage);

                        if (filteredForms.length === 0) {
                            return (
                                <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/20 rounded-lg border border-dashed">
                                    <p className="text-sm text-muted-foreground">
                                        {leadForms.length === 0 ? 'No lead forms found for this page.' : 'No forms match your filters.'}
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Form Name</TableHead>
                                                <TableHead>Form ID</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Created Date</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedForms.map((form) => (
                                                <TableRow key={form.id}>
                                                    <TableCell className="font-medium">{form.name}</TableCell>
                                                    <TableCell className="text-xs font-mono">{form.id}</TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${form.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                                                            }`}>
                                                            {form.status}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {format(new Date(), 'MMM d, yyyy')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedFormForDetails(form);
                                                                    setIsFormDetailsOpen(true);
                                                                }}
                                                            >
                                                                <Eye className="size-4 mr-2" />
                                                                View Details
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    try {
                                                                        // Fetch full form details
                                                                        const response = await fetch(
                                                                            `/api/socialmedia/facebook/lead-forms?pageId=${selectedPageId}&pageAccessToken=${selectedPageAccessToken}&formId=${form.id}`
                                                                        );

                                                                        if (!response.ok) {
                                                                            throw new Error('Failed to fetch form details');
                                                                        }

                                                                        const data = await response.json();

                                                                        // Open modal with form data for duplication
                                                                        setIsLeadFormModalOpen(true);
                                                                        // We'll pass the form data via a new state
                                                                        setFormToDuplicate(data.form);
                                                                    } catch (error) {
                                                                        console.error('Error fetching form details:', error);
                                                                        toast.error('Failed to load form details');
                                                                    }
                                                                }}
                                                            >
                                                                <Copy className="size-4 mr-2" />
                                                                Duplicate
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4">
                                        <p className="text-sm text-muted-foreground">
                                            Showing {startIndex + 1} to {Math.min(startIndex + leadFormsPerPage, filteredForms.length)} of {filteredForms.length} forms
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setLeadFormsPage(prev => Math.max(1, prev - 1))}
                                                disabled={leadFormsPage === 1}
                                            >
                                                Previous
                                            </Button>
                                            <span className="text-sm">
                                                Page {leadFormsPage} of {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setLeadFormsPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={leadFormsPage === totalPages}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </CardContent>
            </Card>

            <Dialog open={isFormDetailsOpen} onOpenChange={setIsFormDetailsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Lead Form Details</DialogTitle>
                        <DialogDescription>
                            Review the structure and questions of this lead form.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedFormForDetails && (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <Label className="text-muted-foreground">Form Name</Label>
                                    <p className="font-medium">{selectedFormForDetails.name}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Form ID</Label>
                                    <p className="font-mono">{selectedFormForDetails.id}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-semibold italic text-blue-600">Form Questions</Label>
                                <div className="space-y-2">
                                    {selectedFormForDetails.questions?.map((q: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-muted/30 rounded-lg border border-muted/50">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">{q.label}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tight ">{q.type.replace('_', ' ')}</p>
                                                </div>
                                                {q.options && (
                                                    <div className="flex flex-wrap gap-1 justify-end">
                                                        {q.options.map((opt: any, oIdx: number) => (
                                                            <span key={oIdx} className="px-1.5 py-0.5 bg-background border rounded text-[10px]">
                                                                {opt.label || opt}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedFormForDetails.questions || selectedFormForDetails.questions.length === 0) && (
                                        <p className="text-sm text-muted-foreground italic">No specific questions found for this form.</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 text-sm border-t pt-4">
                                {selectedFormForDetails.privacy_policy_url && (
                                    <div>
                                        <Label className="text-muted-foreground">Privacy Policy URL</Label>
                                        <p className="truncate text-blue-600">{selectedFormForDetails.privacy_policy_url}</p>
                                    </div>
                                )}
                                {selectedFormForDetails.follow_up_action_url && (
                                    <div>
                                        <Label className="text-muted-foreground">Follow-up Action URL</Label>
                                        <p className="truncate text-blue-600">{selectedFormForDetails.follow_up_action_url}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

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
                    onClose={() => {
                        setIsLeadFormModalOpen(false);
                        setFormToDuplicate(null);
                    }}
                    pageId={selectedPageId}
                    pageAccessToken={selectedPageAccessToken}
                    initialData={formToDuplicate}
                    onSuccess={(form: any) => {
                        setIsLeadFormModalOpen(false);
                        setFormToDuplicate(null);
                        if (selectedPageId && selectedPageAccessToken) {
                            fetchLeadForms(selectedPageId, selectedPageAccessToken);
                        }
                    }}
                />
            )}
        </div>
    );
}
