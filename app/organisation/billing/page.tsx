"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { PLANS, formatPrice, type PlanType } from "@/lib/plans";
import { Check, CreditCard, Calendar, TrendingUp, XCircle, GitCompare, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { RazorpayButton } from "@/components/razorpay-button";
import { TrialCountdown } from "@/components/trial-countdown";
import { UsageMetricsCard } from "@/components/usage-metrics-card";
import { usePlans } from "@/hooks/use-plans";
import { PlanChangeDialog } from "@/components/plan-change-dialog";
import { PlanComparisonModal } from "@/components/plan-comparison-modal";
import { CancelSubscriptionDialog } from "@/components/cancel-subscription-dialog";
import { useRef } from "react";

interface OrganisationData {
  id: number;
  name: string;
  status: string;
  lastPaymentDate: string | null;
  nextBillingDate: string | null;
}

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  plan: string;
  createdAt: string;
}

interface SubscriptionData {
  subscription: {
    id: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
    renewalDate: string | null;
    autoRenew: boolean;
    plan: {
      id: number;
      name: string;
      price: number;
      billingCycle: string | null;
      features: string[];
      usageLimits: any;
    } | null;
  } | null;
  trial: {
    isActive: boolean;
    daysRemaining: number;
    startDate: string;
    endDate: string;
    isExpired: boolean;
  } | null;
  organisation: {
    id: number;
    name: string;
    isApproved: boolean;
  };
}

interface UsageMetric {
  current: number;
  limit: number;
  percentage: number;
  isNearLimit: boolean;
}

interface UsageData {
  usage: {
    campaigns: UsageMetric;
    contacts: UsageMetric;
    users: UsageMetric;
    platforms: UsageMetric;
    postsThisMonth: UsageMetric;
  };
}

