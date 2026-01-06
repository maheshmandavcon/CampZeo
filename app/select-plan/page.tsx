"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/plans";
import { usePlans } from "@/hooks/use-plans";
import { RazorpayButton } from "@/components/razorpay-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


export default function SelectPlanPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const { plans, isLoading: plansLoading } = usePlans();
    const [organisation, setOrganisation] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!isLoaded || !user) {
                router.push("/sign-in");
                return;
            }

            try {
                const response = await fetch("/api/user/me");
                const data = await response.json();

                if (!data.organisation) {
                    router.push("/onboarding");
                    return;
                }

                const org = data.organisation;
                const subscription = data.subscription;

                const now = new Date();
                const isTrialValid = org.isTrial && org.trialEndDate && new Date(org.trialEndDate) > now;
                const hasActiveSubscription = subscription &&
                    (subscription.status === 'ACTIVE' || subscription.status === 'active') &&
                    (!subscription.endDate || new Date(subscription.endDate) > now);

                // If user has a valid plan, redirect to dashboard
                if (isTrialValid || hasActiveSubscription) {
                    router.push("/organisation");
                    return;
                }

                setOrganisation(org);
            } catch (error) {
                console.error("Error fetching user data:", error);
                router.push("/onboarding");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [user, isLoaded, router]);

    if (isLoading || plansLoading || !organisation) {
        return (
            <div className="container mx-auto py-16 px-4 max-w-6xl flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Filter out free trial plans
    const paidPlans = plans.filter(plan => plan.price > 0);

    return (
        <div className="container mx-auto py-16 px-4 max-w-6xl">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
                <p className="text-xl text-muted-foreground">
                    Your trial has expired. Please upgrade to continue using our services.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                {paidPlans.map((plan) => {
                    const isPopular = plan.price > 0 && plan.price < 5000;

                    return (
                        <Card
                            key={plan.id}
                            className={`relative flex flex-col ${isPopular ? "border-primary shadow-lg scale-105 z-10" : ""}`}
                        >
                            {isPopular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-primary px-3 py-1 text-sm">Most Popular</Badge>
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                <div className="mt-4">
                                    <span className="text-4xl font-bold">
                                        {formatPrice(plan.price, "INR")}
                                    </span>
                                    <span className="text-muted-foreground">/{plan.billingCycle || 'month'}</span>
                                </div>
                                <CardDescription className="mt-2">
                                    {plan.description || 'Everything you need to grow your business'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col">
                                <ul className="space-y-3 mb-8 flex-1">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <Check className="size-5 text-primary shrink-0 mt-0.5" />
                                            <span className="text-sm">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <RazorpayButton
                                    plan={plan.name}
                                    amount={plan.price}
                                    organizationName={organisation.name}
                                    className="w-full"
                                >
                                    <TrendingUp className="size-4 mr-2" />
                                    Upgrade to {plan.name}
                                </RazorpayButton>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="mt-12 text-center">
                <p className="text-muted-foreground text-sm">
                    Need help? <Button variant="link" className="p-0 h-auto">Contact Support</Button>
                </p>
            </div>
        </div>
    );
}
