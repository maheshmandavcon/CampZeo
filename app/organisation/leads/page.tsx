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
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/leads');
            if (!response.ok) throw new Error('Failed to fetch leads');
            const data = await response.json();
            setLeads(data.leads);
        } catch (error) {
            console.error('Error fetching leads:', error);
            toast.error('Failed to load leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

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

        // Simple CSV export
        const headers = ['Date', 'Platform ID', 'Campaign', 'Status', 'Data'];
        const csvRows = [
            headers.join(','),
            ...leads.map(lead => [
                new Date(lead.createdAt).toLocaleDateString(),
                lead.metaLeadId,
                lead.campaign?.name || 'N/A',
                lead.status,
                JSON.stringify(lead.data).replace(/,/g, ';') // Avoid CSV break
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

    const formatLeadData = (data: any) => {
        // Facebook lead data usually comes in a specific format
        // We try to find common fields
        const email = data.email || Object.values(data).find(v => typeof v === 'string' && v.includes('@'));
        const name = data.full_name || data.name || data.first_name || 'Prospect';
        const phone = data.phone_number || data.phone;

        return { email, name, phone };
    };

    if (loading && leads.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
                    <p className="text-muted-foreground">
                        View and manage leads captured from Meta Lead Ads.
                    </p>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <CardTitle>Leads Overview</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search leads..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
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
                                {filteredLeads.length === 0 ? (
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
        </div>
    );
}
