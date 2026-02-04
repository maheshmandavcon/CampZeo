
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, DollarSign, ExternalLink, Loader2, RefreshCw, Rocket, Sparkles, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import Script from 'next/script';
import { getNativeBoostUrl, parseMetaPostId } from '@/lib/meta-boost-utils';

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: any;
    }
}

export interface MetaBoostOptions {
    enabled: boolean;
    adAccountId: string;
    budget: number;
    duration: number;
    objective: 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEAD_GENERATION';
}

interface MetaAdAccount {
    id: string;
    name: string;
    account_status: number;
    currency: string;
    balance: string;
}

interface MetaBoostSectionProps {
    platform: string;
    options: MetaBoostOptions;
    onChange: (options: MetaBoostOptions) => void;
    facebookAppId?: string | null;
    fbPostId?: string | null;
    fbPageId?: string | null;
}

export const MetaBoostSection: React.FC<MetaBoostSectionProps> = ({ platform, options, onChange, facebookAppId, fbPostId, fbPageId }) => {
    const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<MetaAdAccount | null>(null);
    const [estimate, setEstimate] = useState<any>(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    const [appId, setAppId] = useState<string | null>(facebookAppId || null);
    const [sdkLoaded, setSdkLoaded] = useState(false);

    const isMeta = platform === 'FACEBOOK' || platform === 'INSTAGRAM';

    useEffect(() => {
        if (options.enabled && accounts.length === 0) {
            fetchAccounts();
        }
    }, [options.enabled]);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/socialmedia/meta-ads/accounts');
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts || []);
                if (data.accounts?.length > 0 && !options.adAccountId) {
                    onChange({ ...options, adAccountId: data.accounts[0].id });
                }
            } else {
                toast.error("Failed to fetch ad accounts. Please ensure Facebook is connected with Ads permissions.");
            }
        } catch (error) {
            console.error("Error fetching ad accounts:", error);
        } finally {
            setLoading(false);
        }
    };

    // Initialize Facebook SDK when appId is available
    useEffect(() => {
        if (!appId || typeof window === 'undefined') return;

        window.fbAsyncInit = function () {
            window.FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v22.0'
            });
            setSdkLoaded(true);
        };

        // Load the SDK asynchronously
        (function (d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s) as HTMLScriptElement;
            js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode?.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    }, [appId]);

    const handleLaunchNativeBoost = () => {
        if (!selectedAccount || !fbPostId || !fbPageId) {
            toast.error("Please select an ad account and ensure the post is published on Facebook.");
            return;
        }

        const url = getNativeBoostUrl(options.adAccountId, fbPageId, fbPostId);

        // Open in a centered popup
        const width = 1000;
        const height = 800;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(url, 'fbBoost', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
        toast.info("Opening Native Meta Boost Centre...");
    };

    const handleAddPaymentMethod = () => {
        if (!window.FB) {
            toast.error("Facebook SDK not loaded yet. Please try again in a moment.");
            return;
        }

        if (!selectedAccount) return;

        // Strip 'act_' prefix if present
        const accountId = selectedAccount.id.replace('act_', '');

        window.FB.ui({
            method: 'ads_payment',
            account_id: accountId,
        }, function (response: any) {
            console.log("Ads Payment Dialog Response:", response);
            if (response && !response.error_code) {
                toast.success("Payment method update initiated.");
                // Optionally refresh accounts after a delay
                setTimeout(fetchAccounts, 5000);
            }
        });
    };

    // Fetch reach estimate when inputs change
    useEffect(() => {
        if (!options.enabled || !options.adAccountId || !options.budget || !options.duration) {
            setEstimate(null);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setLoadingEstimate(true);
                const params = new URLSearchParams({
                    adAccountId: options.adAccountId,
                    budget: options.budget.toString(),
                    days: options.duration.toString(),
                    objective: options.objective
                });
                const res = await fetch(`/api/socialmedia/meta-ads/reach-estimate?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setEstimate(data.estimate);
                }
            } catch (error) {
                console.error("Error fetching reach estimate:", error);
            } finally {
                setLoadingEstimate(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [options.enabled, options.adAccountId, options.budget, options.duration, options.objective]);

    useEffect(() => {
        if (options.adAccountId && accounts.length > 0) {
            const acc = accounts.find(a => a.id === options.adAccountId);
            setSelectedAccount(acc || null);
        }
    }, [options.adAccountId, accounts]);

    if (!isMeta) return null;

    const handleToggle = (checked: boolean) => {
        onChange({ ...options, enabled: checked });
    };

    const isAccountActive = selectedAccount?.account_status === 1;
    // In Meta, balance is often what you OWE (postpaid). 
    // For prepaid, it might be different. Let's assume if balance > 0 it means money is due. 
    // Actually, users usually mean "Available Funds". 
    // If account_status is 1, it's generally active.
    const rawBalance = parseFloat(selectedAccount?.balance || '0');
    const balanceDisplay = (rawBalance / 100).toFixed(2);
    // If balance is 0 and status is 1, it's usually healthy (postpaid).
    // If it's prepaid, balance 0 means action needed.
    // For now, let's keep it simple: if account is active, it's green, but show Add Funds if they want.
    const isAccountReady = isAccountActive;

    return (
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-primary/10 bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Rocket className="w-5 h-5 text-primary" />
                        <div>
                            <CardTitle className="text-lg">Meta Boosting</CardTitle>
                            <CardDescription>Reach more people on Facebook & Instagram</CardDescription>
                        </div>
                    </div>
                    <Switch
                        checked={options.enabled}
                        onCheckedChange={handleToggle}
                        className="data-[state=checked]:bg-primary"
                    />
                </div>
            </CardHeader>

            {options.enabled && (
                <CardContent className="pt-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center py-8 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading your ad accounts...</p>
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="text-center py-6 px-4 border-2 border-dashed rounded-lg border-primary/20">
                            <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                            <p className="text-sm font-medium mb-1">No Ad Accounts Found</p>
                            <p className="text-xs text-muted-foreground mb-4">
                                You need a Meta Ad Account to boost posts. Make sure your account has enough permissions.
                            </p>
                            <Button variant="outline" size="sm" onClick={fetchAccounts}>
                                <RefreshCw className="w-3 h-3 mr-2" /> Retry
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Ad Account Selection */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Select Ad Account</Label>
                                <Select
                                    value={options.adAccountId}
                                    onValueChange={(val) => onChange({ ...options, adAccountId: val })}
                                >
                                    <SelectTrigger className="bg-background/50 border-primary/20 focus:ring-primary">
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                {acc.name} ({acc.currency})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Native Boost Integration */}
                            {fbPostId && (
                                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg border-none animate-in zoom-in-95 duration-500">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                                                <Facebook className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold">Integrated Native Boost</h4>
                                                <p className="text-[10px] text-white/80">Use the original Meta interface in a popup</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-white/20 text-[10px] hover:bg-white/30 border-none">PREMIUM</Badge>
                                    </div>
                                    <Button
                                        className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold shadow-sm"
                                        onClick={handleLaunchNativeBoost}
                                        disabled={!options.adAccountId}
                                    >
                                        <Rocket className="w-4 h-4 mr-2" />
                                        Launch Native Meta Boost Centre
                                    </Button>
                                    <p className="text-[9px] text-center mt-2 text-white/70 italic">
                                        * Provides advanced targeting, budget options, and native Meta trust.
                                    </p>
                                </div>
                            )}

                            {/* Account Status / Health */}
                            {selectedAccount && (
                                <div className={`p-4 rounded-xl flex items-start gap-3 border shadow-sm transition-all ${isAccountReady ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <div className={`p-2 rounded-full ${isAccountReady ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                        {isAccountReady ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-red-600" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${isAccountReady ? 'text-emerald-700' : 'text-red-700'}`}>
                                                {isAccountReady ? 'Account Ready' : 'Action Required'}
                                            </span>
                                            <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                                                Balance: {selectedAccount.currency} {balanceDisplay}
                                            </Badge>
                                        </div>

                                        {!isAccountReady || rawBalance === 0 ? (
                                            <div className="mt-2 text-xs text-muted-foreground bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-red-200/50">
                                                <p className="mb-3 font-medium text-red-800 dark:text-red-300">
                                                    {!isAccountActive ? "Your ad account is currently disabled." : "Ready to boost! Add funds or a payment method if needed."}
                                                </p>
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="h-8 text-xs w-full bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                                        onClick={handleAddPaymentMethod}
                                                    >
                                                        <DollarSign className="w-3 h-3 mr-1" /> Add Funds (Pop-up)
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs w-full border-red-200 text-red-700 hover:bg-red-50"
                                                        onClick={() => window.open(`https://adsmanager.facebook.com/billing_hub/?act=${selectedAccount.id.replace('act_', '')}`, '_blank')}
                                                    >
                                                        <ExternalLink className="w-3 h-3 mr-1" /> Open Ads Manager Billing
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">Your account is in good standing and ready for boosting.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Objective Selection */}
                            <div className="space-y-2 pt-2">
                                <Label className="text-sm font-semibold">Campaign Objective</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onChange({ ...options, objective: 'OUTCOME_ENGAGEMENT' })}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${options.objective === 'OUTCOME_ENGAGEMENT' ? 'border-primary bg-primary/10 shadow-sm' : 'border-primary/10 hover:border-primary/30 bg-background/50'}`}
                                    >
                                        <CheckCircle2 className={`w-5 h-5 mb-1 ${options.objective === 'OUTCOME_ENGAGEMENT' ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span className="text-xs font-bold">Engagement</span>
                                        <span className="text-[10px] text-muted-foreground">Likes, Shares & Comments</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onChange({ ...options, objective: 'OUTCOME_LEAD_GENERATION' })}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${options.objective === 'OUTCOME_LEAD_GENERATION' ? 'border-primary bg-primary/10 shadow-sm' : 'border-primary/10 hover:border-primary/30 bg-background/50'}`}
                                    >
                                        <Sparkles className={`w-5 h-5 mb-1 ${options.objective === 'OUTCOME_LEAD_GENERATION' ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span className="text-xs font-bold">Leads</span>
                                        <span className="text-[10px] text-muted-foreground">Customer Form Capture</span>
                                    </button>
                                </div>
                            </div>

                            {/* Budget & Duration */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Daily Budget ($)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                        <Input
                                            type="number"
                                            min="1"
                                            value={options.budget}
                                            onChange={(e) => onChange({ ...options, budget: parseInt(e.target.value) || 0 })}
                                            className="pl-8 bg-background/50 border-primary/20 focus-visible:ring-primary h-10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Duration (Days)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={options.duration}
                                        onChange={(e) => onChange({ ...options, duration: parseInt(e.target.value) || 0 })}
                                        className="bg-background/50 border-primary/20 focus-visible:ring-primary h-10"
                                    />
                                </div>
                            </div>

                            {/* Reach Estimate */}
                            <div className="pt-2">
                                <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4 border border-primary/10 relative overflow-hidden">
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase font-bold tracking-wider text-primary/70">Estimated Daily Reach</p>
                                            <div className="flex items-baseline gap-1">
                                                {loadingEstimate ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                ) : estimate ? (
                                                    <span className="text-xl font-black text-primary tabular-nums">
                                                        {new Intl.NumberFormat().format(estimate.users_reached_min)} - {new Intl.NumberFormat().format(estimate.users_reached_max)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xl font-black text-primary/30">-</span>
                                                )}
                                                <span className="text-[10px] text-muted-foreground font-medium">people / day</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Spend</p>
                                            <p className="text-sm font-bold text-foreground">
                                                {selectedAccount?.currency} {options.budget * options.duration}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Subtle background decoration */}
                                    <Sparkles className="absolute -bottom-2 -right-2 w-16 h-16 text-primary/5 -rotate-12" />
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-2 px-1 italic">
                                    * Estimates are based on average performance for your selected objective and budget in US. Actual results may vary.
                                    {estimate === null && !loadingEstimate && (
                                        <span className="block mt-1 text-amber-600 font-bold">
                                            Tip: If reach is 0, you might need to <Button variant="link" className="h-auto p-0 text-[9px] text-amber-600 underline" onClick={() => router.push('/organisation/settings')}>re-connect Facebook</Button> to grant "Ads Management" permissions.
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
};
