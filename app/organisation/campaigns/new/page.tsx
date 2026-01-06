'use client';

import { useState, useEffect } from 'react';
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
import { ArrowLeft, Loader2, Save, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Contact {
    id: number;
    contactName: string | null;
    contactEmail: string | null;
    contactMobile: string | null;
}

export default function NewCampaignPage() {
    const router = useRouter();

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

    // Contacts state
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    // Fetch contacts
    useEffect(() => {
        const fetchContacts = async () => {
            try {
                setLoadingContacts(true);
                const response = await fetch('/api/contacts?limit=1000');
                if (!response.ok) throw new Error('Failed to fetch contacts');

                const data = await response.json();
                setContacts(data.contacts);
            } catch (error) {
                console.error('Error fetching contacts:', error);
                toast.error('Failed to fetch contacts');
            } finally {
                setLoadingContacts(false);
            }
        };

        fetchContacts();
    }, []);

    // Filter contacts based on search
    const filteredContacts = contacts.filter((contact) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            contact.contactName?.toLowerCase().includes(searchLower) ||
            contact.contactEmail?.toLowerCase().includes(searchLower) ||
            contact.contactMobile?.includes(searchQuery)
        );
    });

    // Handle select all
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedContacts(filteredContacts.map((c) => c.id));
        } else {
            setSelectedContacts([]);
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

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name.trim()) {
            toast.error('Please enter a campaign name');
            return;
        }

        if (!startDate || !endDate) {
            toast.error('Please select start and end dates');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            toast.error('End date must be after start date');
            return;
        }

        try {
            setSaving(true);

            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: description || null,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    contactIds: selectedContacts,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create campaign');
            }

            toast.success('Campaign created successfully');
            router.push('/organisation/campaigns');
        } catch (error) {
            console.error('Error creating campaign:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create campaign');
        } finally {
            setSaving(false);
        }
    };

    const allSelected = filteredContacts.length > 0 && selectedContacts.length === filteredContacts.length;
    const someSelected = selectedContacts.length > 0 && selectedContacts.length < filteredContacts.length;

    return (
        <div className="p-6">
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
                                <h1 className="text-3xl font-bold tracking-tight">New Campaign</h1>
                                <p className="text-muted-foreground mt-1">
                                    Create a new marketing campaign
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
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
                                        className='border border-gray-300 rounded-md'
                                            id="description"
                                            placeholder="Enter campaign description (optional)"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={3}
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
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="endDate">End Date *</Label>
                                            <Input
                                                id="endDate"
                                                type="datetime-local"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                required
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
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search contacts..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>

                                    {/* Contacts Table */}
                                    {loadingContacts ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="size-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : filteredContacts.length === 0 ? (
                                        <div className="text-center py-12">
                                            <p className="text-muted-foreground">
                                                {searchQuery ? 'No contacts found matching your search' : 'No contacts available'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border max-h-[400px] overflow-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[50px]">
                                                            <Checkbox
                                                                checked={allSelected}
                                                                onCheckedChange={handleSelectAll}
                                                                aria-label="Select all"
                                                                className={someSelected ? 'data-[state=checked]:bg-muted' : ''}
                                                            />
                                                        </TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Email</TableHead>
                                                        <TableHead>Mobile</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredContacts.map((contact) => (
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
                                <Button type="submit" className='cursor-pointer' disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="size-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="size-4 mr-2" />
                                            Create Campaign
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
    );
}
