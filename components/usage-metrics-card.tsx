import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Facebook, Instagram, Linkedin, Youtube, Pin } from "lucide-react";

interface UsageMetric {
    current: number;
    limit: number;
    percentage: number;
    isNearLimit: boolean;
}

interface PlatformsMetric extends UsageMetric {
    connectedNames?: string[];
}

interface UsageMetricsCardProps {
    usage: {
        campaigns: UsageMetric;
        contacts: UsageMetric;
        users: UsageMetric;
        platforms: PlatformsMetric;
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

const platformIcons: Record<string, React.ReactNode> = {
    LinkedIn: <Linkedin className="size-3" />,
    Facebook: <Facebook className="size-3" />,
    Instagram: <Instagram className="size-3" />,
    YouTube: <Youtube className="size-3" />,
    Pinterest: <Pin className="size-3" />,
};

const platformColors: Record<string, string> = {
    LinkedIn: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Facebook: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    Instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    YouTube: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    Pinterest: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
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
                <div className="space-y-5">
                    {Object.entries(usage).map(([key, metric]) => {
                        const label = metricLabels[key as keyof typeof metricLabels];
                        const progressColor = getProgressColor(metric.percentage);
                        const cappedPercentage = Math.min(100, metric.percentage);
                        const isPlatforms = key === "platforms";
                        const connectedNames = isPlatforms
                            ? (metric as PlatformsMetric).connectedNames ?? []
                            : [];

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
                                        {isPlatforms
                                            ? `${metric.current} / 5 connected`
                                            : metric.limit === 99999
                                                ? `${metric.current} used`
                                                : `${metric.current} / ${metric.limit} (${metric.percentage}% used)`}
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${progressColor} transition-all duration-300`}
                                        style={{ width: `${cappedPercentage}%` }}
                                    />
                                </div>

                                {/* Connected platform pills */}
                                {isPlatforms && (
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {connectedNames.length > 0 ? (
                                            connectedNames.map((name) => (
                                                <span
                                                    key={name}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${platformColors[name] ?? "bg-muted text-muted-foreground"}`}
                                                >
                                                    {platformIcons[name]}
                                                    {name}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">
                                                No social platforms connected yet
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
