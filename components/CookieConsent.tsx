"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie, X } from "lucide-react";
import Link from "next/link";

export function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already made a choice
        const consent = localStorage.getItem("cookie-consent");
        if (!consent) {
            setIsVisible(true);
        } else if (consent === "all") {
            updateConsent(true);
        }
    }, []);

    const updateConsent = (isAccepted: boolean) => {
        if (typeof window !== "undefined" && (window as any).gtag) {
            (window as any).gtag('consent', 'update', {
                'analytics_storage': isAccepted ? 'granted' : 'denied',
                'ad_storage': isAccepted ? 'granted' : 'denied',
                'ad_user_data': isAccepted ? 'granted' : 'denied',
                'ad_personalization': isAccepted ? 'granted' : 'denied'
            });
        }
    };

    const handleAcceptAll = () => {
        localStorage.setItem("cookie-consent", "all");
        updateConsent(true);
        setIsVisible(false);
    };

    const handleAcceptNecessary = () => {
        localStorage.setItem("cookie-consent", "necessary");
        updateConsent(false);
        setIsVisible(false);
    };

    const handleRejectAll = () => {
        localStorage.setItem("cookie-consent", "none");
        updateConsent(false);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 animate-in fade-in slide-in-from-bottom-10 duration-500">
            <Card className="max-w-4xl mx-auto shadow-2xl border-primary/20 bg-background/95 backdrop-blur-md">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="hidden md:flex size-12 rounded-full bg-primary/10 items-center justify-center shrink-0">
                            <Cookie className="size-6 text-primary" />
                        </div>

                        <div className="flex-1 space-y-2">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Cookie className="size-5 md:hidden text-primary" />
                                We value your privacy
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic.
                                By clicking "Accept All", you consent to our use of cookies.
                                Read our <Link href="/cookies" className="text-primary hover:underline">Cookie Policy</Link> and <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link> for more details.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 shrink-0 pt-2 md:pt-0 w-full md:w-auto">
                            <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={handleRejectAll}>
                                Reject All
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={handleAcceptNecessary}>
                                Only Necessary
                            </Button>
                            <Button size="sm" className="flex-1 md:flex-none bg-[#DC2626] hover:bg-red-700" onClick={handleAcceptAll}>
                                Accept All
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
