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
    onSelectPlan?: (planId: string) => void;
}

export function PlanComparisonModal({
    open,
    onOpenChange,
    currentPlanId,
    onSelectPlan,
}: PlanComparisonModalProps) {
    const plans = Object.values(PLANS);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[95vw] md:max-w-[85vw] lg:max-w-[75vw] xl:max-w-[65vw] p-0 overflow-hidden rounded-[2rem] border-none bg-[#fafafa] dark:bg-zinc-950 shadow-2xl">
                <div className="relative h-full overflow-y-auto custom-scrollbar max-h-[90vh]">
                    {/* Background Accents */}
                    <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
                    <div className="absolute top-12 left-12 w-32 h-32 bg-primary/10 rounded-full blur-[60px] pointer-events-none -z-10" />

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
                                    className="text-4xl md:text-5xl font-black tracking-tight"
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
                                const isCurrentPlan = currentPlanId === plan.id;
                                const isPopular = plan.popular;

                                return (
                                    <motion.div
                                        key={plan.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 + index * 0.1 }}
                                        className="relative group"
                                    >
                                        <Card className={`h-full border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-2 ${isPopular ? "ring-2 ring-primary" : ""}`}>
                                            <div className="p-8 pb-4">
                                                {isPopular && (
                                                    <div className="absolute top-4 right-4 animate-pulse">
                                                        <Badge className="bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full border-none">MOST POPULAR</Badge>
                                                    </div>
                                                )}

                                                <div className="space-y-1 mb-6">
                                                    <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">For growing teams</p>
                                                </div>

                                                <div className="flex items-baseline gap-1 mb-6">
                                                    <span className="text-4xl font-black tracking-tighter">
                                                        {formatPrice(plan.price, plan.currency)}
                                                    </span>
                                                    <span className="text-muted-foreground font-medium text-sm">/{plan.interval}</span>
                                                </div>

                                                <Button
                                                    className={`w-full h-12 rounded-xl font-bold transition-all duration-300 ${isCurrentPlan
                                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                        : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"}`}
                                                    disabled={isCurrentPlan || plan.id === "FREE_TRIAL"}
                                                    onClick={() => {
                                                        onSelectPlan?.(plan.id);
                                                        onOpenChange(false);
                                                    }}
                                                >
                                                    {isCurrentPlan ? "Current Plan" : plan.id === "FREE_TRIAL" ? "Expired" : "Upgrade Plan"}
                                                </Button>
                                            </div>

                                            <div className="px-8 pb-8 pt-4">
                                                <div className="space-y-3">
                                                    {plan.features.slice(0, 4).map((feature, idx) => (
                                                        <div key={idx} className="flex gap-3 text-sm font-medium">
                                                            <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                                <Check className="size-3 text-primary" />
                                                            </div>
                                                            <span className="text-muted-foreground/90">{feature}</span>
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
                            className="bg-white/30 dark:bg-zinc-900/10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8"
                        >
                            <div className="flex items-center gap-3 mb-8">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Star className="size-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight">Feature Comparison</h3>
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
                                                    {plan.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from(new Set(plans.flatMap((p) => p.features))).map((feature, idx) => (
                                            <tr key={idx} className="group transition-colors hover:bg-primary/[0.02]">
                                                <td className="py-4 px-6 text-sm font-semibold border-b border-gray-50 dark:border-zinc-800/50 group-last:border-none">{feature}</td>
                                                {plans.map((plan) => (
                                                    <td key={plan.id} className="py-4 px-6 text-center border-b border-gray-50 dark:border-zinc-800/50 group-last:border-none">
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
