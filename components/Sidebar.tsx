'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    FileText,
    Users,
    BarChart3,
    CreditCard,
    Settings,
} from 'lucide-react';

export function Sidebar() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        return pathname === path || pathname?.startsWith(`${path}/`);
    };

    return (
        <aside className="w-64 border-r bg-background min-h-[calc(100vh-4rem)] p-4">
            <nav className="space-y-2">
                <Button
                    variant={isActive('/organisation') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    asChild
                >
                    <Link href="/organisation">
                        <LayoutDashboard className="size-4 mr-2" />
                        Dashboard
                    </Link>
                </Button>
                <Button
                    variant={isActive('/contacts') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    asChild
                >
                    <Link href="/contacts">
                        <FileText className="size-4 mr-2" />
                        Contacts
                    </Link>
                </Button>
                <Button
                    variant={isActive('/organisation/campaigns') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    asChild
                >
                    <Link href="/organisation/campaigns">
                        <Users className="size-4 mr-2" />
                        Campaigns
                    </Link>
                </Button>
                <Button
                    variant={isActive('/organisation/templates') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    asChild
                >
                    <Link href="/organisation/templates">
                        <FileText className="size-4 mr-2" />
                        Templates
                    </Link>
                </Button>
                <Button
                    variant={isActive('/organisation/settings') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    asChild
                >
                    <Link href="/organisation/settings">
                        <FileText className="size-4 mr-2" />
                        Accounts
                    </Link>
                </Button>
                <Button
                    variant={isActive('/organisation/analytics') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    asChild
                >
                    <Link href="/organisation/analytics">
                        <FileText className="size-4 mr-2" />
                        Analytics
                    </Link>
                </Button>
                {/* <Button variant="ghost" className="w-full justify-start">
                    <Users className="size-4 mr-2" />
                    Team
                </Button>
                <Button
                    variant={isActive('/organisation/analytics') ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    asChild
                >
                    <Link href="/organisation/analytics">
                        <BarChart3 className="size-4 mr-2" />
                        Analytics
                    </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                    <CreditCard className="size-4 mr-2" />
                    Billing
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                    <Settings className="size-4 mr-2" />
                    Settings
                </Button> */}
            </nav>
        </aside>
    );
}
