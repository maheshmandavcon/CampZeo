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
    Trash2,
    Edit,
    ChevronLeft,
    ChevronRight,
    Plus,
    Loader2,
    Calendar,
    FileText,
    Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';


interface Campaign {
    id: number;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    createdAt: string;
    _count: {
        posts: number;
        contacts: number;
    };
}

export default function CampaignsPage() {
    const router = useRouter();

    // State
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCampaigns, setTotalCampaigns] = useState(0);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteCampaignId, setDeleteCampaignId] = useState<number | null>(null);
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

    // Fetch campaigns
    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: itemsPerPage.toString(),
                ...(searchQuery && { search: searchQuery }),
            });

            const response = await fetch(`/api/campaigns?${params}`);
            if (!response.ok) throw new Error('Failed to fetch campaigns');

            const data = await response.json();
            setCampaigns(data.campaigns);
            setTotalPages(data.pagination.totalPages);
            setTotalCampaigns(data.pagination.total);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            toast.error('Failed to fetch campaigns');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, [currentPage, itemsPerPage, searchQuery]);

    // Handle delete campaign
    const handleDeleteCampaign = async (campaignId: number) => {
        try {
            const response = await fetch(`/api/campaigns/${campaignId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete campaign');

            toast.success('Campaign deleted successfully');
            fetchCampaigns();
            setShowDeleteDialog(false);
            setDeleteCampaignId(null);
        } catch (error) {
            console.error('Error deleting campaign:', error);
            toast.error('Failed to delete campaign');
        }
    };

    // Handle add campaign
    const handleAddCampaign = () => {
        setEditingCampaign(null);
        router.push('/organisation/campaigns/new');
    };

    // Handle edit campaign
    const handleEditCampaign = (campaign: Campaign) => {
        router.push(`/organisation/campaigns/${campaign.id}/edit`);
    };

    // Handle manage posts
    const handleManagePosts = (campaign: Campaign) => {
        router.push(`/organisation/campaigns/${campaign.id}/posts`);
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Check if campaign is active
    const isCampaignActive = (campaign: Campaign) => {
        const now = new Date();
        const start = new Date(campaign.startDate);
        const end = new Date(campaign.endDate);
        return now >= start && now <= end;
    };

    // Get campaign status
    const getCampaignStatus = (campaign: Campaign) => {
        const now = new Date();
        const start = new Date(campaign.startDate);
        const end = new Date(campaign.endDate);

        if (now < start) return { label: 'Scheduled', variant: 'secondary' as const };
        if (now > end) return { label: 'Completed', variant: 'outline' as const };
        return { label: 'Active', variant: 'default' as const };
    };

    return (
        <div className="p-6">
            <div className=" mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your marketing campaigns and posts
                        </p>
                    </div>
                    <Button className='cursor-pointer' onClick={handleAddCampaign}>
                        <Plus className="size-4 mr-2" />
                        New Campaign
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search campaigns..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Campaign List</CardTitle>
                        <CardDescription>
                            Showing {campaigns.length} of {totalCampaigns} campaigns
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : campaigns.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="size-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">No campaigns found</p>
                                <Button onClick={handleAddCampaign} className="  cursor-pointer mt-4">
                                    <Plus className="size-4 mr-2" />
                                    Create Your First Campaign
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Campaign Name</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Duration</TableHead>
                                                <TableHead>Contacts</TableHead>
                                                <TableHead>Posts</TableHead>
                                                        <TableHead >Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {campaigns.map((campaign) => {
                                                const status = getCampaignStatus(campaign);
                                                return (
                                                    <TableRow key={campaign.id}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium">{campaign.name}</p>
                                                                {campaign.description && (
                                                                    <p className="text-sm text-muted-foreground line-clamp-1">
                                                                        {campaign.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={status.variant}>
                                                                {status.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Calendar className="size-4 text-muted-foreground" />
                                                                <span>
                                                                    {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Users className="size-4 text-muted-foreground" />
                                                                <span>{campaign._count.contacts}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="size-4 text-muted-foreground" />
                                                                <span>{campaign._count.posts}</span>
                                                            </div>
                                                        </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center  gap-2">
                                                                        <Button
                                                                            className='cursor-pointer'
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => handleManagePosts(campaign)}
                                                                        >
                                                                            {campaign._count.posts === 0 ? 'Add Post' : 'Posts'}
                                                                        </Button>
                                                                        <Button
                                                                        className='cursor-pointer'
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleEditCampaign(campaign)}
                                                                        >
                                                                            <Edit className="size-4" />
                                                                        </Button>
                                                                        <Button
                                                                        className='cursor-pointer'
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => {
                                                                                setDeleteCampaignId(campaign.id);
                                                                                setShowDeleteDialog(true);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="size-4 text-destructive" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                    </TableRow>
                                                );
                                            })}
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
                                                className='cursor-pointer'
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="size-4" />
                                            </Button>
                                            <Button
                                                className='cursor-pointer'
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
                            This will permanently delete this campaign and all associated posts. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteCampaignId(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteCampaignId) {
                                    handleDeleteCampaign(deleteCampaignId);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
