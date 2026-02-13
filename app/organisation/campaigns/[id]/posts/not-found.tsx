'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoveLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex items-center justify-center min-h-[70vh] p-4 text-center">
            <Card className="max-w-md w-full border-none shadow-none space-y-6">
                <CardContent className="pt-6">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 rounded-full bg-orange-50 text-orange-500">
                            <SearchX className="size-12" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                        Campaign Post List Not Found
                    </h1>

                    <p className="text-slate-500 mb-8">
                        The campaign you're looking for doesn't exist or you don't have access to it.
                        Please check the URL or return to the campaigns dashboard.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild variant="outline" className="cursor-pointer">
                            <Link href="/organisation/campaigns">
                                <MoveLeft className="size-4 mr-2" />
                                Back to Campaigns
                            </Link>
                        </Button>
                        <Button asChild className="cursor-pointer">
                            <Link href="/organisation">
                                Dashboard
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}