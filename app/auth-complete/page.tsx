"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCompletePage() {
    const searchParams = useSearchParams();
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const error = searchParams.get("error");

    useEffect(() => {

        if (window.opener) {
            window.opener.postMessage(
                {
                    type: "AUTH_COMPLETE",
                    status,
                    platform,
                    error,
                },
                window.location.origin
            );

            setTimeout(() => {
                window.close();
            }, 1000);
        } else {
            window.location.href = "/organisation/settings";
        }
    }, [status, platform, error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
            <div className="space-y-4">
                {status === "success" ? (
                    <>
                        <div className="flex justify-center">
                            <div className="rounded-full bg-green-100 p-3">
                                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Authentication Successful!</h1>
                        <p className="text-muted-foreground">This window will close automatically.</p>
                    </>
                ) : (
                    <>
                        <div className="flex justify-center">
                            <div className="rounded-full bg-red-100 p-3">
                                <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Authentication Failed</h1>
                        <p className="text-muted-foreground">{error || "An error occurred during authentication."}</p>
                        <p className="text-sm text-muted-foreground mt-2 italic">You can close this window manually.</p>
                    </>
                )}
                <div className="flex justify-center pt-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            </div>
        </div>
    );
}
