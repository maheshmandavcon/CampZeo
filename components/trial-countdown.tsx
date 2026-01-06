import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, Zap } from "lucide-react";

interface TrialCountdownProps {
    trial: {
        isActive: boolean;
        daysRemaining: number;
        endDate: string;
        isExpired: boolean;
    } | null;
}

export function TrialCountdown({ trial }: TrialCountdownProps) {
    if (!trial || (!trial.isActive && !trial.isExpired)) {
        return null;
    }

    // Trial expired
    if (trial.isExpired) {
        return (
            <Alert variant="destructive" className="border-destructive">
                <Zap className="size-4" />
                <AlertTitle className="font-semibold">Trial Expired</AlertTitle>
                <AlertDescription>
                    Your trial period has ended. Please upgrade to a paid plan to continue using all features.
                </AlertDescription>
            </Alert>
        );
    }

    // Determine urgency level based on days remaining
    const getUrgencyConfig = (days: number) => {
        if (days <= 2) {
            return {
                variant: "destructive" as const,
                icon: Zap,
                color: "bg-destructive",
                textColor: "text-destructive-foreground",
                label: "Urgent",
            };
        } else if (days <= 7) {
            return {
                variant: "default" as const,
                icon: AlertTriangle,
                color: "bg-yellow-500",
                textColor: "text-yellow-900",
                label: "Warning",
            };
        } else {
            return {
                variant: "default" as const,
                icon: Clock,
                color: "bg-blue-500",
                textColor: "text-blue-900",
                label: "Active",
            };
        }
    };

    const config = getUrgencyConfig(trial.daysRemaining);
    const Icon = config.icon;
    const endDate = new Date(trial.endDate).toLocaleDateString();

    return (
        <Alert
            variant={config.variant}
            className={config.variant === "default" ? `border-${config.color.replace('bg-', '')} bg-${config.color.replace('bg-', '')}/10` : ""}
        >
            <Icon className="size-4" />
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <AlertTitle className="font-semibold">
                        Free Trial - {trial.daysRemaining} {trial.daysRemaining === 1 ? "Day" : "Days"} Remaining
                    </AlertTitle>
                    <AlertDescription>
                        Your trial ends on {endDate}.
                        {trial.daysRemaining <= 7 && " Upgrade now to continue accessing all features."}
                    </AlertDescription>
                </div>
                <Badge variant={config.variant} className="ml-4">
                    {config.label}
                </Badge>
            </div>
        </Alert>
    );
}
