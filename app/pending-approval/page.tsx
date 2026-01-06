"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Clock, Home, Mail, CheckCircle2, ArrowLeft } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/50 via-background to-background p-4">
      <Card className="w-full max-w-2xl shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center pb-6 pt-10">
          <div className="flex justify-center mb-6">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="size-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl md:text-4xl font-bold tracking-tight">
            Thank You for Your Interest!
          </CardTitle>
          <CardDescription className="text-lg mt-3 max-w-xl mx-auto">
            Your free trial request has been submitted successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 md:px-12 pb-12 space-y-8">
          {/* Status Message */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              What Happens Next?
            </h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <span>Our team will review your request within <strong className="text-foreground">24-48 hours</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <span>You'll receive an email notification once your account is approved</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <span>After approval, you'll get full access to your 14-day free trial</span>
              </li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              Need Help?
            </h3>
            <p className="text-muted-foreground mb-4">
              If you have any questions or need immediate assistance, feel free to reach out to us:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Email:</span>
                <a href="mailto:office@campzeo.com" className="text-primary hover:underline">
                  office@campzeo.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Phone:</span>
                <a href="tel:+955500000000" className="text-primary hover:underline">
                  +95 55 000-0000
                </a>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full" size="lg">
                <ArrowLeft className="mr-2 size-4" />
                Back to Home
              </Button>
            </Link>
            <Link href="/pricing" className="flex-1">
              <Button className="w-full" size="lg">
                View Pricing Plans
              </Button>
            </Link>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-4">
            We appreciate your patience. Our team is working hard to review all requests as quickly as possible.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
