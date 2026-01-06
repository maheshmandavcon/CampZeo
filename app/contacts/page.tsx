'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Search,
    Download,
    Trash2,
    Edit,
    Eye,
    ChevronLeft,
    ChevronRight,
    Plus,
    Loader2,
    Mail,
    Phone,
    MessageSquare,
    Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Contact {
    id: number;
    contactName: string | null;
    contactEmail: string | null;
    contactMobile: string | null;
    contactWhatsApp: string | null;
    createdAt: string;
    updatedAt: string;
    campaigns: {
        id: number;
        name: string;
    }[];
}

interface Campaign {
    id: number;
    name: string;
}

export default function ContactListPage() {
    const router = useRouter();

    // State
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalContacts, setTotalContacts] = useState(0);
    const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteContactId, setDeleteContactId] = useState<number | null>(null);
    const [showQuickView, setShowQuickView] = useState(false);
    const [quickViewContact, setQuickViewContact] = useState<Contact | null>(null);
    const [exporting, setExporting] = useState(false);

    // Fetch contacts
    const fetchContacts = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: itemsPerPage.toString(),
                ...(searchQuery && { search: searchQuery }),
                ...(selectedCampaign !== 'all' && { campaignId: selectedCampaign }),
            });

            const response = await fetch(`/api/contacts?${params}`);
            if (!response.ok) throw new Error('Failed to fetch contacts');

            const data = await response.json();
            setContacts(data.contacts);
            setTotalPages(data.pagination.totalPages);
            setTotalContacts(data.pagination.total);
        } catch (error) {
            console.error('Error fetching contacts:', error);
            toast.error('Failed to fetch contacts');
        } finally {
            setLoading(false);
        }
    };

    // Fetch campaigns for filter
    const fetchCampaigns = async () => {
        try {
            const response = await fetch('/api/campaigns');
            if (!response.ok) throw new Error('Failed to fetch campaigns');

            const data = await response.json();
            setCampaigns(data.campaigns || []);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    useEffect(() => {
        fetchContacts();
        setSelectedContacts([]);
    }, [currentPage, itemsPerPage, searchQuery, selectedCampaign]);

    // Handle select all
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedContacts(contacts.map(c => c.id));
        } else {
            setSelectedContacts([]);
        }
    };

    // Handle individual select
    const handleSelectContact = (contactId: number, checked: boolean) => {
        if (checked) {
            setSelectedContacts([...selectedContacts, contactId]);
        } else {
            setSelectedContacts(selectedContacts.filter(id => id !== contactId));
        }
    };

    // Handle delete single contact
    const handleDeleteContact = async (contactId: number) => {
        try {
            const response = await fetch(`/api/contacts/${contactId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete contact');

            toast.success('Contact deleted successfully');
            fetchContacts();
            setShowDeleteDialog(false);
            setDeleteContactId(null);
        } catch (error) {
            console.error('Error deleting contact:', error);
            toast.error('Failed to delete contact');
        }
    };

    // Handle bulk delete
    const handleBulkDelete = async () => {
        try {
            const response = await fetch('/api/contacts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactIds: selectedContacts }),
            });

            if (!response.ok) throw new Error('Failed to delete contacts');

            const data = await response.json();
            toast.success(data.message);
            fetchContacts();
            setSelectedContacts([]);
            setShowDeleteDialog(false);
        } catch (error) {
            console.error('Error deleting contacts:', error);
            toast.error('Failed to delete contacts');
        }
    };

    // Handle export
    const handleExport = async (exportSelected = false) => {
        try {
            setExporting(true);
            const params = new URLSearchParams({
                ...(searchQuery && { search: searchQuery }),
                ...(selectedCampaign !== 'all' && { campaignId: selectedCampaign }),
                ...(exportSelected && selectedContacts.length > 0 && {
                    contactIds: selectedContacts.join(',')
                }),
            });

            const response = await fetch(`/api/contacts/export?${params}`);
            if (!response.ok) throw new Error('Failed to export contacts');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('Contacts exported successfully');
        } catch (error) {
            console.error('Error exporting contacts:', error);
            toast.error('Failed to export contacts');
        } finally {
            setExporting(false);
        }
    };

    // Handle quick view
    const handleQuickView = (contact: Contact) => {
        setQuickViewContact(contact);
        setShowQuickView(true);
    };

    const allSelected = contacts.length > 0 && selectedContacts.length === contacts.length;
    const someSelected = selectedContacts.length > 0 && selectedContacts.length < contacts.length;

    return (
        <div className="p-6">
            <div className=" mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your contact list and campaign associations
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button className="cursor-pointer" onClick={() => router.push('/contacts/import')} variant="outline">
                            <Upload className="size-4 mr-2" />
                            Import Contacts
                        </Button>
                        <Button className="cursor-pointer" onClick={() => router.push('/contacts/new')}>
                            <Plus className="size-4 mr-2" />
                            Add Contact
                        </Button>
                    </div>
                </div>

                {/* Filters and Actions */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, email, or mobile..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9"
                                />
                            </div>

                            {/* Campaign Filter */}
                            <Select
                                value={selectedCampaign}
                                onValueChange={(value) => {
                                    setSelectedCampaign(value);
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="w-[200px] border  border-gray-200">
                                    <SelectValue placeholder="Filter by campaign" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Campaigns</SelectItem>
                                    {campaigns.map((campaign) => (
                                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                                            {campaign.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Export */}
                            <Button
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => handleExport(false)}
                                disabled={exporting}
                            >
                                {exporting ? (
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="size-4 mr-2" />
                                )}
                                Export All
                            </Button>
                        </div>

                        {/* Bulk Actions */}
                        {selectedContacts.length > 0 && (
                            <div className="mt-4 flex items-center gap-3 p-3 bg-muted rounded-lg">
                                <span className="text-sm font-medium">
                                    {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
                                </span>
                                <Button
                                    size="sm"
                                    className="cursor-pointer"
                                    variant="outline"
                                    onClick={() => handleExport(true)}
                                    disabled={exporting}
                                >
                                    <Download className="size-4 mr-2" />
                                    Export Selected
                                </Button>
                                <Button
                                    size="sm"
                                    className="cursor-pointer"
                                    variant="destructive"
                                    onClick={() => setShowDeleteDialog(true)}
                                >
                                    <Trash2 className="size-4 mr-2" />
                                    Delete Selected
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contact List</CardTitle>
                        <CardDescription>
                            Showing {contacts.length} of {totalContacts} contacts
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">No contacts found</p>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow >
                                                <TableHead className="w-[50px]">
                                                    <Checkbox
                                                        checked={allSelected}
                                                        onCheckedChange={handleSelectAll}
                                                        aria-label="Select all"
                                                        className={someSelected ? 'data-[state=checked]:bg-muted' : ''}
                                                    />
                                                </TableHead>
                                                <TableHead >Name</TableHead>
                                                <TableHead >Email</TableHead>
                                                <TableHead >Mobile</TableHead>
                                                <TableHead >Campaigns</TableHead>
                                                <TableHead >Created</TableHead>
                                                <TableHead  >Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {contacts.map((contact) => (
                                                <TableRow key={contact.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedContacts.includes(contact.id)}
                                                            onCheckedChange={(checked) =>
                                                                handleSelectContact(contact.id, checked as boolean)
                                                            }
                                                            aria-label={`Select ${contact.contactName}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {contact.contactName || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {contact.contactEmail ? (
                                                            <div className="flex items-center gap-2">
                                                                <Mail className="size-4 text-muted-foreground" />
                                                                <span className="text-sm">{contact.contactEmail}</span>
                                                            </div>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {contact.contactMobile ? (
                                                            <div className="flex items-center gap-2">
                                                                <Phone className="size-4 text-muted-foreground" />
                                                                <span className="text-sm">{contact.contactMobile}</span>
                                                            </div>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {contact.campaigns.length > 0 ? (
                                                                contact.campaigns.slice(0, 2).map((campaign) => (
                                                                    <Badge key={campaign.id} variant="secondary" className="text-xs">
                                                                        {campaign.name}
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-sm text-muted-foreground">No campaigns</span>
                                                            )}
                                                            {contact.campaigns.length > 2 && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    +{contact.campaigns.length - 2}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {new Date(contact.createdAt).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell >
                                                        <div className="flex items-center  gap-2">
                                                            <Button
                                                                size="sm"
                                                                className="cursor-pointer"
                                                                variant="ghost"
                                                                onClick={() => handleQuickView(contact)}
                                                            >
                                                                <Eye className="size-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="cursor-pointer"
                                                                onClick={() => router.push(`/contacts/${contact.id}/edit`)}
                                                            >
                                                                <Edit className="size-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="cursor-pointer"
                                                                onClick={() => {
                                                                    setDeleteContactId(contact.id);
                                                                    setShowDeleteDialog(true);
                                                                }}
                                                            >
                                                                <Trash2 className="size-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination */}
                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Rows per page:</span>
                                        <Select
                                            value={itemsPerPage.toString()}
                                            onValueChange={(value) => {
                                                setItemsPerPage(parseInt(value));
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <SelectTrigger className="w-[80px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5</SelectItem>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                className="cursor-pointer"
                                                variant="outline"
                                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="size-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="cursor-pointer"
                                                variant="outline"
                                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronRight className="size-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedContacts.length > 1
                                ? `This will permanently delete ${selectedContacts.length} contacts. This action cannot be undone.`
                                : 'This will permanently delete this contact. This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteContactId(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (selectedContacts.length > 1) {
                                    handleBulkDelete();
                                } else if (deleteContactId) {
                                    handleDeleteContact(deleteContactId);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Quick View Modal */}
            <Dialog open={showQuickView} onOpenChange={setShowQuickView}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Contact Details</DialogTitle>
                        <DialogDescription>View contact information and associations</DialogDescription>
                    </DialogHeader>
                    {quickViewContact && (
                        <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                                    <p className="mt-1 text-sm font-medium">
                                        {quickViewContact.contactName || 'Not provided'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                                    <p className="mt-1 text-sm">
                                        {quickViewContact.contactEmail || 'Not provided'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Mobile</label>
                                    <p className="mt-1 text-sm">
                                        {quickViewContact.contactMobile || 'Not provided'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">WhatsApp</label>
                                    <p className="mt-1 text-sm">
                                        {quickViewContact.contactWhatsApp || 'Not provided'}
                                    </p>
                                </div>
                            </div>

                            {/* Campaigns */}
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">
                                    Associated Campaigns
                                </label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {quickViewContact.campaigns.length > 0 ? (
                                        quickViewContact.campaigns.map((campaign) => (
                                            <Badge key={campaign.id} variant="secondary">
                                                {campaign.name}
                                            </Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No campaigns associated</p>
                                    )}
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                                    <p className="mt-1 text-sm">
                                        {new Date(quickViewContact.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                                    <p className="mt-1 text-sm">
                                        {new Date(quickViewContact.updatedAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4 border-t">
                                <Button
                                    onClick={() => {
                                        router.push(`/contacts/${quickViewContact.id}/edit`);
                                        setShowQuickView(false);
                                    }}
                                >
                                    <Edit className="size-4 mr-2" />
                                    Edit Contact
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowQuickView(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}