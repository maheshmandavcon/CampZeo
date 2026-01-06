"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PlanChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentPlanName?: string;
    newPlanName?: string;
    onConfirm: (immediate: boolean) => Promise<void>;
}

export function PlanChangeDialog({
    open,
    onOpenChange,
    currentPlanName,
    newPlanName,
    onConfirm,
}: PlanChangeDialogProps) {
    const [timing, setTiming] = useState<"immediate" | "end">("immediate");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(timing === "immediate");
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to change plan:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="size-5 text-primary" />
                        Change Subscription Plan
                    </DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        Transitioning from <span className="font-bold text-foreground">{currentPlanName}</span> to <span className="font-bold text-primary">{newPlanName}</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 my-4">
                    <div className="space-y-4">
                        <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Activation Timing</Label>
                        <RadioGroup value={timing} onValueChange={(value) => setTiming(value as "immediate" | "end")} className="grid gap-3">
                            <Label
                                htmlFor="immediate"
                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${timing === "immediate" ? "border-primary bg-primary/[0.02]" : "border-gray-100 dark:border-white/5"}`}
                            >
                                <RadioGroupItem value="immediate" id="immediate" className="mt-1" />
                                <div className="space-y-1">
                                    <p className="font-bold text-sm">Activate Immediately</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Your new plan features will be available right away. Your billing cycle will reset from today.
                                    </p>
                                </div>
                            </Label>

                            <Label
                                htmlFor="end"
                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${timing === "end" ? "border-primary bg-primary/[0.02]" : "border-gray-100 dark:border-white/5"}`}
                            >
                                <RadioGroupItem value="end" id="end" className="mt-1" />
                                <div className="space-y-1">
                                    <p className="font-bold text-sm">After Current Plan Expires</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Keep your current features until the end of your billing cycle. The new plan will activate automatically then.
                                    </p>
                                </div>
                            </Label>
                        </RadioGroup>
                    </div>

                    <Alert className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20 rounded-2xl">
                        <AlertCircle className="size-4 text-blue-600" />
                        <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
                            You will be redirected to complete the payment for the new plan.
                            {timing === "immediate" ? " The new plan starts today." : " The amount will be credited to your next billing cycle."}
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                        className="rounded-xl"
                    >
                        Keep Current Plan
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                        Confirm & Proceed to Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
