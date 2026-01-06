import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { sendPaymentReceipt } from "@/lib/email";
import { logError, logWarning, logInfo } from "@/lib/audit-logger";

export async function POST(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            await logWarning("Unauthorized access attempt to verify payment", { action: "verify-payment" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, isSignup, metadata } = await req.json();

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
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

        // Get user from database
        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: { organisation: true },
        });

        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Handle signup flow (no organisation yet)
        if (isSignup || !dbUser.organisationId) {
            // For signup, just verify the signature and return success
            // The payment record will be created when the organisation is created
            return NextResponse.json({
                success: true,
                message: "Payment verified successfully",
                isSignup: true,
                payment: {
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                    plan,
                },
            });
        }

        // Handle upgrade flow (organisation exists)
        // Update payment record
        const payment = await prisma.payment.findFirst({
            where: { razorpayOrderId: razorpay_order_id },
        });

        if (!payment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                status: "COMPLETED",
            },
        });

        // Calculate billing dates
        const now = new Date();
        const nextBillingDate = new Date(now);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        // Update organisation subscription
        // Get Plan details
        const planDetails = await prisma.plan.findFirst({
            where: { name: plan }
        });

        if (planDetails) {
            // Update latest subscription or create new one
            const subscription = await prisma.subscription.findFirst({
                where: { organisationId: dbUser.organisationId },
                orderBy: { createdAt: 'desc' }
            });

            let updatedSubscription;
            if (subscription) {
                const activationTiming = metadata?.activationTiming || "IMMEDIATE";

                if (activationTiming === "DEFERRED" && subscription.endDate) {
                    // Deferred: Start from the end of current subscription
                    const newStartDate = new Date(subscription.endDate);
                    const newEndDate = new Date(newStartDate);
                    newEndDate.setMonth(newEndDate.getMonth() + 1);

                    updatedSubscription = await prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            planId: planDetails.id,
                            status: "ACTIVE",


                            endDate: newEndDate,
                            renewalDate: newEndDate,
                            isTrial: false,
                            trialEndDate: null
                        }
                    });
                } else {
                    // Immediate: Reset dates to today
                    updatedSubscription = await prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            planId: planDetails.id,
                            status: "ACTIVE",
                            startDate: now,
                            endDate: nextBillingDate,
                            renewalDate: nextBillingDate,
                            isTrial: false,
                            trialEndDate: null
                        }
                    });
                }
            } else {
                // Create new subscription if none exists
                updatedSubscription = await prisma.subscription.create({
                    data: {
                        organisationId: dbUser.organisationId!,
                        planId: planDetails.id,
                        status: "ACTIVE",
                        startDate: now,
                        endDate: nextBillingDate,
                        renewalDate: nextBillingDate,
                        autoRenew: true
                    }
                });
            }

            // Create Invoice
            await prisma.invoice.create({
                data: {
                    subscriptionId: updatedSubscription.id,
                    invoiceDate: new Date(),
                    dueDate: new Date(),
                    paidDate: new Date(),
                    status: "PAID",
                    amount: payment.amount,
                    taxAmount: 0,
                    discountAmount: 0,
                    balance: 0,
                    currency: payment.currency,
                    invoiceNumber: `INV-${Date.now()}`,
                    paymentMethod: "RAZORPAY",
                    description: `Subscription for ${plan}`,
                }
            });
        }

        // Send Payment Receipt
        if (dbUser.organisation) {
            await sendPaymentReceipt({
                email: user.emailAddresses[0]?.emailAddress || "",
                amount: Number(payment.amount),
                currency: payment.currency,
                planName: plan,
                receiptId: razorpay_payment_id,
                date: new Date(),
                organisationName: dbUser.organisation.name
            });
        }



        await logInfo("Payment verified successfully", { paymentId: payment.id, amount: payment.amount, status: payment.status });
        return NextResponse.json({
            success: true,
            message: "Payment verified successfully",
            isSignup: false,
            payment: {
                id: payment.id,
                amount: payment.amount,
                status: payment.status,
            },
        });
    } catch (error: any) {
        console.error("Error verifying payment:", error);
        await logError("Failed to verify payment", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: "Failed to verify payment" },
            { status: 500 }
        );
    }
}
