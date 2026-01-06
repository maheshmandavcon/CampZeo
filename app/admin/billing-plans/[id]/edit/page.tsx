"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, X, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function EditPlanPage() {
    const router = useRouter();
    const params = useParams();
    const planId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [plan, setPlan] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        billingCycle: "MONTHLY",
        isActive: true,
        autoRenew: true
    });
    const [features, setFeatures] = useState<string[]>([""]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [hasActiveSubscriptions, setHasActiveSubscriptions] = useState(false);

    useEffect(() => {
        fetchPlan();
    }, [planId]);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/billing-plans/${planId}`);
            const data = await res.json();

            if (data.isSuccess) {
                const planData = data.data;
                setPlan(planData);
                setFormData({
                    name: planData.name,
                    description: planData.description || "",
                    price: planData.price.toString(),
                    billingCycle: planData.billingCycle,
                    isActive: planData.isActive,
                    autoRenew: planData.autoRenew
                });
                setFeatures(Array.isArray(planData.features) ? planData.features : [""]);
                setHasActiveSubscriptions(planData.activeSubscriptions > 0);
            } else {
                toast.error(data.message || "Failed to fetch plan");
                router.push("/admin/billing-plans");
            }
        } catch (error) {
            console.error("Error fetching plan:", error);
            toast.error("Failed to load plan");
            router.push("/admin/billing-plans");
        } finally {
            setLoading(false);
        }
    };

    const handleAddFeature = () => {
        setFeatures([...features, ""]);
    };

    const handleRemoveFeature = (index: number) => {
        if (features.length > 1) {
            setFeatures(features.filter((_, i) => i !== index));
        }
    };

    const handleFeatureChange = (index: number, value: string) => {
        const newFeatures = [...features];
        newFeatures[index] = value;
        setFeatures(newFeatures);
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = "Plan name is required";
        }

        if (!formData.price || parseFloat(formData.price) < 0) {
            newErrors.price = "Valid price is required (must be >= 0)";
        }

        const validFeatures = features.filter(f => f.trim());
        if (validFeatures.length === 0) {
            newErrors.features = "At least one feature is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error("Please fix the errors in the form");
            return;
        }

        try {
            setSaving(true);

            const validFeatures = features.filter(f => f.trim());
            const updateData: any = {
                name: formData.name,
                description: formData.description,
                features: validFeatures,
                isActive: formData.isActive,
                autoRenew: formData.autoRenew
            };

            // Only include price and billingCycle if no active subscriptions
            if (!hasActiveSubscriptions) {
                updateData.price = parseFloat(formData.price);
                updateData.billingCycle = formData.billingCycle;
            }

            const res = await fetch(`/api/admin/billing-plans/${planId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData)
            });

            const data = await res.json();

            if (data.isSuccess) {
                toast.success("Plan updated successfully");
                router.push("/admin/billing-plans");
            } else {
                toast.error(data.message || "Failed to update plan");
                if (data.message?.includes("already exists")) {
                    setErrors({ name: data.message });
                }
            }
        } catch (error) {
            console.error("Error updating plan:", error);
            toast.error("Failed to update plan");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p>Loading plan...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto p-6 max-w-4xl">
                {/* Header */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/admin/billing-plans")}
                        className="mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Plans
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Edit Plan</h1>
                    <p className="text-muted-foreground mt-1">
                        Update billing plan details
                    </p>
                </div>

                {/* Active Subscriptions Warning */}
                {hasActiveSubscriptions && (
                    <Alert className="mb-6 border-yellow-500 bg-yellow-50">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-800">
                            This plan has {plan.activeSubscriptions} active subscription(s).
                            Price and billing cycle cannot be changed. Create a new plan if you need different pricing.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Plan Details</CardTitle>
                            <CardDescription>
                                Update the details for this billing plan
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Plan Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    Plan Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Premium Plan"
                                    className={errors.name ? "border-destructive" : ""}
                                />
                                {errors.name && (
                                    <p className="text-sm text-destructive">{errors.name}</p>
                                )}
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the plan benefits..."
                                    rows={3}
                                />
                            </div>

                            {/* Price and Billing Cycle */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="price">
                                        Price (₹) <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        placeholder="999.00"
                                        disabled={hasActiveSubscriptions}
                                        className={errors.price ? "border-destructive" : ""}
                                    />
                                    {errors.price && (
                                        <p className="text-sm text-destructive">{errors.price}</p>
                                    )}
                                    {hasActiveSubscriptions && (
                                        <p className="text-xs text-muted-foreground">
                                            Cannot be changed (plan has active subscriptions)
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="billingCycle">
                                        Billing Cycle <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={formData.billingCycle}
                                        onValueChange={(value) => setFormData({ ...formData, billingCycle: value })}
                                        disabled={hasActiveSubscriptions}
                                    >
                                        <SelectTrigger id="billingCycle">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                                            <SelectItem value="YEARLY">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {hasActiveSubscriptions && (
                                        <p className="text-xs text-muted-foreground">
                                            Cannot be changed (plan has active subscriptions)
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>
                                        Features <span className="text-destructive">*</span>
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddFeature}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Feature
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {features.map((feature, index) => (
                                        <div key={index} className="flex gap-3 items-center group">
                                            <div className="flex-1">
                                                <Input
                                                    value={feature}
                                                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                                                    placeholder={`Feature ${index + 1}`}
                                                    className={`bg-white ${errors.features && !feature.trim() ? "border-destructive" : ""}`}
                                                />
                                            </div>
                                            {features.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveFeature(index)}
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-70 group-hover:opacity-100"
                                                    title="Remove feature"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {errors.features && (
                                    <p className="text-sm text-destructive">{errors.features}</p>
                                )}
                            </div>

                            {/* Settings */}
                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="isActive">Active Status</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Make this plan available for subscriptions
                                        </p>
                                    </div>
                                    <Switch
                                        id="isActive"
                                        checked={formData.isActive}
                                        onCheckedChange={(checked) =>
                                            setFormData({ ...formData, isActive: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="autoRenew">Auto Renew</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Automatically renew subscriptions
                                        </p>
                                    </div>
                                    <Switch
                                        id="autoRenew"
                                        checked={formData.autoRenew}
                                        onCheckedChange={(checked) =>
                                            setFormData({ ...formData, autoRenew: checked })
                                        }
                                    />
                                </div>
                            </div>

                            {/* Subscription Info */}
                            {plan && (
                                <div className="pt-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        <strong>Total Subscriptions:</strong> {plan.totalSubscriptions}
                                        {" | "}
                                        <strong>Active:</strong> {plan.activeSubscriptions}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-4 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/admin/billing-plans")}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