export default function BillingPage() {
  const router = useRouter();
  const { plans, isLoading: plansLoading } = usePlans();
  const [organisation, setOrganisation] = useState<OrganisationData | null>(null);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showPlanChangeDialog, setShowPlanChangeDialog] = useState(false);
  const [selectedPlanForChange, setSelectedPlanForChange] = useState<any | null>(null);
  const [activationTiming, setActivationTiming] = useState<"IMMEDIATE" | "DEFERRED">("IMMEDIATE");
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false);
  const razorpayButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      // Fetch data in parallel
      const [userResponse, paymentsResponse, subscriptionResponse, usageResponse] =
        await Promise.all([
          fetch("/api/user/me"),
          fetch("/api/payments"),
          fetch("/api/subscription/current"),
          fetch("/api/subscription/usage"),
        ]);

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setOrganisation(userData.organisation);
      }

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setPayments(paymentsData.payments || []);
      }

      if (subscriptionResponse.ok) {
        const subData = await subscriptionResponse.json();
        setSubscriptionData(subData);
      }

      if (usageResponse.ok) {
        const usageMetrics = await usageResponse.json();
        setUsageData(usageMetrics);
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
      toast.error("Failed to load billing information");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    fetchBillingData();
    router.refresh();
  };

  const handleAutoRenewToggle = async (checked: boolean) => {
    setIsUpdatingAutoRenew(true);
    try {
      const response = await fetch("/api/subscription/auto-renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: checked }),
      });

      if (response.ok) {
        toast.success(`Auto-renew ${checked ? "enabled" : "disabled"} successfully`);
        fetchBillingData();
      } else {
        throw new Error("Failed to update auto-renew");
      }
    } catch (error) {
      console.error("Error updating auto-renew:", error);
      toast.error("Failed to update auto-renew setting");
    } finally {
      setIsUpdatingAutoRenew(false);
    }
  };

  const handleCancelSubscription = async (immediate: boolean, reason?: string) => {
    try {
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate, reason }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchBillingData();
      } else {
        throw new Error("Failed to cancel subscription");
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Failed to cancel subscription");
      throw error;
    }
  };

  const handleSelectPlan = (planId: string | number) => {
    const plan = plans.find(p => p.id === planId || p.name === planId);
    if (plan) {
      setSelectedPlanForChange(plan);
      setShowPlanChangeDialog(true);
    }
  };

  const handlePlanChangeConfirm = async (immediate: boolean) => {
    // We will trigger the Razorpay button manually or store the preference
    // Actually, it's better to pass the preference to the RazorpayButton
    // But since the RazorpayButton is inside the loop, we need a way to trigger it.
    // For now, let's just close the dialog and let the user click the button in the UI, 
    // OR just use a hidden button.

    // Better approach: Update the state and then the user clicks the button.
    // Even better: The PlanChangeDialog itself could trigger the payment if we pass the right props.
  };

  if (isLoading || plansLoading) {
    return (
      <div className="p-6">
        <div className=" mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-96 bg-muted rounded"></div>
              <div className="h-96 bg-muted rounded"></div>
              <div className="h-96 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = subscriptionData?.subscription?.plan;
  const subscription = subscriptionData?.subscription;

  return (
    <div className="p-6">
      <div className=" mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Billing & Subscription</h1>
            <p className="text-muted-foreground mt-2">
              Manage your subscription and view payment history
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/organisation/billing/invoices")}>
              <FileText className="size-4 mr-2" />
              Invoices
            </Button>
            <Button variant="outline" onClick={() => setShowComparisonModal(true)}>
              <GitCompare className="size-4 mr-2" />
              Compare Plans
            </Button>
          </div>
        </div>

        {/* Trial Countdown */}
        {subscriptionData?.trial && (
          <TrialCountdown trial={subscriptionData.trial} />
        )}

        {/* Usage Metrics */}
        {usageData && <UsageMetricsCard usage={usageData.usage} />}

        {/* Current Plan Card */}
        {subscription && currentPlan && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{currentPlan.name} Plan</CardTitle>
                  <CardDescription>
                    {formatPrice(currentPlan.price, "INR")}/{currentPlan.billingCycle || "month"}
                  </CardDescription>
                </div>
                <Badge variant={subscription.status === "ACTIVE" ? "default" : "secondary"}>
                  {subscription.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {subscription.startDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Start Date</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(subscription.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {subscription.renewalDate && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Next Billing Date</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(subscription.renewalDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-Renew Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-renew">Auto-Renew</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically renew subscription at the end of your billing period
                  </p>
                </div>
                <Switch
                  id="auto-renew"
                  checked={subscription.autoRenew}
                  onCheckedChange={handleAutoRenewToggle}
                  disabled={isUpdatingAutoRenew}
                />
              </div>

              {/* Cancel Button */}
              {subscription.status === "ACTIVE" && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full"
                >
                  <XCircle className="size-4 mr-2" />
                  Cancel Subscription
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Available Plans */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan?.id === plan.id || currentPlan?.name === plan.name;
              const canUpgrade = currentPlan && !isCurrentPlan && plan.price > Number(currentPlan.price);
              const isPopular = plan.price > 0 && plan.price < 5000;

              return (
                <Card
                  key={plan.id}
                  id={`plan-${plan.id}`}
                  className={`relative ${isPopular ? "border-primary shadow-lg" : ""}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">
                        {formatPrice(plan.price, "INR")}
                      </span>
                      <span className="text-muted-foreground">/{plan.billingCycle || 'month'}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="size-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : subscription ? (
                      <div className="space-y-2">
                        {plan.price === 0 && subscription.status === 'ACTIVE' ? (
                          <Button variant="outline" className="w-full" disabled>
                            Trial Unavailable
                          </Button>
                        ) : (
                          <>
                            <PlanChangeDialog
                              open={showPlanChangeDialog && selectedPlanForChange?.id === plan.id}
                              onOpenChange={setShowPlanChangeDialog}
                              currentPlanName={currentPlan?.name}
                              newPlanName={plan.name}
                              onConfirm={async (immediate) => {
                                setActivationTiming(immediate ? "IMMEDIATE" : "DEFERRED");
                                // Small delay to ensure state is updated before click
                                setTimeout(() => {
                                  const btn = document.getElementById(`razorpay-btn-${plan.id}`);
                                  btn?.click();
                                }, 100);
                              }}
                            />
                            <Button
                              variant={plan.price > (Number(currentPlan?.price) || 0) ? "default" : "outline"}
                              className="w-full"
                              onClick={() => {
                                setSelectedPlanForChange(plan);
                                setShowPlanChangeDialog(true);
                              }}
                            >
                              {plan.price > (Number(currentPlan?.price) || 0) ? "Upgrade Plan" : "Change to " + plan.name}
                            </Button>
                            <div className="hidden">
                              <RazorpayButton
                                id={`razorpay-btn-${plan.id}`}
                                plan={plan.name}
                                amount={plan.price}
                                onSuccess={handlePaymentSuccess}
                                metadata={{ activationTiming }}
                              >
                                Buy
                              </RazorpayButton>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {plan.price === 0 ? (
                          <Button variant="outline" className="w-full" disabled>
                            Free Trial (One-time)
                          </Button>
                        ) : (
                          <RazorpayButton
                            plan={plan.name}
                            amount={plan.price}
                            onSuccess={handlePaymentSuccess}
                            className="w-full"
                          >
                            Get Started with {plan.name}
                          </RazorpayButton>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View your past transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{payment.plan} Plan</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatPrice(payment.amount, payment.currency)}
                      </p>
                      <Badge
                        variant={
                          payment.status === "COMPLETED"
                            ? "default"
                            : payment.status === "PENDING"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan Comparison Modal */}
        <PlanComparisonModal
          open={showComparisonModal}
          onOpenChange={setShowComparisonModal}
          currentPlanId={currentPlan?.id.toString()}
          onSelectPlan={handleSelectPlan}
        />

        {/* Cancel Subscription Dialog */}
        <CancelSubscriptionDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancelSubscription}
          planName={currentPlan?.name}
        />
      </div>
    </div>
  );
}
