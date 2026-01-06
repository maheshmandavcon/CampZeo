'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignedIn, UserButton } from '@clerk/clerk-react';
import { Zap, Home, Bell } from 'lucide-react';

export function Header() {
    const router = useRouter();

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
                <Button variant="ghost" size="icon">
                    <Bell className="size-5" />
                </Button>
                    <UserButton />
                </SignedIn>
            </div>
        </header>
    );
}
