'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignedIn, UserButton } from '@clerk/clerk-react';
import { Zap, Home, Bell } from 'lucide-react';
import { WalletHeader } from './wallet/WalletHeader';

export function Header() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/user/me');
                if (res.ok) {
                    const data = await res.json();
                    setUserRole(data.role);
                }
            } catch (error) {
                console.error('Failed to fetch user role:', error);
            }
        };
        fetchUser();
    }, []);

    const isAdmin = userRole === 'ADMIN_USER';

    return (
        <header className="sticky top-0 z-40 border-b bg-background">
            <div className="flex h-16 items-center gap-4 px-6">
                <div className="flex items-center gap-2 font-semibold">
                    <img src="/logo-1.png" alt="CampZeo" style={{ width: '100%', height: '50px' }} />
                </div>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                    <Home className="size-5" />
                </Button>
                <SignedIn>
                    {!isAdmin && <WalletHeader />}
                    <Button variant="ghost" size="icon">
                        <Bell className="size-5" />
                    </Button>
                    <UserButton />
                </SignedIn>
            </div>
        </header>
    );
}
