"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, Cookie } from "lucide-react";
import Link from "next/link";
import { Header } from '@/components/Header';

export default function CookiePolicyPage() {
    return (
        <div className="min-h-screen">
            <Header />

            <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
                <div className="max-w-4xl mx-auto">
                    <Link href="/">
                        <Button variant="ghost" className="mb-6">
                            <ArrowLeft className="mr-2 size-4" />
                            Back to Home
                        </Button>
                    </Link>

                    <div className="flex items-center gap-3 mb-4">
                        <Cookie className="size-12 text-primary" />
                        <h1 className="text-4xl font-bold">Cookie Policy</h1>
                    </div>

                    <p className="text-muted-foreground text-lg mb-2">
                        Last Updated: December 23, 2025
                    </p>

                    <p className="text-muted-foreground">
                        This Cookie Policy explains how Campzeo uses cookies and similar technologies to recognize you when you visit our website.
                    </p>
                </div>
            </section>

            <section className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>What are cookies?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">
                                Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Types of Cookies We Use</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-lg mb-2">Essential Cookies</h3>
                                <p className="text-muted-foreground mb-4">
                                    These cookies are strictly necessary to provide you with services available through our Website and to use some of its features, such as access to secure areas.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                                    <li><strong>Clerk Authentication:</strong> Used for secure login and session management. Cookies include `__session`, `__client_uat`, etc.</li>
                                    <li><strong>Admin Impersonation:</strong> Used for administrative support to troubleshoot user accounts (`admin_impersonation`).</li>
                                    <li><strong>Security:</strong> Cookies used to prevent cross-site request forgery (CSRF) and other security threats.</li>
                                    <li><strong>System Preferences:</strong> Used to store your cookie consent choices (`cookie-consent` in local storage).</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg mb-2">Analytics and Performance Cookies</h3>
                                <p className="text-muted-foreground mb-4">
                                    These cookies collect information that is used either in aggregate form to help us understand how our Website is being used or how effective our marketing campaigns are.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                                    <li><strong>Google Analytics:</strong> We use Google Analytics (G-XHEXP4D7RE) to understand user behavior. Cookies include `_ga`, `_ga_*`, etc.</li>
                                    <li><strong>Vercel Insights:</strong> Used by our hosting provider to monitor application performance and vitals.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg mb-2">Functional Cookies</h3>
                                <p className="text-muted-foreground mb-4">
                                    These are used to recognize you when you return to our Website. This enables us to personalize our content for you and remember your preferences.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>How can I control cookies?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">
                                You have the right to decide whether to accept or reject cookies. You can exercise your preferences by clicking on the appropriate opt-out links provided in the cookie banner that appears when you visit our website.
                            </p>
                            <p className="text-muted-foreground">
                                If you choose to reject cookies, you may still use our website, though your access to some functionality (like personalized dashboards) may be restricted. Most browsers allow you to control cookies through their settings.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
                <div className="max-w-4xl mx-auto text-center">
                    <Link href="/">
                        <Button size="lg">Back to Home</Button>
                    </Link>
                </div>
            </footer>
        </div>
    );
}
