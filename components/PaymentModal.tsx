import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useState } from 'react';
import { CreditCard, Lock } from 'lucide-react';

interface PaymentModalProps {
  plan: {
    name: string;
    price: number;
    period: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ plan, onClose, onSuccess }: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // =============================================
    // TODO: REPLACE WITH REAL RAZORPAY INTEGRATION
    // =============================================
    // PRODUCTION IMPLEMENTATION:
    //
    // STEP 1: Create order on backend
    // const orderResponse = await fetch('/api/payments/create-order', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ 
    //     planId: plan.name.toUpperCase(),
    //     amount: plan.price 
    //   })
    // })
    // const { orderId, amount, currency, key } = await orderResponse.json()
    //
    // STEP 2: Initialize Razorpay Checkout
    // const options = {
    //   key: key, // Razorpay Key ID from backend
    //   amount: amount, // Amount in paise
    //   currency: currency,
    //   name: 'SaaSify',
    //   description: `${plan.name} Plan Subscription`,
    //   order_id: orderId,
    //   handler: async function(response) {
    //     // STEP 3: Verify payment on backend
    //     const verifyResponse = await fetch('/api/payments/verify', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({
    //         razorpay_order_id: response.razorpay_order_id,
    //         razorpay_payment_id: response.razorpay_payment_id,
    //         razorpay_signature: response.razorpay_signature,
    //         planId: plan.name.toUpperCase()
    //       })
    //     })
    //     const result = await verifyResponse.json()
    //     
    //     if (result.success) {
    //       onSuccess()
    //     } else {
    //       alert('Payment verification failed')
    //     }
    //   },
    //   prefill: {
    //     name: 'User Name',
    //     email: 'user@example.com',
    //     contact: '9999999999'
    //   },
    //   theme: {
    //     color: '#dc2626' // Red color matching our theme
    //   }
    // }
    //
    // STEP 4: Open Razorpay Checkout
    // const rzp = new window.Razorpay(options)
    // rzp.open()
    //
    // STEP 5: Add Razorpay script to your HTML
    // Add this to your app/layout.tsx or index.html:
    // <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    // =============================================

    // Mock Razorpay integration
    // In production, you would:
    // 1. Create an order on your backend using Razorpay API
    // 2. Initialize Razorpay checkout with the order ID
    // 3. Handle payment success/failure callbacks
    // 4. Update user subscription in database (Prisma + Neon)

    setTimeout(() => {
      // Simulate payment processing
      const options = {
        key: 'YOUR_RAZORPAY_KEY_ID', // Replace with actual Razorpay key
        amount: plan.price * 100, // Razorpay expects amount in paise
        currency: 'INR',
        name: 'SaaSify',
        description: `${plan.name} Plan Subscription`,
        image: '/logo.png',
        handler: function (response: any) {
          // This would be called on successful payment
          console.log('Payment successful:', response.razorpay_payment_id);
          onSuccess();
        },
        prefill: {
          name: 'User Name',
          email: 'user@example.com',
          contact: '9999999999'
        },
        theme: {
          color: '#3b82f6'
        }
      };

      // In production: const rzp = new Razorpay(options);
      // rzp.open();

      // For demo purposes, simulate success
      setIsProcessing(false);
      onSuccess();
    }, 2000);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Purchase</DialogTitle>
          <DialogDescription>
            You're subscribing to the {plan.name} plan for ₹{plan.price}/{plan.period}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handlePayment} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="John Doe" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="john@example.com" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" placeholder="+91 9999999999" required />
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Plan</span>
              <span>{plan.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Amount</span>
              <span>₹{plan.price}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">₹{plan.price}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            <span>Secure payment powered by Razorpay</span>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing} className="flex-1">
              <CreditCard className="size-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Pay Now'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            By proceeding, you agree to our Terms of Service and Privacy Policy
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}