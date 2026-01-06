"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Header } from '@/components/Header';
import { usePlans, Plan } from "@/hooks/use-plans";
import { formatPrice } from "@/lib/plans";
import { useRouter } from "next/navigation";
import { SignUpButton, useUser } from "@clerk/nextjs";
import { LandingGlowEffects } from "@/components/ui/landing glow effects";

export default function PricingPage() {
    const { plans, isLoading: plansLoading } = usePlans();
    const router = useRouter();
    const { isSignedIn } = useUser();

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header/Nav would typically be included here or via layout */}
            <Header />

            <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                 <LandingGlowEffects />
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
                        <p className="text-muted-foreground max-w-2xl mx-auto text-xl">
                            Choose the perfect plan for your needs. Start with a free trial or go straight to a paid plan.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {plansLoading ? (
                            <div className="col-span-3 text-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-muted-foreground">Loading plans...</p>
                            </div>
                        ) : (
                            plans.map((plan) => {
                                const isPopular = plan.price > 0 && plan.price < 5000;
                                const isTrial = plan.price === 0;

                                return (
                                    <Card
                                        key={plan.id}
                                        className={`relative flex flex-col ${isPopular ? "border-primary shadow-lg scale-105 z-10" : ""}`}
                                    >
                                        {isPopular && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                                <Badge className="gap-1 px-4 py-1.5 text-sm">
                                                    <Star className="size-3" />
                                                    Most Popular
                                                </Badge>
                                            </div>
                                        )}
                                        <CardHeader>
                                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                            <CardDescription>{plan.description || (isTrial ? "Try all features for free" : "Perfect for your needs")}</CardDescription>
                                            <div className="mt-4">
                                                <span className="text-4xl font-bold">{plan.price === 0 ? "Free" : formatPrice(plan.price, "INR")}</span>
                                                {plan.price > 0 && <span className="text-muted-foreground">/{plan.billingCycle || 'month'}</span>}
                                                {isTrial && <span className="text-muted-foreground"> trial</span>}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex-1">
                                            <ul className="space-y-3">
                                                {plan.features.map((feature, index) => (
                                                    <li key={index} className="flex items-start gap-2">
                                                        <Check className="size-5 text-green-500 shrink-0 mt-0.5" />
                                                        <span className="text-sm">{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CardContent>
                                        <CardFooter>
                                            {isTrial ? (
                                                // Free Trial: Redirect to /sign-up page
                                                <Link href="/sign-up" className="w-full">
                                                    <Button
                                                        className="w-full"
                                                        variant="outline"
                                                        size="lg"
                                                    >
                                                        Start Free Trial
                                                        <ArrowRight className="ml-2 size-4" />
                                                    </Button>
                                                </Link>
                                            ) : isSignedIn ? (
                                                // Paid Plan + Signed In: Go to onboarding
                                                <Button
                                                    className="w-full"
                                                    variant={isPopular ? "default" : "outline"}
                                                    size="lg"
                                                    onClick={() => router.push('/onboarding')}
                                                >
                                                    Purchase Now
                                                    <ArrowRight className="ml-2 size-4" />
                                                </Button>
                                            ) : (
                                                // Paid Plan + Not Signed In: Show Clerk modal
                                                <SignUpButton
                                                    mode="modal"
                                                    forceRedirectUrl="/onboarding"
                                                    unsafeMetadata={{
                                                        selectedPlanId: plan.id,
                                                        selectedPlanName: plan.name,
                                                        planPrice: plan.price,
                                                        isTrial: false
                                                    }}
                                                >
                                                    <Button
                                                        className="w-full"
                                                        variant={isPopular ? "default" : "outline"}
                                                        size="lg"
                                                    >
                                                        Purchase Now
                                                        <ArrowRight className="ml-2 size-4" />
                                                    </Button>
                                                </SignUpButton>
                                            )}
                                        </CardFooter>
                                    </Card>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-20 text-center">
                        <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
                        <div className="grid md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto mt-8">
                            <div>
                                <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
                                <p className="text-muted-foreground">Yes, you can cancel your subscription at any time. Your service will continue until the end of your billing period.</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                                <p className="text-muted-foreground">We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, just let us know.</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">Do I need a credit card for the trial?</h3>
                                <p className="text-muted-foreground">No, you can sign up for our 14-day free trial without entering any payment information.</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">What happens after my trial ends?</h3>
                                <p className="text-muted-foreground">We'll email you before your trial expires. You can then choose a paid plan or your account will be paused.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t bg-muted/20">
                <div className="max-w-7xl mx-auto text-center text-muted-foreground">
                    <p>© 2025 Campzeo. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
