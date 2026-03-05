
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
import { getNativeBoostUrl, openNativeBoostPopup, parseMetaPostId } from '@/lib/meta-boost-utils';
import router from 'next/router';

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
    balance: string;
}

interface MetaAdAccount {
    id: string;
    name: string;
    account_status: number;
    currency: string;
    balance: string;
    amount_spent: string;
}

interface MetaBoostSectionProps {
    platform: string;
    options: MetaBoostOptions;
    onChange: (options: MetaBoostOptions) => void;
    facebookAppId?: string | null;
    fbPostId?: string | null;
    fbPageId?: string | null;
}

interface Campaign {
    id: number;
    name: string;
    description: string | null;
    contacts?: any[];
    metadata?: any;
}

interface Post {
    id: number;
    subject: string | null;
    message: string | null;
    type: string;
    scheduledPostTime: string | null;
    isPostSent: boolean;
    createdAt: string;
    senderEmail: string | null;
    videoUrl: string | null;
    mediaUrls: string[];
    metadata?: any;
    liveLink?: string | null;
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

    const [lastUsedAdAccountId, setLastUsedAdAccountId] = useState<string>('');
    const [boostPost, setBoostPost] = useState<Post | null>(null);
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [availableBalance, setAvailableBalance] = useState<number | null>(null);
    const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);

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
                    const first = data.accounts[0];
                    onChange({ ...options, adAccountId: first.id, balance: first.balance });
                    // Pre-fetch balance/payment method for default account
                    fetchBalanceForAccount(first.id);
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

    const fetchBalanceForAccount = async (adAccountId: string) => {
        try {
            setAvailableBalance(null);
            setHasPaymentMethod(null);
            const res = await fetch(`/api/meta/adaccount/balance?adAccountId=${encodeURIComponent(adAccountId)}`);
            if (!res.ok) return;
            const data = await res.json();
            setAvailableBalance(data.available_balance);
            setHasPaymentMethod(!!data.has_payment_method);
        } catch (error) {
            console.error('Error fetching Meta ad account balance:', error);
            setAvailableBalance(null);
            setHasPaymentMethod(null);
        }
    };
    // Launch native Meta boost popup
    const handleLaunchNativeBoost = () => {
        if (!options.adAccountId || !fbPostId || !fbPageId) {
            toast.error("Missing required information. Please ensure an ad account is selected and the post is published on Meta.");
            return;
        }

        openNativeBoostPopup(options.adAccountId, fbPageId, fbPostId, platform === 'INSTAGRAM');
        toast.info("Opening Native Meta Boost Centre...");
    };
    // Link payment method using FB SDK or fallback to Ads Manager
    const handleAddPaymentMethod = () => {
        if (!selectedAccount) return;

        // Strip 'act_' prefix if present
        const accountId = selectedAccount.id.replace('act_', '');

        // Attempt to use FB UI if SDK is loaded
        if (window.FB && sdkLoaded) {
            window.FB.ui({
                method: 'ads_payment',
                account_id: accountId,
            }, (response: any) => {
                if (response && !response.error_code) {
                    toast.success("Payment method update initiated!");
                    setTimeout(fetchAccounts, 5000); // Refresh to see update
                }
            });
        } else {
            // Fallback to direct link
            window.open(`https://adsmanager.facebook.com/billing_hub/payment_settings?act=${accountId}`, '_blank');
            toast.info("Opening payment settings in a new tab...");
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
            if (acc) {
                fetchBalanceForAccount(acc.id);
            }
        }
    }, [options.adAccountId, accounts]);

    if (!isMeta) return null;

    const handleToggle = (checked: boolean) => {
        onChange({ ...options, enabled: checked });
    };

    const isAccountActive = selectedAccount?.account_status === 1;
    // Account is ready if active AND (either has a payment method OR has available credit)
    const isAccountReady = isAccountActive && (hasPaymentMethod === true || (availableBalance !== null && availableBalance > 0));

    const rawBalance = parseFloat(selectedAccount?.balance || '0');
    // For display, we prefer availableBalance from the API if we have it
    const balanceDisplay = availableBalance !== null
        ? availableBalance.toFixed(2)
        : (rawBalance / 100).toFixed(2);

    // Only show warning if account is active but has NO payment method and NO available funds
    const showFinancialWarning = isAccountActive && (hasPaymentMethod === false && (availableBalance === null || availableBalance <= 0));

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
            {/* Removed redundant insufficient balance message at top as it's now in the status card */}
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
                            <Button type="button" variant="outline" size="sm" onClick={fetchAccounts}>
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
                                    onValueChange={(val) => {
                                        const selected = accounts.find(a => a.id === val);
                                        onChange({
                                            ...options,
                                            adAccountId: val,
                                            balance: selected?.balance || '0'
                                        });
                                    }}
                                >
                                    <SelectTrigger className="bg-background/50 border-primary/20 focus:ring-primary backdrop-blur-sm">
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                <div className="flex flex-col py-0.5">
                                                    <span className="font-medium">{acc.name}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">
                                                        {acc.currency} • ID: {acc.id.replace('act_', '')}
                                                    </span>
                                                </div>
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
                                                <p className="text-[10px] text-white/80">Launch Meta's official boost tool</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-white/20 text-[10px] hover:bg-white/30 border-none">PREMIUM</Badge>
                                    </div>
                                    <p className="text-[11px] text-white/90 leading-relaxed">
                                        Use Meta's native interface for advanced targeting and budget options directly from CampZeo.
                                    </p>
                                </div>
                            )}

                            {/* Account Status / Health */}
                            {selectedAccount && (
                                <div className={`p-4 rounded-xl flex items-start gap-4 border shadow-sm transition-all ${isAccountReady ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <div className={`p-2 rounded-full ${isAccountReady ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                        {isAccountReady ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-red-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${isAccountReady ? 'text-emerald-700' : 'text-red-700'}`}>
                                                Financial Status
                                            </span>
                                            <Badge variant={isAccountReady ? "secondary" : "destructive"} className="font-mono text-xs tabular-nums">
                                                {isAccountReady ? 'Active' : 'Action Required'}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white/40 dark:bg-black/20 p-2 rounded-lg border border-primary/10">
                                                <p className="text-[9px] uppercase font-bold text-muted-foreground">
                                                    {availableBalance !== null ? 'Available Funds' : 'Account Balance'}
                                                </p>
                                                <p className={`text-sm font-black ${showFinancialWarning ? 'text-amber-600' : 'text-foreground'}`}>
                                                    {hasPaymentMethod === false && (availableBalance === null || availableBalance <= 0)
                                                        ? 'Not Linked'
                                                        : `${selectedAccount.currency} ${balanceDisplay}`}
                                                </p>
                                            </div>
                                            <div className="bg-white/40 dark:bg-black/20 p-2 rounded-lg border border-primary/10">
                                                <p className="text-[9px] uppercase font-bold text-muted-foreground">Lifetime Spent</p>
                                                <p className="text-sm font-black text-foreground">
                                                    {selectedAccount.currency} {(parseFloat(selectedAccount.amount_spent || '0') / 100).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        {(showFinancialWarning || !isAccountActive) && (
                                            <div className="space-y-2">
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="default"
                                                        size="sm"
                                                        className="h-9 text-xs w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold"
                                                        onClick={() => {
                                                            // If we have all the info needed for boosting, open boost page
                                                            if (fbPageId && fbPostId && options.adAccountId) {
                                                                openNativeBoostPopup(options.adAccountId, fbPageId, fbPostId, platform === 'INSTAGRAM');
                                                                toast.info("Opening Facebook Boost page to manage funds...");
                                                            }
                                                            // Otherwise, open Ads Manager billing page directly
                                                            else if (selectedAccount) {
                                                                const cleanAccountId = selectedAccount.id.replace('act_', '');
                                                                window.open(`https://adsmanager.facebook.com/billing_hub/?act=${cleanAccountId}`, '_blank');
                                                                toast.info("Opening Facebook Ads Manager to add funds...");
                                                            } else {
                                                                toast.error("Please select an ad account first.");
                                                            }
                                                        }}
                                                    >
                                                        <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                                                        {availableBalance !== null && availableBalance <= 0 && hasPaymentMethod === false ? "Add Funds" : "Resolve Payment Issues"}
                                                    </Button>

                                                    {/* Link Payment Method option */}
                                                    {hasPaymentMethod === false && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-9 text-xs w-full border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                                                            onClick={handleAddPaymentMethod}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Link Payment Method
                                                        </Button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground italic px-1">
                                                    {!isAccountActive ? "Note: Your ad account is currently disabled. Check Ads Manager for details." : "Tip: You can add funds via the Meta Boost page or Ads Manager."}
                                                </p>
                                            </div>
                                        )}
                                        {isAccountReady && rawBalance > 0 && (
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
                                    <Label className="text-sm font-semibold">Daily Budget ({selectedAccount?.currency || '$'})</Label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                                            {selectedAccount?.currency === 'USD' ? '$' : selectedAccount?.currency || '$'}
                                        </div>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={options.budget}
                                            onChange={(e) => onChange({ ...options, budget: parseInt(e.target.value) || 0 })}
                                            className="pl-12 bg-background/50 border-primary/20 focus-visible:ring-primary h-10"
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
                                                {selectedAccount?.currency || '$'} {new Intl.NumberFormat().format(options.budget * options.duration)}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Subtle background decoration */}
                                    <Sparkles className="absolute -bottom-2 -right-2 w-16 h-16 text-primary/5 -rotate-12" />
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-2 px-1 italic">
                                    * Estimates are based on Meta's historical performance data for your {selectedAccount?.currency} {options.budget} daily budget.
                                    {selectedAccount?.currency !== 'USD' && " Figures are in your local account currency."}
                                    {estimate === null && !loadingEstimate && (
                                        <span className="block mt-1 text-amber-600 font-bold">
                                            Tip: If reach is 0, you might need to <Button variant="link" className="h-auto p-0 text-[9px] text-amber-600 underline" onClick={() => router.push('/organisation/settings')}>re-connect Facebook</Button> to grant "Ads Management" permissions.
                                        </span>
                                    )}
                                </p>
                            </div>



                            {/* Final Boost Action */}
                            <div className="pt-6 border-t border-primary/20">
                                {fbPostId ? (
                                    <>
                                        <Button
                                            type="button"
                                            className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] group overflow-hidden relative"
                                            onClick={handleLaunchNativeBoost}
                                            disabled={!options.adAccountId || !fbPostId || !fbPageId}
                                        >
                                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                            <div className="relative flex items-center justify-center">
                                                <Rocket className="w-5 h-5 mr-3 animate-bounce" />
                                                Boost Post Now
                                            </div>
                                        </Button>
                                    </>
                                ) : (
                                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-bold">Scheduled Auto-Boost</p>
                                            <p className="leading-relaxed">
                                                Since this post isn't published yet, you can configure your boost settings here. CampZeo will <strong>automatically apply</strong> these settings when the post goes live on Meta.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {options.adAccountId && fbPostId && fbPageId && (
                                    <p className="text-[9px] text-center text-muted-foreground mt-2">
                                        Opening Meta Ad Center: Account <b>{options.adAccountId.replace('act_', '')}</b> • Page <b>{fbPageId}</b>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
};
