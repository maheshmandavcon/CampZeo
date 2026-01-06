"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { RazorpayOptions, RazorpayResponse } from "@/types/razorpay";

interface RazorpayButtonProps {
  plan: string;
  amount: number;
  onSuccess?: (paymentData?: any) => void;
  onError?: (error: string) => void;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
  organizationName?: string;
  isSignup?: boolean;
  metadata?: Record<string, any>;
  id?: string;
}

export function RazorpayButton({
  plan,
  amount,
  onSuccess,
  onError,
  children,
  variant = "default",
  className,
  organizationName,
  isSignup = false,
  metadata,
  id,
}: RazorpayButtonProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Razorpay script
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

  const router = useRouter(); // Add this hook at the top

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
      // Create order
      const orderResponse = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, organizationName, isSignup, metadata }),
      });

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        throw new Error(error.error || "Failed to create order");
      }

      const orderData = await orderResponse.json();

      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "CampZeo",
        description: `${plan} Plan Subscription`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            const verifyResponse = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan,
                isSignup,
                metadata,
              }),
            });

            if (!verifyResponse.ok) {
              throw new Error("Payment verification failed");
            }

            const verifyData = await verifyResponse.json();
            toast.success("Payment successful!");

            onSuccess?.(verifyData);

            if (!isSignup) {
              router.push(`/payment/success?payment_id=${response.razorpay_payment_id}`);
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed");
            onError?.(error instanceof Error ? error.message : "Verification failed");
            router.push(`/payment/failure?error=${encodeURIComponent("Verification failed")}`);
          } finally {
            setIsLoading(false);
          }
        },
        prefill: {
          name: user.fullName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
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
        console.error("Payment Failed", response.error);
        toast.error(response.error.description);
        router.push(`/payment/failure?error=${encodeURIComponent(response.error.description)}`);
      }) as any);
      razorpay.open();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Payment failed");
      onError?.(error instanceof Error ? error.message : "Payment failed");
      setIsLoading(false);
    }
  };

  return (
    <Button
      id={id}
      onClick={handlePayment}
      disabled={isLoading || !isScriptLoaded}
      variant={variant}
      className={className}
    >
      {isLoading ? "Processing..." : children}
    </Button>
  );
}
