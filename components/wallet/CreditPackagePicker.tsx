"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap } from "lucide-react";
import { CreditRazorpayButton } from "./CreditRazorpayButton";

interface CreditPackage {
  id: number;
  name: string;
  price: number | string;
  credits: number;
  type: string;
}

interface CreditPackagePickerProps {
  packages: CreditPackage[];
  onSuccess?: () => void;
}

export function CreditPackagePicker({ packages, onSuccess }: CreditPackagePickerProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 w-full">
      {packages.map((pkg) => (
        <Card key={pkg.id} className="relative flex flex-col overflow-hidden border-primary/20 shadow-md hover:border-primary/50 transition-colors">
          {pkg.credits >= 1500 && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">
              Most Popular
            </div>
          )}
          <CardHeader>
            <CardTitle>{pkg.name}</CardTitle>
            <CardDescription>Get {pkg.credits.toLocaleString()} {pkg.type} credits instantly</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">₹{pkg.price.toString()}</span>
              <span className="text-muted-foreground text-sm">one-time</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="size-4 text-green-500" />
                <span>No expiry on credits</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 text-green-500" />
                <span>Priority delivery</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 text-green-500" />
                <span>Instant activation</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 text-green-500" />
                <span>Downloadable Invoices</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <CreditRazorpayButton 
              packageId={pkg.id} 
              amount={Number(pkg.price)} 
              packageName={pkg.name}
              className="w-full"
              onSuccess={onSuccess}
              variant={pkg.credits >= 1500 ? "default" : "outline"}
            >
              <Zap className="mr-2 size-4" />
              Buy Now
            </CreditRazorpayButton>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
