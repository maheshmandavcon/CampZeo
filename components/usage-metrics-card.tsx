import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface UsageMetric {
    current: number;
    limit: number;
    percentage: number;
    isNearLimit: boolean;
}

interface UsageMetricsCardProps {
    usage: {
        campaigns: UsageMetric;
        contacts: UsageMetric;
        users: UsageMetric;
        platforms: UsageMetric;
        postsThisMonth: UsageMetric;
    };
}

const metricLabels = {
    campaigns: "Campaigns",
    contacts: "Contacts",
    users: "Team Members",
    platforms: "Connected Platforms",
    postsThisMonth: "Posts This Month",
};

export function UsageMetricsCard({ usage }: UsageMetricsCardProps) {
    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return "bg-red-500";
        if (percentage >= 70) return "bg-yellow-500";
        return "bg-green-500";
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Usage Metrics</CardTitle>
                <CardDescription>Current usage vs plan limits</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {Object.entries(usage).map(([key, metric]) => {
                        const label = metricLabels[key as keyof typeof metricLabels];
                        const progressColor = getProgressColor(metric.percentage);
                        const cappedPercentage = Math.min(100, metric.percentage);

                        return (
                            <div key={key} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{label}</span>
                                        {metric.isNearLimit && (
                                            <AlertCircle className="size-4 text-yellow-600" />
                                        )}
                                    </div>
                                    <span className="text-muted-foreground">
                                        {metric.current} / {metric.limit} ({metric.percentage}% used)
                                    </span>
                                </div>
                                {/* Custom progress bar */}
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${progressColor} transition-all duration-300`}
                                        style={{ width: `${cappedPercentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
