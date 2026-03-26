'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Play, CheckCircle, XCircle, Clock, RefreshCw, Settings, Timer } from 'lucide-react';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SchedulerResult {
    success: boolean;
    timestamp: string;
    results?: {
        total: number;
        processed: number;
        failed: number;
        errors: Array<{
            postId: number;
            error: string;
        }>;
    };
    error?: string;
    message?: string;
}

export function AdminSchedulerView() {
    const [loading, setLoading] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [result, setResult] = useState<SchedulerResult | null>(null);
    const [lastRun, setLastRun] = useState<string | null>(null);
    const [frequency, setFrequency] = useState<string>("5");
    const [nextRunIn, setNextRunIn] = useState<string>("");
    const [isSeeding, setIsSeeding] = useState(false);

    const jobId = 'campaign-post-scheduler';

    // Fetch job settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoadingSettings(true);
                const response = await fetch('/api/admin/job-settings');
                const data = await response.json();

                if (data.isSuccess) {
                    const setting = data.data.find((s: any) => s.jobId === jobId);
                    if (setting) {
                        setIsEnabled(setting.isEnabled);
                        setFrequency(setting.cronExpression || "5");
                        if (setting.lastRunAt) {
                            setLastRun(setting.lastRunAt);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching job settings:', error);
            } finally {
                setLoadingSettings(false);
            }
        };

        fetchSettings();
    }, []);

    // Calculate next run estimation
    useEffect(() => {
        const calculateNextRun = () => {
            if (!isEnabled) {
                setNextRunIn("Scheduler disabled");
                return;
            }

            const now = new Date();
            const freqMins = parseInt(frequency) || 5;

            // Assuming it runs on fixed intervals of the hour (00, 05, 10, etc.)
            const currentMinutes = now.getMinutes();
            const nextMinutes = Math.ceil((currentMinutes + 0.1) / freqMins) * freqMins;

            const nextRun = new Date(now);
            nextRun.setMinutes(nextMinutes);
            nextRun.setSeconds(0);
            nextRun.setMilliseconds(0);

            const diffMs = nextRun.getTime() - now.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);

            setNextRunIn(`${diffMins}m ${diffSecs}s`);
        };

        const timer = setInterval(calculateNextRun, 1000);
        calculateNextRun();

        return () => clearInterval(timer);
    }, [isEnabled, frequency]);

    const handleUpdateSettings = async (updates: { isEnabled?: boolean, frequency?: string }) => {
        try {
            setLoadingSettings(true);
            const response = await fetch('/api/admin/job-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId,
                    isEnabled: updates.isEnabled !== undefined ? updates.isEnabled : isEnabled,
                    cronExpression: updates.frequency !== undefined ? updates.frequency : frequency
                }),
            });

            const data = await response.json();
            if (data.isSuccess) {
                if (updates.isEnabled !== undefined) setIsEnabled(updates.isEnabled);
                if (updates.frequency !== undefined) setFrequency(updates.frequency);
                toast.success('Scheduler settings updated successfully');
            } else {
                throw new Error(data.message || 'Failed to update settings');
            }
        } catch (error) {
            console.error('Error updating job settings:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update settings');
        } finally {
            setLoadingSettings(false);
        }
    };

    const runScheduler = async () => {
        try {
            setLoading(true);
            setResult(null);

            const authHeader = `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'test-secret-key'}`;

            const [campaignRes, planExpiryRes, socialMetricsRes] = await Promise.allSettled([
                fetch('/api/scheduler/campaign-posts', {
                    method: 'GET',
                    headers: { 'Authorization': authHeader, 'x-manual-run': 'true' },
                }).then(r => r.json()),
                fetch('/api/scheduler/plan-expiry', {
                    method: 'GET',
                    headers: { 'Authorization': authHeader },
                }).then(r => r.json()),
                fetch('/api/scheduler/social-metrics', {
                    method: 'GET',
                    headers: { 'Authorization': authHeader },
                }).then(r => r.json()),
            ]);

            const campaignData = campaignRes.status === 'fulfilled' ? campaignRes.value : { success: false, error: campaignRes.reason?.message };
            const planExpiryData = planExpiryRes.status === 'fulfilled' ? planExpiryRes.value : { success: false, error: planExpiryRes.reason?.message };
            const socialMetricsData = socialMetricsRes.status === 'fulfilled' ? socialMetricsRes.value : { success: false, error: socialMetricsRes.reason?.message };

            const allSuccess = campaignData.success && planExpiryData.success && socialMetricsData.success;

            setResult({
                success: allSuccess,
                timestamp: new Date().toISOString(),
                results: campaignData.results || { total: 0, processed: 0, failed: 0, errors: [] },
                message: [
                    `Campaign Posts: ${campaignData.success ? '✅' : '❌'} ${campaignData.message || campaignData.error || ''}`,
                    `Plan Expiry: ${planExpiryData.success ? '✅' : '❌'} ${planExpiryData.message || planExpiryData.error || ''}`,
                    `Social Metrics: ${socialMetricsData.success ? '✅' : '❌'} ${socialMetricsData.message || socialMetricsData.error || ''}`,
                ].join('\n'),
            });

            setLastRun(new Date().toISOString());

            if (allSuccess) {
                toast.success('All scheduler jobs completed successfully!');
            } else {
                toast.warning('Some scheduler jobs had issues. Check results below.');
            }
        } catch (error) {
            console.error('Error running schedulers:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to run schedulers');
            setResult({
                success: false,
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSeed = async () => {

        try {
            setIsSeeding(true);
            const response = await fetch('/api/admin/seed', {
                method: 'POST',
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Database initialized with default scheduler settings');
            } else {
                throw new Error(data.error || 'Failed to seed database');
            }
        } catch (error) {
            console.error('Error seeding database:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to seed database');
        } finally {
            setIsSeeding(false);
            window.location.reload();
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Scheduler Management</h2>
                <p className="text-muted-foreground">
                    Manage and monitor all automated scheduler jobs
                </p>
            </div>

            {/* Status Toggle Card */}
            <Card className={isEnabled ? 'border-primary/50' : ''}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Settings className="size-5" />
                                Automatic Scheduler
                            </CardTitle>
                            <CardDescription>
                                Enable or disable the automatic processing of scheduled posts
                            </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                            {loadingSettings ? (
                                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            ) : (
                                <Badge variant={isEnabled ? 'default' : 'secondary'}>
                                    {isEnabled ? 'Active' : 'Disabled'}
                                </Badge>
                            )}
                            <Switch
                                id="scheduler-toggle"
                                checked={isEnabled}
                                onCheckedChange={(checked) => handleUpdateSettings({ isEnabled: checked })}
                                disabled={loadingSettings}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="frequency">Check Frequency</Label>
                            <div className=" rounded-md">
                                <Select
                                    value={frequency}
                                    onValueChange={(value) => handleUpdateSettings({ frequency: value })}
                                    disabled={loadingSettings}
                                >
                                    <SelectTrigger id="frequency">
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">Every 5 minutes</SelectItem>
                                        <SelectItem value="10">Every 10 minutes</SelectItem>
                                        <SelectItem value="15">Every 15 minutes</SelectItem>
                                        <SelectItem value="30">Every 30 minutes</SelectItem>
                                        <SelectItem value="60">Every 1 hour</SelectItem>
                                    </SelectContent>
                                </Select></div>
                            <p className="text-xs text-muted-foreground">
                                How often the system checks for and sends scheduled posts.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Next Automatic Run</Label>
                            <div className="h-9 flex items-center px-3 rounded-md bg-muted/50 border border-dashed font-mono text-sm">
                                <Timer className="size-4 mr-2 text-primary" />
                                {nextRunIn}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Estimated time until the next automatic check.
                            </p>
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-dashed flex items-start gap-2">
                        <Clock className="size-4 mt-0.5 text-primary" />
                        <div>
                            {isEnabled ? (
                                <p>The scheduler is currently <strong>running automatically</strong> every {frequency} minutes in production.</p>
                            ) : (
                                <p>The scheduler is <strong>stopped</strong>. No scheduled posts will be sent automatically until re-enabled.</p>
                            )}
                        </div>
                    </div>

                    {/* Seed Button for empty table */}
                    {!isEnabled && !loadingSettings && (
                        <div className="pt-4 border-t border-dashed">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium">Enable Scheduler & Initial Setup</h4>
                                    <p className="text-xs text-muted-foreground">
                                        If the scheduler is disabled or settings are missing, click below to enable and initialize them.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSeed}
                                    disabled={isSeeding}
                                >
                                    {isSeeding ? <Loader2 className="size-3 mr-2 animate-spin" /> : <RefreshCw className="size-3 mr-2" />}
                                    Enable & Initialize Settings
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Control Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Run All Scheduler Jobs</CardTitle>
                    <CardDescription>
                        Click the button below to manually run all 3 scheduler jobs together: Campaign Posts, Plan Expiry Notifications, and Social Metrics.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={runScheduler}
                            disabled={loading}
                            size="lg"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Running All Jobs...
                                </>
                            ) : (
                                <>
                                    <Play className="size-4 mr-2" />
                                    Run All Schedulers Now
                                </>
                            )}
                        </Button>

                        {lastRun && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="size-4" />
                                Last run: {new Date(lastRun).toLocaleString()}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="p-3 border rounded-lg bg-muted/30 text-center">
                            <div className="font-medium">📬 Campaign Posts</div>
                            <div className="text-xs text-muted-foreground mt-1">Sends scheduled posts</div>
                        </div>
                        <div className="p-3 border rounded-lg bg-muted/30 text-center">
                            <div className="font-medium">⏰ Plan Expiry</div>
                            <div className="text-xs text-muted-foreground mt-1">Sends expiry reminders</div>
                        </div>
                        <div className="p-3 border rounded-lg bg-muted/30 text-center">
                            <div className="font-medium">📊 Social Metrics</div>
                            <div className="text-xs text-muted-foreground mt-1">Refreshes metrics data</div>
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        <p>ℹ️ All jobs run automatically via Vercel Cron in production.</p>
                        <p className="mt-1">This manual trigger is useful for testing and immediate execution.</p>
                    </div>
                </CardContent>
            </Card>


            {/* Results Card */}
            {result && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Execution Results</CardTitle>
                            {result.success ? (
                                <Badge variant="default" className="gap-1">
                                    <CheckCircle className="size-3" />
                                    Success
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="gap-1">
                                    <XCircle className="size-3" />
                                    Failed
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Executed at {new Date(result.timestamp).toLocaleString()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {result.message && (
                            <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                                <h4 className="font-medium text-sm mb-2">Job Results:</h4>
                                {result.message.split('\n').map((line, i) => (
                                    <div key={i} className="text-sm">{line}</div>
                                ))}
                            </div>
                        )}

                        {result.success && result.results ? (
                            <>
                                {/* Summary Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 border rounded-lg">
                                        <div className="text-2xl font-bold">{result.results.total}</div>
                                        <div className="text-sm text-muted-foreground">Total Posts</div>
                                    </div>
                                    <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {result.results.processed}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Processed</div>
                                    </div>
                                    <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950">
                                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                            {result.results.failed}
                                        </div>
                                        <div className="text-sm text-muted-foreground">Failed</div>
                                    </div>
                                </div>

                                {/* Errors */}
                                {result.results.errors.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Errors:</h4>
                                        <div className="space-y-2">
                                            {result.results.errors.map((error, index) => (
                                                <div
                                                    key={index}
                                                    className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <XCircle className="size-4 text-red-600 dark:text-red-400 mt-0.5" />
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium">
                                                                Post ID: {error.postId}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {error.error}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {result.results.total === 0 && (
                                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="size-4 text-blue-600 dark:text-blue-400" />
                                            <div className="text-sm">
                                                No scheduled posts found. All posts are either already sent or scheduled for later.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950">
                                <div className="flex items-start gap-2">
                                    <XCircle className="size-4 text-red-600 dark:text-red-400 mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">Error</div>
                                        <div className="text-sm text-muted-foreground">
                                            {result.error || result.message || 'Unknown error occurred'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* How It Works Card */}
            <Card>
                <CardHeader>
                    <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold">1</span>
                        </div>
                        <div>
                            <div className="font-medium">Check Scheduled Posts</div>
                            <div className="text-muted-foreground">
                                Finds all posts with scheduledPostTime ≤ now and isPostSent = false
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold">2</span>
                        </div>
                        <div>
                            <div className="font-medium">Process Each Post</div>
                            <div className="text-muted-foreground">
                                Sends via appropriate channel (Email, SMS, WhatsApp, Social Media)
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold">3</span>
                        </div>
                        <div>
                            <div className="font-medium">Update Status</div>
                            <div className="text-muted-foreground">
                                Marks posts as sent and creates notifications
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
