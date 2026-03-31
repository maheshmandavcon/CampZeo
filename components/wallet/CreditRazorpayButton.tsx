"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { RazorpayOptions, RazorpayResponse } from "@/types/razorpay";

interface CreditRazorpayButtonProps {
  packageId: number;
  amount: number;
  packageName: string;
  onSuccess?: (data?: any) => void;
  onError?: (error: string) => void;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
  metadata?: Record<string, any>;
}

export function CreditRazorpayButton({
  packageId,
  amount,
  packageName,
  onSuccess,
  onError,
  children,
  variant = "default",
  className,
  metadata,
}: CreditRazorpayButtonProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    if (!isScriptLoaded) {
      toast.error("Payment system is loading, please try again");
      return;
    }

    if (!user) {
      toast.error("Please sign in to continue");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create Credit Order
      const orderResponse = await fetch("/api/payments/create-credit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, metadata }),
      });

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        throw new Error(error.error || "Failed to create order");
      }

      const orderData = await orderResponse.json();

      // 2. Initialize Razorpay
      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "CampZeo",
        description: `Purchase ${packageName}`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            // 3. Verify Credit Payment
            const verifyResponse = await fetch("/api/payments/verify-credit-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                packageId
              }),
            });

            if (!verifyResponse.ok) {
              const errData = await verifyResponse.json();
              throw new Error(errData.error || "Payment verification failed");
            }

            const verifyData = await verifyResponse.json();
            toast.success("Credits added successfully!");
            
            // Trigger wallet update in header
            window.dispatchEvent(new CustomEvent('wallet-updated'));
            
            if (onSuccess) {
                onSuccess(verifyData);
            } else {
                router.push(`/payment/success?payment_id=${response.razorpay_payment_id}&type=credits`);
            }
          } catch (error: any) {
            console.error("Verification error:", error);
            toast.error(error.message || "Payment verification failed");
            onError?.(error.message);
            router.push(`/payment/failure?error=${encodeURIComponent(error.message)}`);
          } finally {
            setIsLoading(false);
          }
        },
        prefill: {
          name: user?.fullName || "",
          email: user?.primaryEmailAddress?.emailAddress || "",
        },
        theme: {
          color: "#3b82f6",
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            toast.info("Payment cancelled");
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', ((response: any) => {
        toast.error(response.error.description);
        router.push(`/payment/failure?error=${encodeURIComponent(response.error.description)}`);
      }) as any);
      razorpay.open();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
      onError?.(error.message);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={isLoading || !isScriptLoaded}
      variant={variant}
      className={className}
    >
      {isLoading ? "Processing..." : children}
    </Button>
  );
}
