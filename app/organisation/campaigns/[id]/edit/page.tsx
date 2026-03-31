'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Save, Search, Users, Info } from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';

interface Contact {
    id: number;
    contactName: string | null;
    contactEmail: string | null;
    contactMobile: string | null;
}

interface Campaign {
    id: number;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    contacts: { id: number }[];
    _count?: { posts: number; contacts: number };
}

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = React.use(params);
    const searchParams = useSearchParams();
    const campaignId = resolvedParams.id;

    // Check for return-to-share params
    const returnTo = searchParams.get('returnTo');
    const returnPostId = searchParams.get('postId');
    const isContactsOnlyMode = returnTo === 'share' && !!returnPostId;

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [originalStartDate, setOriginalStartDate] = useState('');
    const [originalEndDate, setOriginalEndDate] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

    // Contacts state
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [loadingCampaign, setLoadingCampaign] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 500);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalContacts, setTotalContacts] = useState(0);

    const [saving, setSaving] = useState(false);
    const [selectingAll, setSelectingAll] = useState(false);
    const [hasScheduledPosts, setHasScheduledPosts] = useState(false);

    // Fetch campaign data
    useEffect(() => {
        const fetchCampaign = async () => {
            try {
                setLoadingCampaign(true);
                const response = await fetch(`/api/campaigns/${campaignId}`);
                if (!response.ok) throw new Error('Failed to fetch campaign');

                const data = await response.json();
                const campaign: Campaign = data.campaign;

                setName(campaign.name);
                setDescription(campaign.description || '');
                setSelectedContacts(campaign.contacts.map((c) => c.id));

                // Store original ISO dates for contacts-only mode
                setOriginalStartDate(campaign.startDate);
                setOriginalEndDate(campaign.endDate);

                // Check if campaign has posts (scheduled or otherwise)
                setHasScheduledPosts((campaign._count?.posts || 0) > 0);
            } catch (error) {
                console.error('Error fetching campaign:', error);
                toast.error('Failed to load campaign');
                router.push('/organisation/campaigns');
            } finally {
                setLoadingCampaign(false);
            }
        };

        fetchCampaign();
    }, [campaignId, router]);

    // Set dates separately to avoid hydration issues
    useEffect(() => {
        const fetchDates = async () => {
            try {
                const response = await fetch(`/api/campaigns/${campaignId}`);
                if (!response.ok) return;

                const data = await response.json();
                const campaign: Campaign = data.campaign;

                // Format dates for datetime-local input
                const start = new Date(campaign.startDate);
                const end = new Date(campaign.endDate);
                setStartDate(formatDateTimeLocal(start));
                setEndDate(formatDateTimeLocal(end));
            } catch (error) {
                console.error('Error fetching dates:', error);
            }
        };

        if (!loadingCampaign) {
            fetchDates();
        }
    }, [campaignId, loadingCampaign]);

    // Fetch contacts
    useEffect(() => {
        const fetchContacts = async () => {
            try {
                setLoadingContacts(true);
                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    limit: itemsPerPage.toString(),
                    ...(debouncedSearch && { search: debouncedSearch }),
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
                setLoadingContacts(false);
            }
        };

        fetchContacts();
    }, [currentPage, itemsPerPage, debouncedSearch]);

    // Handle search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset to first page on search
    };

    // Format date for datetime-local input
    const formatDateTimeLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Handle select all (current page)
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSelection = [...selectedContacts];
            contacts.forEach(contact => {
                if (!newSelection.includes(contact.id)) {
                    newSelection.push(contact.id);
                }
            });
            setSelectedContacts(newSelection);
        } else {
            const currentPageIds = contacts.map(c => c.id);
            setSelectedContacts(selectedContacts.filter(id => !currentPageIds.includes(id)));
        }
    };

    // Handle individual select
    const handleSelectContact = (contactId: number, checked: boolean) => {
        if (checked) {
            setSelectedContacts([...selectedContacts, contactId]);
        } else {
            setSelectedContacts(selectedContacts.filter((id) => id !== contactId));
        }
    };

    // Handle select all contacts (across all pages)
    const handleSelectAllTotal = async () => {
        try {
            setSelectingAll(true);
            const response = await fetch('/api/contacts?limit=10000'); // Fetch all IDs
            if (!response.ok) throw new Error('Failed to fetch all contacts');
            const data = await response.json();
            const allIds = data.contacts.map((c: any) => c.id);
            setSelectedContacts(allIds);
            toast.success(`Selected all ${allIds.length} contacts`);
        } catch (error) {
            console.error('Error selecting all contacts:', error);
            toast.error('Failed to select all contacts');
        } finally {
            setSelectingAll(false);
        }
    };

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name.trim()) {
            toast.error('Please enter a campaign name');
            return;
        }

        // Skip date validation in contacts-only mode
        if (!isContactsOnlyMode) {
            if (!endDate) {
                toast.error('Please select an end date');
                return;
            }

            // Only validate start date if it's editable (no scheduled posts)
            if (!hasScheduledPosts && !startDate) {
                toast.error('Please select a start date');
                return;
            }

            const now = new Date();

            if (new Date(endDate) < now) {
                toast.error('End date cannot be in the past');
                return;
            }
            const submissionTime = new Date();
            submissionTime.setSeconds(0, 0);
            if (!hasScheduledPosts && new Date(startDate) < submissionTime) {
                toast.error('Start date cannot be in the past');
                return;
            }

            const effectiveStartDate = hasScheduledPosts ? originalStartDate : startDate;
            if (new Date(effectiveStartDate) > new Date(endDate)) {
                toast.error('End date must be after start date');
                return;
            }
        }

        try {
            setSaving(true);

            const response = await fetch(`/api/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: description || null,
                    startDate: (isContactsOnlyMode || hasScheduledPosts) ? originalStartDate : new Date(startDate).toISOString(),
                    endDate: isContactsOnlyMode ? originalEndDate : new Date(endDate).toISOString(),
                    contactIds: selectedContacts,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update campaign');
            }

            toast.success('Campaign updated successfully');

            // If returning to share dialog, redirect back with params
            if (returnTo === 'share' && returnPostId) {
                router.push(`/organisation/campaigns/${campaignId}/posts?returnTo=share&postId=${returnPostId}`);
            } else {
                router.push('/organisation/campaigns');
            }
        } catch (error) {
            console.error('Error updating campaign:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update campaign');
        } finally {
            setSaving(false);
        }
    };

    const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selectedContacts.includes(c.id));
    const someOnPageSelected = contacts.some((c) => selectedContacts.includes(c.id)) && !allOnPageSelected;

    const minDate = formatDateTimeLocal(new Date());

    if (loadingCampaign) {
        return (
            <div className="min-h-screen bg-background">

                <div className="flex">

                    <main className="flex-1 p-6">
                        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                            <Loader2 className="size-8 animate-spin text-muted-foreground" />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">

            <div className="flex">

                <main className="flex-1 p-6">
                    <div className=" mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <Button
                                className='cursor-pointer'
                                variant="ghost"
                                size="sm"
                                onClick={() => router.back()}
                            >
                                <ArrowLeft className="size-4 mr-2" />
                                Back
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Edit Campaign</h1>
                                <p className="text-muted-foreground mt-1">
                                    Update campaign details and contacts
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Info banner for contacts-only mode */}
                            {isContactsOnlyMode && (
                                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <Info className="size-5 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Select contacts below and save to continue sharing your post.
                                    </p>
                                </div>
                            )}
                            {/* Campaign Details */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Campaign Details</CardTitle>
                                    <CardDescription>
                                        Basic information about your campaign
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Campaign Name *</Label>
                                        <Input
                                            id="name"
                                            placeholder="Enter campaign name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            className='border rounded-md border-gray-300 h-32 resize-none'
                                            id="description"
                                            placeholder="Enter campaign description (optional)"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="startDate">Start Date *</Label>
                                            <Input
                                                id="startDate"
                                                type="datetime-local"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                min={minDate}
                                                required={!isContactsOnlyMode && !hasScheduledPosts}
                                                disabled={isContactsOnlyMode || hasScheduledPosts}
                                                className={(isContactsOnlyMode || hasScheduledPosts) ? 'opacity-60 cursor-not-allowed' : ''}
                                            />
                                            {hasScheduledPosts && !isContactsOnlyMode && (
                                                <p className="text-xs text-muted-foreground">
                                                    Start date is locked because this campaign has scheduled posts.
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="endDate">End Date *</Label>
                                            <Input
                                                id="endDate"
                                                type="datetime-local"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                min={startDate || minDate}
                                                required={!isContactsOnlyMode}
                                                disabled={isContactsOnlyMode}
                                                className={isContactsOnlyMode ? 'opacity-60 cursor-not-allowed' : ''}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Contact Selection */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Select Contacts</CardTitle>
                                    <CardDescription>
                                        Choose contacts to include in this campaign ({selectedContacts.length} selected)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search contacts by name, email, or mobile..."
                                                value={searchQuery}
                                                onChange={handleSearchChange}
                                                className="pl-9"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="sm:w-auto h-10"
                                            onClick={handleSelectAllTotal}
                                            disabled={selectingAll || loadingContacts}
                                        >
                                            {selectingAll ? (
                                                <Loader2 className="size-4 mr-2 animate-spin" />
                                            ) : (
                                                <Users className="size-4 mr-2" />
                                            )}
                                            Select All Contacts
                                        </Button>
                                    </div>

                                    {/* Contacts Table */}
                                    {loadingContacts ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="size-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : contacts.length === 0 ? (
                                        <div className="text-center py-12">
                                            <p className="text-muted-foreground">
                                                {searchQuery ? 'No contacts found matching your search' : 'No contacts available'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="rounded-md border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[50px]">
                                                                <Checkbox
                                                                    checked={allOnPageSelected}
                                                                    onCheckedChange={handleSelectAll}
                                                                    aria-label="Select all"
                                                                    className={someOnPageSelected ? 'data-[state=checked]:bg-muted' : ''}
                                                                />
                                                            </TableHead>
                                                            <TableHead>Name</TableHead>
                                                            <TableHead>Email</TableHead>
                                                            <TableHead>Mobile</TableHead>
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
                                                                <TableCell>{contact.contactEmail || '-'}</TableCell>
                                                                <TableCell>{contact.contactMobile || '-'}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* Pagination */}
                                            <div className="flex items-center justify-between mt-4">
                                                <div className="text-sm text-muted-foreground">
                                                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalContacts)} of {totalContacts} contacts
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        Page {currentPage} of {totalPages}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                            disabled={currentPage === 1}
                                                        >
                                                            <ChevronLeft className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                            disabled={currentPage === totalPages}
                                                        >
                                                            <ChevronRight className="size-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex justify-end gap-4">
                                <Button
                                    className='cursor-pointer'
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.back()}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button className='cursor-pointer' type="submit" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="size-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="size-4 mr-2" />
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}
