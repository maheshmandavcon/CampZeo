import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { getPlanById } from "@/lib/plans";
import { logError, logWarning, logInfo } from "@/lib/audit-logger";

export async function POST(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            await logWarning("Unauthorized access attempt to create razorpay order", { action: "create-razorpay-order" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { plan, organizationName, isSignup, metadata } = await req.json();

        if (!plan) {
            return NextResponse.json({ error: "Plan is required" }, { status: 400 });
        }

        // Get plan details
        const planDetails = getPlanById(plan);

        if (!planDetails) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
        }

        // Free trial doesn't require payment
        if (plan === "FREE_TRIAL") {
            return NextResponse.json({ error: "Free trial doesn't require payment" }, { status: 400 });
        }

        // Get user from database
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: { organisation: true },
        });

        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Handle signup flow (no organisation yet) vs upgrade flow (organisation exists)
        let receipt: string;
        let orderNotes: any;

        if (isSignup || !dbUser.organisationId) {
            // Signup flow - organisation doesn't exist yet
            if (!organizationName) {
                return NextResponse.json({ error: "Organization name is required for signup" }, { status: 400 });
            }
            receipt = `signup_${dbUser.id}_${Date.now()}`;
            orderNotes = {
                userId: dbUser.id,
                plan: plan,
                organizationName: organizationName,
                isSignup: "true",
                ...metadata
            };
        } else {
            // Upgrade flow - organisation exists
            receipt = `order_${dbUser.organisationId}_${Date.now()}`;
            orderNotes = {
                organisationId: dbUser.organisationId,
                plan: plan,
                userId: dbUser.id,
                isSignup: "false",
                ...metadata
            };
        }

        // Create Razorpay order
        const order = await createRazorpayOrder(
            planDetails.price,
            planDetails.currency,
            receipt,
            orderNotes
        );

        // Store order info temporarily for signup flow
        // We'll create the payment record after organisation is created
        if (isSignup || !dbUser.organisationId) {
            // For signup, we'll store the order details in the order notes
            // The payment record will be created when the organisation is created
            return NextResponse.json({
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                isSignup: true,
            });
        } else {
            // For upgrade, create payment record immediately
            await prisma.payment.create({
                data: {
                    organisationId: dbUser.organisationId,
                    razorpayOrderId: order.id,
                    amount: planDetails.price,
                    currency: planDetails.currency,
                    status: "PENDING",
                    plan: plan,
                    receipt: receipt,
                    notes: orderNotes,
                    razorpayPaymentId: order.id,
                    razorpaySignature: order.id
                }
            });

            return NextResponse.json({
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                isSignup: false,
            });
        }
    } catch (error: any) {
        console.error("Error creating Razorpay order:", error);
        await logError("Failed to create razorpay order", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: "Failed to create order" },
            { status: 500 }
        );
    }
}
