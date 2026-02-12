'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Download,
    Search,
    Filter,
    RefreshCcw,
    Loader2,
    Mail,
    Phone,
    User,
    Calendar,
    ExternalLink,
    FileText,
    Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Lead {
    id: number;
    metaLeadId: string;
    formId: string | null;
    data: any;
    status: string;
    createdAt: string;
    campaign?: {
        name: string;
    };
}

interface LeadForm {
    id: string;
    name: string;
    status: string;
    created_time: string;
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [leadForms, setLeadForms] = useState<LeadForm[]>([]);
    const [facebookPages, setFacebookPages] = useState<any[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string>('');
    const [selectedPageAccessToken, setSelectedPageAccessToken] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [loadingForms, setLoadingForms] = useState(false);
    const [loadingPages, setLoadingPages] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('leads');

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/leads');
            if (!response.ok) throw new Error('Failed to fetch leads');
            const data = await response.json();
            setLeads(data.leads || []);
        } catch (error) {
            console.error('Error fetching leads:', error);
            // toast.error('Failed to load leads');
        } finally {
            setLoading(false);
        }
    };

    const fetchFacebookPages = async () => {
        try {
            setLoadingPages(true);
            const response = await fetch('/api/socialmedia/facebook/pages');
            if (response.ok) {
                const data = await response.json();
                setFacebookPages(data.pages || []);
                if (data.pages?.length > 0 && !selectedPageId) {
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

    const fetchLeadForms = async (pageId: string, accessToken: string) => {
        try {
            setLoadingForms(true);
            const response = await fetch(`/api/socialmedia/facebook/lead-forms?pageId=${pageId}&pageAccessToken=${accessToken}`);
            if (!response.ok) throw new Error('Failed to fetch lead forms');
            const data = await response.json();
            setLeadForms(data.forms || []);
        } catch (error) {
            console.error('Error fetching lead forms:', error);
            toast.error('Failed to load lead forms');
        } finally {
            setLoadingForms(false);
        }
    };

    useEffect(() => {
        fetchLeads();
        fetchFacebookPages();
    }, []);

    useEffect(() => {
        if (selectedPageId && selectedPageAccessToken && activeTab === 'forms') {
            fetchLeadForms(selectedPageId, selectedPageAccessToken);
        }
    }, [selectedPageId, selectedPageAccessToken, activeTab]);

    const handleSyncLeads = async () => {
        try {
            setRefreshing(true);
            const response = await fetch('/api/leads/sync', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to sync leads');
            await fetchLeads();
            toast.success('Leads synchronized successfully');
        } catch (error) {
            console.error('Error syncing leads:', error);
            toast.error('Failed to sync leads');
        } finally {
            setRefreshing(false);
        }
    };

    const handleExport = () => {
        if (leads.length === 0) {
            toast.error('No leads to export');
            return;
        }

        const headers = ['Date', 'Platform ID', 'Campaign', 'Status', 'Data'];
        const csvRows = [
            headers.join(','),
            ...leads.map(lead => [
                new Date(lead.createdAt).toLocaleDateString(),
                lead.metaLeadId,
                lead.campaign?.name || 'N/A',
                lead.status,
                JSON.stringify(lead.data).replace(/,/g, ';')
            ].join(','))
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredLeads = leads.filter(lead => {
        const query = searchQuery.toLowerCase();
        const dataString = JSON.stringify(lead.data).toLowerCase();
        return dataString.includes(query) ||
            lead.campaign?.name?.toLowerCase().includes(query) ||
            lead.status.toLowerCase().includes(query);
    });

    const filteredForms = leadForms.filter(form =>
        form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatLeadData = (data: any) => {
        const email = data.email || Object.values(data).find(v => typeof v === 'string' && v.includes('@'));
        const name = data.full_name || data.name || data.first_name || 'Prospect';
        const phone = data.phone_number || data.phone;

        return { email, name, phone };
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
                    <p className="text-muted-foreground">
                        View and manage leads and forms captured from Meta Lead Ads.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'leads' ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleSyncLeads}
                                disabled={refreshing}
                                className="gap-2 cursor-pointer"
                            >
                                <RefreshCcw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Sync Leads
                            </Button>
                            <Button
                                onClick={handleExport}
                                className="gap-2 cursor-pointer"
                            >
                                <Download className="size-4" />
                                Export CSV
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => selectedPageId && selectedPageAccessToken && fetchLeadForms(selectedPageId, selectedPageAccessToken)}
                            disabled={loadingForms || !selectedPageId}
                            className="gap-2 cursor-pointer"
                        >
                            <RefreshCcw className={`size-4 ${loadingForms ? 'animate-spin' : ''}`} />
                            Refresh Forms
                        </Button>
                    )}
                </div>
            </div>

            <Tabs defaultValue="leads" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                    <TabsList>
                        <TabsTrigger value="leads" className="gap-2">
                            <User className="size-4" />
                            Leads
                        </TabsTrigger>
                        <TabsTrigger value="forms" className="gap-2">
                            <FileText className="size-4" />
                            Lead Forms
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        {activeTab === 'forms' && facebookPages.length > 0 && (
                            <div className="w-full sm:w-64">
                                <Select value={selectedPageId} onValueChange={(val) => {
                                    setSelectedPageId(val);
                                    const p = facebookPages.find(page => page.id === val);
                                    if (p) setSelectedPageAccessToken(p.access_token);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Facebook Page" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {facebookPages.map((page) => (
                                            <SelectItem key={page.id} value={page.id}>
                                                {page.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                placeholder={activeTab === 'leads' ? "Search leads..." : "Search forms..."}
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <TabsContent value="leads" className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3 text-center sm:text-left">
                            <CardTitle>Leads Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Lead Info</TableHead>
                                            <TableHead>Campaign</TableHead>
                                            <TableHead>Date Captured</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center">
                                                    <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredLeads.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center">
                                                    No leads found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredLeads.map((lead) => {
                                                const { email, name, phone } = formatLeadData(lead.data);
                                                return (
                                                    <TableRow key={lead.id}>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2 font-medium">
                                                                    <User className="size-3 text-muted-foreground" />
                                                                    {name}
                                                                </div>
                                                                {email && (
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                        <Mail className="size-3" />
                                                                        {email}
                                                                    </div>
                                                                )}
                                                                {phone && (
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                        <Phone className="size-3" />
                                                                        {phone}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="font-normal">
                                                                {lead.campaign?.name || 'Lead Ad'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Calendar className="size-3 text-muted-foreground" />
                                                                {new Date(lead.createdAt).toLocaleDateString()}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={lead.status === 'NEW' ? 'default' : 'secondary'}
                                                                className="font-medium"
                                                            >
                                                                {lead.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" className="cursor-pointer" asChild>
                                                                <a
                                                                    href={`https://business.facebook.com/latest/leads_center`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <ExternalLink className="size-4 mr-2" />
                                                                    View in Meta
                                                                </a>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="forms" className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3 text-center sm:text-left">
                            <CardTitle>Lead Forms</CardTitle>
                            <CardDescription>
                                Active and inactive lead generation forms for your selected Facebook Page.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Form Name</TableHead>
                                            <TableHead>Form ID</TableHead>
                                            <TableHead>Created Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingForms ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center">
                                                    <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredForms.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center">
                                                    {selectedPageId ? "No lead forms found for this page." : "Please select a Facebook Page."}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredForms.map((form) => (
                                                <TableRow key={form.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="size-4 text-primary" />
                                                            {form.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-mono text-muted-foreground">
                                                        {form.id}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {form.created_time ? new Date(form.created_time).toLocaleDateString() : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={form.status === 'ACTIVE' ? 'default' : 'outline'}
                                                            className="font-medium"
                                                        >
                                                            {form.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" className="cursor-pointer" asChild>
                                                            <a
                                                                href={`https://business.facebook.com/latest/instant_forms/forms/${form.id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <ExternalLink className="size-4 mr-2" />
                                                                View Form
                                                            </a>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
