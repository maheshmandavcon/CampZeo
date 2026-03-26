"use client";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  LayoutDashboard,
  BarChart3,
  Menu,
  Contact,
  Megaphone,
  FileStack,
  UserCircle,
  Home,
  Bell, CurrencyIcon, PieChart, Users, Target
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useState } from "react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ExpiryBanner } from "@/components/ExpiryBanner";

// Navigation items configuration
const navItems = [
  { href: "/organisation", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/organisation/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/organisation/templates", label: "Templates", icon: FileStack },
  { href: "/organisation/conversations", label: "Conversations", icon: Bell },
  { href: "/organisation/settings", label: "Accounts", icon: UserCircle },
  { href: "/organisation/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/organisation/leads-analytics", label: "Leads Management", icon: Users },
  { href: "/organisation/reports", label: "Reports", icon: PieChart },
  { href: "/organisation/billing", label: "Billing", icon: CurrencyIcon },
];

const SidebarNav = ({ onItemClick }: { onItemClick?: () => void }) => {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <nav className="space-y-1 px-2">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} onClick={onItemClick}>
          <Button
            variant={isActive(item.href, item.exact) ? "secondary" : "ghost"}
            className="w-full justify-start h-10"
          >
            <item.icon className="size-4 mr-3" />
            {item.label}
          </Button>
        </Link>
      ))}
    </nav>
  );
};

export function OrganisationLayoutWrapper({
  children,
  isImpersonating,
  hasSocialTokens,
  expiryData
}: {
  children: React.ReactNode;
  isImpersonating?: boolean;
  hasSocialTokens?: boolean;
  expiryData?: {
    daysRemaining: number;
    planName: string;
    expiryDate: string;
    type: 'trial' | 'subscription';
  } | null | undefined;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const [isCheckingSocial, setIsCheckingSocial] = useState(
    hasSocialTokens === false && !isImpersonating && pathname !== '/organisation/settings'
  );

  const handleExitImpersonation = () => {
    document.cookie = "admin_impersonation=; path=/; max-age=0";
    window.location.href = "/admin";
  };

  useEffect(() => {
    // Prevent the body from scrolling while in the organisation layout
    document.body.style.overflow = 'hidden';

    return () => {
      // Re-enable scrolling when leaving the organisation layout
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (isImpersonating || pathname === '/organisation/settings') {
      setIsCheckingSocial(false);
    } else if (hasSocialTokens === false) {
      setIsCheckingSocial(true);
    }
  }, [pathname, isImpersonating, hasSocialTokens]);

  useEffect(() => {
    if (isImpersonating) return;

    let isMounted = true;

    async function checkSocialStatus() {
      try {
        const res = await fetch('/api/user/social-status');
        if (res.ok) {
          const data = await res.json();
          const hasConnectedPlatform =
            data.facebook?.connected ||
            data.instagram?.connected ||
            data.linkedin?.connected ||
            data.youtube?.connected ||
            data.pinterest?.connected;

          if (isMounted) {
            if (!hasConnectedPlatform) {
              if (pathname !== '/organisation/settings') {
                router.push('/organisation/settings');
              }
              toast.error("No social platforms connected", {
                description: "Please connect at least one social media account to continue using the platform.",
                duration: 100000000,
                id: "social-status-warning",
              });
            } else {
              toast.dismiss("social-status-warning");
              setIsCheckingSocial(false);
            }
          }
        }
      } catch (e) {
        console.error("Error checking social status:", e);
        if (isMounted && hasSocialTokens !== false) setIsCheckingSocial(false);
      }
    }

    checkSocialStatus();

    return () => {
      isMounted = false;
    };
  }, [pathname, isImpersonating, router, hasSocialTokens]);

  return (


    <div className="h-screen flex flex-col overflow-hidden bg-muted/30">
   
      {expiryData && (
        <ExpiryBanner
          daysRemaining={expiryData.daysRemaining}
          planName={expiryData.planName}
          expiryDate={expiryData.expiryDate}
          type={expiryData.type}
        />
      )}

      {isImpersonating && (
        <div className="flex-shrink-0 bg-amber-100 text-amber-900 px-4 py-1.5 text-xs font-medium text-center border-b border-amber-200 flex items-center justify-center gap-2">
          <span>You are impersonating an organisation.</span>
          <button
            onClick={handleExitImpersonation}
            className="underline hover:text-amber-700 font-bold"
          >
            Back to Admin
          </button>
        </div>
      )}

      {/* Fixed Header */}
      <header className="flex-shrink-0 h-16 border-b bg-background z-40">
        <div className="flex h-full items-center gap-4 px-6">
          {/* Mobile Menu Trigger */}
          {/* <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-background pb-10">
              <SheetTitle>
                <VisuallyHidden>Navigation Menu</VisuallyHidden>
              </SheetTitle>
              <div className="p-4 border-b">
                <img src="/logo-1.png" alt="CampZeo" className="h-8" />
              </div>
              <div className="py-4 h-full overflow-y-auto">
                <SidebarNav onItemClick={() => setMobileMenuOpen(false)} />
              </div>
            </SheetContent>
          </Sheet> */}

          {/* Logo */}
          <div className="flex items-center gap-2 font-semibold">
            <img src="/logo-1.png" alt="CampZeo" className="h-10" />
          </div>

          <div className="flex-1" />

          {/* Header Actions */}
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <Home className="size-5" />
          </Button>
          <NotificationBell />
          <SignedIn>
            <div suppressHydrationWarning>
              <UserButton />
            </div>
          </SignedIn>
        </div>
      </header>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-1  overflow-hidden">
        {/* Fixed Sidebar (Desktop Only) */}
        <aside className="hidden md:flex flex-col w-64 border-r bg-background flex-shrink-0">
          <div className="flex-1 overflow-y-auto py-4">
            <SidebarNav />
          </div>
        </aside>

        {/* Scrollable Main Content */}
        <main className="flex-1 w-full overflow-y-auto bg-background">
          <div className=" flex flex-col">
            <div className="flex-1">
              {isCheckingSocial ? (
                <div className="flex items-center justify-center p-12 mt-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                children
              )}
            </div>
            {/* Footer */}
          </div>
        </main>

      </div>
      <footer className="flex-shrink-0 border-t bg-background p-4 text-center text-sm text-muted-foreground" suppressHydrationWarning>
        &copy; {new Date().getFullYear()} CampZeo. All rights reserved.
      </footer>
    </div>
  );
}
