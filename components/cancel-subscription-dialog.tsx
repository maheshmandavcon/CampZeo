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
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CancelSubscriptionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (immediate: boolean, reason?: string) => Promise<void>;
    planName?: string;
}

export function CancelSubscriptionDialog({
    open,
    onOpenChange,
    onConfirm,
    planName = "your plan",
}: CancelSubscriptionDialogProps) {
    const [timing, setTiming] = useState<"end" | "immediate">("end");
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(timing === "immediate", reason || undefined);
            onOpenChange(false);
            // Reset form
            setTiming("end");
            setReason("");
        } catch (error) {
            console.error("Failed to cancel subscription:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to cancel {planName}? This action will affect your access to features.
                    </DialogDescription>
                </DialogHeader>

                <Alert variant="destructive" className="my-4">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>
                        Cancelling your subscription will result in loss of access to premium features.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    {/* Timing Selection */}
                    <div className="space-y-3">
                        <Label>When should the cancellation take effect?</Label>
                        <RadioGroup value={timing} onValueChange={(value) => setTiming(value as "end" | "immediate")}>
                            <div className="flex items-start space-x-2">
                                <RadioGroupItem value="end" id="end" className="mt-1" />
                                <div className="flex-1">
                                    <Label htmlFor="end" className="font-medium cursor-pointer">
                                        At the end of billing period
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        You'll retain access to features until your subscription ends
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-2">
                                <RadioGroupItem value="immediate" id="immediate" className="mt-1" />
                                <div className="flex-1">
                                    <Label htmlFor="immediate" className="font-medium cursor-pointer">
                                        Immediately
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Your access will be revoked right away
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Optional Reason */}
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason for cancellation (optional)</Label>
                        <Textarea
                            id="reason"
                            placeholder="Let us know why you're cancelling..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Keep Subscription
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Confirm Cancellation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
