'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
    id: number;
    name: string;
}

export default function NewContactPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(true);

    const [formData, setFormData] = useState({
        contactName: '',
        contactEmail: '',
        contactMobile: '',
        contactWhatsApp: '',
        campaignIds: [] as number[],
    });

    // Fetch campaigns
    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                const response = await fetch('/api/campaigns');
                if (!response.ok) throw new Error('Failed to fetch campaigns');

                const data = await response.json();
                setCampaigns(data.campaigns || []);
            } catch (error) {
                console.error('Error fetching campaigns:', error);
                toast.error('Failed to load campaigns');
            } finally {
                setLoadingCampaigns(false);
            }
        };

        fetchCampaigns();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Client-side validation
        if (!formData.contactName && !formData.contactEmail && !formData.contactMobile) {
            toast.error('Please provide at least name, email, or mobile');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.contactEmail && !emailRegex.test(formData.contactEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }

        // Phone validation
        const phoneRegex = /^\+?[\d\s\-()]+$/;
        if (formData.contactMobile) {
            const digits = formData.contactMobile.replace(/\D/g, '');
            if (!phoneRegex.test(formData.contactMobile) || digits.length < 10) {
                toast.error('Please enter a valid mobile number (at least 10 digits)');
                return;
            }
        }

        if (formData.contactWhatsApp) {
            const digits = formData.contactWhatsApp.replace(/\D/g, '');
            if (!phoneRegex.test(formData.contactWhatsApp) || digits.length < 10) {
                toast.error('Please enter a valid WhatsApp number (at least 10 digits)');
                return;
            }
        }

        try {
            setLoading(true);
            const response = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    // Duplicate contact
                    toast.error(data.error || 'A contact with this information already exists', {
                        description: `Duplicate ${data.field || 'field'} detected`
                    });
                } else {
                    throw new Error(data.error || 'Failed to create contact');
                }
                return;
            }

            toast.success('Contact created successfully');
            router.push('/contacts');
        } catch (error) {
            console.error('Error creating contact:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create contact');
        } finally {
            setLoading(false);
        }
    };

    const handleCampaignToggle = (campaignId: number, checked: boolean) => {
        if (checked) {
            setFormData({
                ...formData,
                campaignIds: [...formData.campaignIds, campaignId],
            });
        } else {
            setFormData({
                ...formData,
                campaignIds: formData.campaignIds.filter(id => id !== campaignId),
            });
        }
    };

    return (
        <div className="min-h-screen bg-background">

            <div className="flex">

                <main className="flex-1 p-6">
                    <div className=" mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <Button
                                className="cursor-pointer"
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push('/contacts')}
                            >
                                <ArrowLeft className="size-4" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Add New Contact</h1>
                                <p className="text-muted-foreground mt-1">
                                    Create a new contact and associate with campaigns
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contact Information</CardTitle>
                                    <CardDescription>
                                        Fill in the contact details below
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="contactName">
                                            Full Name <span className="text-muted-foreground text-xs">(recommended)</span>
                                        </Label>
                                        <Input
                                            id="contactName"
                                            value={formData.contactName}
                                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                            placeholder="John Doe"
                                        />
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-2">
                                        <Label htmlFor="contactEmail">
                                            Email Address <span className="text-muted-foreground text-xs">(recommended)</span>
                                        </Label>
                                        <Input
                                            id="contactEmail"
                                            type="email"
                                            value={formData.contactEmail}
                                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                            placeholder="john@example.com"
                                        />
                                    </div>

                                    {/* Mobile */}
                                    <div className="space-y-2">
                                        <Label htmlFor="contactMobile">
                                            Mobile Number <span className="text-muted-foreground text-xs">(recommended)</span>
                                        </Label>
                                        <Input
                                            id="contactMobile"
                                            type="tel"
                                            value={formData.contactMobile}
                                            onChange={(e) => setFormData({ ...formData, contactMobile: e.target.value })}
                                            placeholder="+1234567890"
                                        />
                                    </div>

                                    {/* WhatsApp */}
                                    <div className="space-y-2">
                                        <Label htmlFor="contactWhatsApp">
                                            WhatsApp Number <span className="text-muted-foreground text-xs">(optional)</span>
                                        </Label>
                                        <Input
                                            id="contactWhatsApp"
                                            type="tel"
                                            value={formData.contactWhatsApp}
                                            onChange={(e) => setFormData({ ...formData, contactWhatsApp: e.target.value })}
                                            placeholder="+1234567890"
                                        />
                                    </div>

                                    {/* Campaign Association */}
                                    <div className="space-y-3">
                                        <Label>Associate with Campaigns</Label>
                                        {loadingCampaigns ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="size-4 animate-spin" />
                                                Loading campaigns...
                                            </div>
                                        ) : campaigns.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No campaigns available</p>
                                        ) : (
                                            <div className="space-y-2 border rounded-lg p-4 max-h-64 overflow-y-auto">
                                                {campaigns.map((campaign) => (
                                                    <div key={campaign.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`campaign-${campaign.id}`}
                                                            checked={formData.campaignIds.includes(campaign.id)}
                                                            onCheckedChange={(checked) =>
                                                                handleCampaignToggle(campaign.id, checked as boolean)
                                                            }
                                                            className="border-gray-400"
                                                        />
                                                        <label
                                                            htmlFor={`campaign-${campaign.id}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                        >
                                                            {campaign.name}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-4 border-t">
                                        <Button type="submit" className="cursor-pointer" disabled={loading}>
                                            {loading ? (
                                                <>
                                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                'Create Contact'
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            className="cursor-pointer"
                                            variant="outline"
                                            onClick={() => router.push('/contacts')}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}
