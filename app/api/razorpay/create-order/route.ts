import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { getPlanById } from "@/lib/plans";
import { logError, logWarning, logInfo } from "@/lib/audit-logger";

import { withErrorHandling } from '@/lib/api-handler';
async function postHandler(req: Request) {

    const user = await currentUser();
    const { plan, organizationName, isSignup, metadata } = await req.json();

    if (!user && !isSignup) {
        await logWarning("Unauthorized access attempt to create razorpay order", { action: "create-razorpay-order" });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const planDetails = await prisma.plan.findUnique({
        where: { name: plan },
    });
    console.log(planDetails);

    if (!planDetails) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Free trial doesn't require payment
    if (plan === "FREE_TRIAL" || planDetails.price.isZero()) {
        return NextResponse.json({ error: "This plan doesn't require payment" }, { status: 400 });
    }

    // Get or create user from database
    let dbUser = null;
    if (user) {
        dbUser = await prisma.user.upsert({
            where: { clerkId: user.id },
            update: {},
            create: {
                clerkId: user.id,
                email: user.emailAddresses[0]?.emailAddress || `no-email-${user.id}@campzeo.com`,
                firstName: user.firstName,
                lastName: user.lastName,
                role: 'ORGANISATION_USER',
            },
            include: { organisation: true },
        });

        if (!dbUser) {
            return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });
        }
    }

    // Handle signup flow (no organisation yet) vs upgrade flow (organisation exists)
    let receipt: string;
    let orderNotes: any;

    if (isSignup || !dbUser?.organisationId) {
        // Signup flow - organisation doesn't exist yet
        if (!organizationName) {
            return NextResponse.json({ error: "Organization name is required for signup" }, { status: 400 });
        }
        const identifier = dbUser ? dbUser.id : `guest_${Date.now()}`;
        receipt = `signup_${identifier}_${Date.now()}`;
        orderNotes = {
            userId: dbUser ? dbUser.id : 'guest',
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
        Number(planDetails.price),
        "INR", // Default to INR since it's not in Plan table
        receipt,
        orderNotes
    );

    // Store order info temporarily for signup flow
    // We'll create the payment record after organisation is created
    if (isSignup || !dbUser?.organisationId) {
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
                currency: "INR", // Default to INR
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

}

export const POST = withErrorHandling(postHandler, "POST /api/razorpay/create-order");
