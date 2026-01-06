"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, Edit, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface Plan {
    id: number;
    name: string;
    description: string | null;
    price: number;
    billingCycle: string;
    features: any;
    isActive: boolean;
    autoRenew: boolean;
    totalSubscriptions: number;
    activeSubscriptions: number;
}

export default function BillingPlansPage() {
    const router = useRouter();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [filteredPlans, setFilteredPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [sortOrder, setSortOrder] = useState("asc");

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
    const [migrationPlanId, setMigrationPlanId] = useState("");
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, [sortBy, sortOrder]);

    useEffect(() => {
        filterAndSortPlans();
    }, [plans, searchTerm, statusFilter]);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                sortBy,
                sortOrder
            });

            const res = await fetch(`/api/admin/billing-plans?${params}`);
            const data = await res.json();

            if (data.isSuccess) {
                setPlans(data.data);
            } else {
                toast.error(data.message || "Failed to fetch plans");
            }
        } catch (error) {
            console.error("Error fetching plans:", error);
            toast.error("Failed to load billing plans");
        } finally {
            setLoading(false);
        }
    };

    const filterAndSortPlans = () => {
        let filtered = [...plans];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(plan =>
                plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply status filter
        if (statusFilter !== "all") {
            filtered = filtered.filter(plan =>
                statusFilter === "active" ? plan.isActive : !plan.isActive
            );
        }

        setFilteredPlans(filtered);
    };

    const handleToggleActive = async (plan: Plan) => {
        try {
            const res = await fetch(`/api/admin/billing-plans/${plan.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !plan.isActive })
            });

            const data = await res.json();

            if (data.isSuccess) {
                toast.success(`Plan ${!plan.isActive ? 'activated' : 'deactivated'} successfully`);
                fetchPlans();
            } else {
                toast.error(data.message || "Failed to update plan");
            }
        } catch (error) {
            console.error("Error toggling plan status:", error);
            toast.error("Failed to update plan status");
        }
    };

    const handleDeleteClick = (plan: Plan) => {
        setPlanToDelete(plan);
        setMigrationPlanId("");
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!planToDelete) return;

        // Validate migration plan if needed
        if (planToDelete.activeSubscriptions > 0 && !migrationPlanId) {
            toast.error("Please select a plan to migrate subscriptions to");
            return;
        }

        try {
            setDeleting(true);
            const body: any = {};
            if (migrationPlanId) {
                body.migrateToPlanId = migrationPlanId;
            }

            const res = await fetch(`/api/admin/billing-plans/${planToDelete.id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.isSuccess) {
                toast.success(data.message);
                setDeleteModalOpen(false);
                setPlanToDelete(null);
                fetchPlans();
            } else {
                toast.error(data.message || "Failed to delete plan");
            }
        } catch (error) {
            console.error("Error deleting plan:", error);
            toast.error("Failed to delete plan");
        } finally {
            setDeleting(false);
        }
    };

    const availableMigrationPlans = plans.filter(p =>
        p.id !== planToDelete?.id && p.isActive
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">Billing Plans</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage subscription plans and pricing
                    </p>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search plans..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Plans</SelectItem>
                            <SelectItem value="active">Active Only</SelectItem>
                            <SelectItem value="inactive">Inactive Only</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="price">Price</SelectItem>
                            <SelectItem value="subscriptionCount">Subscriptions</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button onClick={() => router.push("/admin/billing-plans/new")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Plan
                    </Button>
                </div>

                {/* Plans Table */}
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Plan Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Billing Cycle</TableHead>
                                        <TableHead>Subscriptions</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8">
                                                Loading plans...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredPlans.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                No plans found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPlans.map((plan) => (
                                            <TableRow key={plan.id}>
                                                <TableCell className="font-medium">{plan.name}</TableCell>
                                                <TableCell className="max-w-xs truncate">
                                                    {plan.description || "-"}
                                                </TableCell>
                                                <TableCell>₹{plan.price.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{plan.billingCycle}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{plan.activeSubscriptions}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            of {plan.totalSubscriptions} total
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={plan.isActive ? "default" : "secondary"}>
                                                        {plan.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.push(`/admin/billing-plans/${plan.id}/edit`)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleToggleActive(plan)}
                                                        >
                                                            {plan.isActive ? (
                                                                <ToggleRight className="h-4 w-4" />
                                                            ) : (
                                                                <ToggleLeft className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteClick(plan)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Delete Confirmation Modal */}
                <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Plan</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete the plan "{planToDelete?.name}"?
                            </DialogDescription>
                        </DialogHeader>

                        {planToDelete && planToDelete.activeSubscriptions > 0 && (
                            <div className="space-y-4">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Warning:</strong> This plan has {planToDelete.activeSubscriptions} active subscription(s).
                                        You must select a plan to migrate these subscriptions to.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="migrationPlan">Migrate subscriptions to:</Label>
                                    <Select value={migrationPlanId} onValueChange={setMigrationPlanId}>
                                        <SelectTrigger id="migrationPlan">
                                            <SelectValue placeholder="Select a plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableMigrationPlans.map((plan) => (
                                                <SelectItem key={plan.id} value={plan.id.toString()}>
                                                    {plan.name} - ₹{plan.price}/{plan.billingCycle}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {planToDelete && planToDelete.activeSubscriptions === 0 && (
                            <p className="text-sm text-muted-foreground">
                                This plan has no active subscriptions and can be safely deleted.
                            </p>
                        )}

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDeleteConfirm}
                                disabled={deleting || (planToDelete?.activeSubscriptions! > 0 && !migrationPlanId)}
                            >
                                {deleting ? "Deleting..." : "Delete Plan"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
