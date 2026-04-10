import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Star, X } from "lucide-react";
import { PLANS, formatPrice } from "@/lib/plans";
import { motion } from "framer-motion";

interface PlanComparisonModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentPlanId?: string;
    currentPlanName?: string;
    planStatus?: string;
    onSelectPlan?: (planId: string) => void;
}

export function PlanComparisonModal({
    open,
    onOpenChange,
    currentPlanId,
    currentPlanName,
    planStatus,
    onSelectPlan,
}: PlanComparisonModalProps) {
    const plans = Object.values(PLANS);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[95vw] md:max-w-[85vw] lg:max-w-[75vw] xl:max-w-[65vw] p-0 overflow-hidden rounded-[2rem] border-none bg-[#fafafa]  shadow-2xl">
                <div className="relative h-full overflow-y-auto custom-scrollbar max-h-[90vh]">
                    {/* Background Accents */}
                    {/* <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" /> */}
                    {/* <div className="absolute top-12 left-12 w-32 h-32 bg-primary/10 rounded-full blur-[60px] pointer-events-none -z-10" /> */}

                    <div className="p-8 md:p-12">
                        {/* Header */}
                        <DialogHeader className="text-center mb-12 space-y-4">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest mx-auto"
                            >
                                <Sparkles className="size-3" />
                                Upgrade your workflow
                            </motion.div>
                            <DialogTitle asChild>
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-3xl md:text-4xl text-center font-black tracking-tight "
                                >
                                    Choose the perfect <span className="text-primary">plan.</span>
                                </motion.h2>
                            </DialogTitle>
                            <DialogDescription asChild>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-muted-foreground text-lg max-w-xl mx-auto"
                                >
                                    Select a plan that scales with your growth. No hidden fees, cancel anytime.
                                </motion.p>
                            </DialogDescription>
                        </DialogHeader>

                        {/* Plan Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                            {plans.map((plan, index) => {
                                const isCurrentPlan = currentPlanId === plan.id || currentPlanName?.toUpperCase() === plan.name?.toUpperCase();
                                const isPopular = plan.popular;

                                return (
                                    <motion.div
                                        key={plan.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 + index * 0.1 }}
                                        className="relative group h-full"
                                    >
                                        <Card className={`h-full border-[1.5px] bg-white rounded-[1.5rem] relative transition-all duration-300 hover:shadow-xl ${isPopular ? "border-primary shadow-sm" : "border-primary/40"} ${isCurrentPlan && planStatus?.toUpperCase() === 'ACTIVE' ? "border-primary/60" : ""}`}>
                                            {/* Status Badge */}
                                            {isCurrentPlan && planStatus && planStatus.toUpperCase() !== 'ACTIVE' && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                                                    <Badge
                                                        className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full border-none shadow-md"
                                                    >
                                                        {planStatus.toUpperCase()}
                                                    </Badge>
                                                </div>
                                            )}

                                            {/* Most Popular Badge */}
                                            {isPopular && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                                                    <Badge className="bg-primary hover:bg-primary/90 text-white text-[11px] font-bold px-4 py-1 rounded-full border-none shadow-lg whitespace-nowrap">
                                                        Most Popular
                                                    </Badge>
                                                </div>
                                            )}

                                            <div className="p-8 pb-4">
                                                <div className="space-y-1 mb-6">
                                                    <h3 className="text-sm font-bold tracking-wider uppercase text-gray-900">{plan.name}</h3>
                                                </div>

                                                <div className="flex items-baseline gap-1 mb-8">
                                                    <span className="text-3xl font-black tracking-tight text-gray-950">
                                                        {formatPrice(plan.price, plan.currency)}
                                                    </span>
                                                    <span className="text-muted-foreground/50 font-bold text-[10px] uppercase tracking-widest">/{plan.interval === 'month' ? 'MONTHLY' : plan.interval.toUpperCase()}</span>
                                                </div>

                                                <Button
                                                    className={`w-full h-11 rounded-lg text-sm font-bold transition-all duration-300 ${isCurrentPlan
                                                        ? "bg-white border border-gray-200 text-muted-foreground/40 hover:bg-white cursor-default shadow-none"
                                                        : "bg-primary hover:bg-primary/90 text-white shadow shadow-primary/10"}`}
                                                    disabled={isCurrentPlan || plan.id === "FREE_TRIAL"}
                                                    onClick={() => {
                                                        onSelectPlan?.(plan.id);
                                                        onOpenChange(false);
                                                    }}
                                                >
                                                    {isCurrentPlan ? "Current Plan" : plan.id === "FREE_TRIAL" ? "Expired" : "Upgrade Plan"}
                                                </Button>
                                            </div>

                                            <div className="px-8 pb-10 pt-2">
                                                <div className="space-y-3">
                                                    {plan.features.slice(0, 6).map((feature, idx) => (
                                                        <div key={idx} className="flex items-start gap-2.5 text-[12.5px] font-medium leading-[1.4]">
                                                            <Check className="size-3.5 text-primary shrink-0 mt-0.5" />
                                                            <span className="text-gray-800">{feature}.</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Feature Comparison Table */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="bg-white/30  rounded-[2.5rem] border border-gray-100  p-8"
                        >
                            <div className="flex items-center gap-3 mb-8">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Star className="size-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold ">Feature Comparison</h3>
                                    <p className="text-sm text-muted-foreground">Compare everything side-by-side</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <thead>
                                        <tr>
                                            <th className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/30 first:rounded-l-2xl">Features</th>
                                            {plans.map((plan, i) => (
                                                <th key={plan.id} className={`py-4 px-6 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/30 ${i === plans.length - 1 ? "rounded-r-2xl" : ""}`}>
                                                    {plan.name === "FREE_TRIAL" ? "FREE TRIAL" : plan.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from(new Set(plans.flatMap((p) => p.features))).map((feature, idx) => (
                                            <tr key={idx} className="group transition-colors hover:bg-primary/[0.02]">
                                                <td className="py-4 px-6 text-sm font-semibold border-b border-gray-50  group-last:border-none">{feature}</td>
                                                {plans.map((plan) => (
                                                    <td key={plan.id} className="py-4 px-6 text-center border-b border-gray-50  group-last:border-none">
                                                        {plan.features.includes(feature) ? (
                                                            <div className="size-8 rounded-full bg-green-500/10 flex items-center justify-center mx-auto ring-1 ring-green-500/20">
                                                                <Check className="size-4 text-green-600" />
                                                            </div>
                                                        ) : (
                                                            <div className="size-8 rounded-full bg-muted/10 flex items-center justify-center mx-auto ring-1 ring-muted/20">
                                                                <X className="size-4 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
