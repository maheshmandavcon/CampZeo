import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { sendPaymentReceipt } from "@/lib/email";
import { logInfo, logError } from "@/lib/audit-logger";
import { withErrorHandling } from '@/lib/api-handler';

async function postHandler(req: Request) {
    const user = await currentUser();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packageId } = await req.json();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packageId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify signature
    const isValid = verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    );

    if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        include: { organisation: true }
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    // Process payment completion
    const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId: razorpay_order_id }
    });

    if (!payment) {
        return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    const pkg = await prisma.creditPackage.findUnique({
        where: { id: packageId }
    });

    if (!pkg) {
        return NextResponse.json({ error: "Credit package not found" }, { status: 404 });
    }

    // Execute wallet update and transaction tracking in a single DB transaction
    await prisma.$transaction(async (tx) => {
        // 1. Update Payment Status
        await tx.payment.update({
            where: { id: payment.id },
            data: {
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                status: "COMPLETED"
            }
        });

        // 2. Get/Create Wallet
        const wallet = await tx.wallet.upsert({
            where: { organisationId: dbUser.organisationId! },
            update: {
                smsCreditsAvailable: pkg.type === "SMS" ? { increment: pkg.credits } : undefined,
                whatsappCreditsAvailable: pkg.type === "WHATSAPP" ? { increment: pkg.credits } : undefined,
            },
            create: {
                organisationId: dbUser.organisationId!,
                smsCreditsAvailable: pkg.type === "SMS" ? pkg.credits : 0,
                whatsappCreditsAvailable: pkg.type === "WHATSAPP" ? pkg.credits : 0,
            }
        });

        // 3. Log Wallet Transaction
        await tx.walletTransaction.create({
            data: {
                walletId: wallet.id,
                amount: pkg.credits,
                type: "CREDIT",
                service: pkg.type,
                description: `Purchased ${pkg.name} (${pkg.credits} credits)`
            }
        });

        // 4. Create Invoice (subscriptionId is now optional)
        await tx.invoice.create({
            data: {
                invoiceDate: new Date(),
                dueDate: new Date(),
                paidDate: new Date(),
                status: "PAID",
                amount: pkg.price,
                taxAmount: 0,
                discountAmount: 0,
                balance: 0,
                currency: "INR",
                invoiceNumber: `INV-CRED-${Date.now()}`,
                paymentMethod: "RAZORPAY",
                description: `Credit Purchase: ${pkg.name}`
            }
        });
    });

    // Send Payment Receipt
    try {
        await sendPaymentReceipt({
            email: user.emailAddresses[0]?.emailAddress || dbUser.email || "",
            amount: Number(pkg.price),
            currency: "INR",
            planName: pkg.name,
            receiptId: razorpay_payment_id,
            date: new Date(),
            organisationName: dbUser.organisation?.name || "Company"
        });
    } catch (emailError) {
        console.error("Failed to send receipt email:", emailError);
        // Non-blocking
    }

    await logInfo("Credit purchase successful", { organisationId: dbUser.organisationId, amount: pkg.credits });

    return NextResponse.json({ isSuccess: true, message: "Credits added successfully" });
}

export const POST = withErrorHandling(postHandler, "POST /api/payments/verify-credit-payment");
