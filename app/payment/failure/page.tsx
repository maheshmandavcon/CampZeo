"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, RefreshCcw, HelpCircle } from "lucide-react";
import Link from "next/link";

function PaymentFailureContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="size-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="size-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-red-700">Payment Failed</CardTitle>
          <CardDescription>
            We couldn't process your payment. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-left">
            <p className="text-sm font-medium text-red-800 mb-1">Error Details:</p>
            <p className="text-sm text-red-600">
              {error || "The transaction was declined by the bank or cancelled."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button className="w-full" asChild>
              <Link href="/onboarding">
                <RefreshCcw className="mr-2 size-4" /> Try Again
              </Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="mailto:support@campzeo.com">
                <HelpCircle className="mr-2 size-4" /> Contact Support
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PaymentFailureContent />
    </Suspense>
  );
}
