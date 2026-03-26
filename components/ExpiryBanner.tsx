"use client";

import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ExpiryBannerProps {
    daysRemaining: number;
    planName: string;
    expiryDate: string;
    type: 'trial' | 'subscription';
}

export function ExpiryBanner({ daysRemaining, planName, expiryDate, type }: ExpiryBannerProps) {
    if (daysRemaining > 3 || daysRemaining < 0) return null;

    const isUrgent = daysRemaining <= 1;
    const formattedDate = new Date(expiryDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const bannerStyles = isUrgent 
        ? "bg-red-50 border-red-200 text-red-800" 
        : "bg-amber-50 border-amber-200 text-amber-800";
    
    const iconContainerStyles = isUrgent
        ? "bg-red-100 text-red-600"
        : "bg-amber-100 text-amber-600";

    const buttonStyles = isUrgent
        ? "bg-red-600 hover:bg-red-700 text-white"
        : "bg-amber-600 hover:bg-amber-700 text-white";

    return (
        <div className={`w-full border-b px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-4 z-40 relative animate-in fade-in slide-in-from-top duration-500 ${bannerStyles}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full shrink-0 ${iconContainerStyles}`}>
                    <AlertTriangle className="size-5" />
                </div>
                <div className="text-sm md:text-base font-medium">
                    <span className="font-bold">Plan Expiring Soon: </span>
                    Your {planName} {type === 'trial' ? 'Free Trial' : 'Plan'} expires in 
                    <span className="mx-1 px-1.5 py-0.5 rounded bg-white/50 font-bold border border-current/10">
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                    </span> 
                    on {formattedDate}.
                    <span className="hidden lg:inline ml-1 opacity-90 italic">Please renew your subscription to maintain full access to all features.</span>
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <Button 
                    asChild 
                    size="sm" 
                    className={`font-semibold shadow-sm transition-all active:scale-95 ${buttonStyles}`}
                >
                    <Link href="/organisation/billing">
                        <CreditCard className="size-4 mr-2" />
                        Pay Now & Renew
                    </Link>
                </Button>
            </div>
        </div>
    );
}
