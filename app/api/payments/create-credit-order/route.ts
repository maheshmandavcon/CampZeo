import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from '@/lib/api-handler';
import { logWarning, logInfo } from "@/lib/audit-logger";

async function postHandler(req: Request) {
    const user = await currentUser();
    const { packageId, metadata } = await req.json();

    if (!user) {
        await logWarning("Unauthorized attempt to create credit order", { action: "create-credit-order" });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!packageId) {
        return NextResponse.json({ error: "Package ID is required" }, { status: 400 });
    }

    // Get package details
    const pkg = await prisma.creditPackage.findUnique({
        where: { id: packageId }
    });

    if (!pkg || !pkg.isActive) {
        return NextResponse.json({ error: "Invalid or inactive credit package" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        include: { organisation: true }
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    // Check if organisation has approved Twilio access
    if (dbUser.organisation?.twilioAccessStatus !== "APPROVED") {
        return NextResponse.json({ error: "Twilio access must be approved before buying credits" }, { status: 403 });
    }

    const receipt = `credits_${dbUser.organisationId}_${Date.now()}`;
    const orderNotes = {
        organisationId: dbUser.organisationId,
        packageId: packageId.toString(),
        userId: dbUser.id,
        type: "CREDITS",
        ...metadata
    };

    // Create Razorpay order
    const order = await createRazorpayOrder(
        Number(pkg.price),
        "INR",
        receipt,
        orderNotes
    );

    // Initial payment record
    await prisma.payment.create({
        data: {
            organisationId: dbUser.organisationId,
            razorpayOrderId: order.id,
            amount: pkg.price,
            currency: "INR",
            status: "PENDING",
            plan: `CREDITS:${pkg.name}`,
            receipt: receipt,
            notes: orderNotes,
            // Temporary IDs until verified
            razorpayPaymentId: order.id,
            razorpaySignature: order.id
        }
    });

    return NextResponse.json({
        isSuccess: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        package: pkg
    });
}

export const POST = withErrorHandling(postHandler, "POST /api/payments/create-credit-order");
