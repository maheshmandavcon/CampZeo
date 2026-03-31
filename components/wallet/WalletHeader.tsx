'use client';

import { useEffect, useState } from 'react';
import { Phone, MessageSquare, Wallet } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function WalletHeader() {
    const [balance, setBalance] = useState<{ smsCreditsAvailable: number; whatsappCreditsAvailable: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const fetchBalance = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/wallet/balance');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();

            if (data.isAdmin) {
                setIsAdmin(true);
                return;
            }

            if (data.wallet) {
                const hasCredits = (data.wallet.smsCreditsAvailable > 0 || data.wallet.whatsappCreditsAvailable > 0);
                if (hasCredits) {
                    setBalance({
                        smsCreditsAvailable: data.wallet.smsCreditsAvailable || 0,
                        whatsappCreditsAvailable: data.wallet.whatsappCreditsAvailable || 0
                    });
                    setIsVisible(true);
                    localStorage.setItem('campzeo_wallet_active', 'true');
                }
            }
        } catch (error) {
            console.error('Failed to fetch wallet balance:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch if we've previously detected a wallet or if explicitly triggered
        const wasActive = localStorage.getItem('campzeo_wallet_active') === 'true';
        if (wasActive) {
            fetchBalance();
        }

        const handleUpdate = () => {
            localStorage.setItem('campzeo_wallet_active', 'true');
            fetchBalance();
        };

        window.addEventListener('wallet-updated', handleUpdate);
        
        let interval: NodeJS.Timeout;
        if (wasActive) {
            interval = setInterval(fetchBalance, 5 * 60 * 1000);
        }

        return () => {
            window.removeEventListener('wallet-updated', handleUpdate);
            if (interval) clearInterval(interval);
        };
    }, []);

    if (loading && !balance) return <div className="h-9 w-9 animate-pulse bg-muted rounded-full mx-2" />;
    if (isAdmin || !isVisible || !balance) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-primary/10 transition-colors mx-1">
                    <Wallet className="size-5 text-primary" />
                    {(balance.smsCreditsAvailable > 0 || balance.whatsappCreditsAvailable > 0) && (
                        <span className="absolute top-2 right-2 flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-4" align="end">
                <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-2">Credits Balance</h4>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Phone className="size-4 text-blue-500" />
                            <span className="text-sm font-medium">SMS</span>
                        </div>
                        <span className="text-sm font-bold">{balance.smsCreditsAvailable.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="size-4 text-green-500" />
                            <span className="text-sm font-medium">WhatsApp</span>
                        </div>
                        <span className="text-sm font-bold">{balance.whatsappCreditsAvailable.toLocaleString()}</span>
                    </div>

                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2 text-xs h-8 cursor-pointer"
                        onClick={() => window.location.href = '/organisation/billing'}
                    >
                        View Billing
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
