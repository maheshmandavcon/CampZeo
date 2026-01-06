import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { logError, logWarning, logInfo } from "@/lib/audit-logger";

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const signature = req.headers.get("x-razorpay-signature");

        if (!signature) {
            return NextResponse.json({ error: "No signature found" }, { status: 400 });
        }

        // Verify webhook signature
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
        const isValid = verifyWebhookSignature(body, signature, webhookSecret);

        if (!isValid) {
            console.error("Invalid webhook signature");
            await logWarning("Invalid razorpay webhook signature", { action: "webhook-verification" });
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }

        const event = JSON.parse(body);
        console.log("Razorpay webhook event:", event.event);

        // Handle different webhook events
        switch (event.event) {
            case "payment.authorized":
            case "payment.captured":
                await handlePaymentSuccess(event.payload.payment.entity);
                break;

            case "payment.failed":
                await handlePaymentFailed(event.payload.payment.entity);
                break;

            case "order.paid":
                console.log("Order paid:", event.payload.order.entity);
                break;

            default:
                console.log("Unhandled event:", event.event);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Error processing webhook:", error);
        await logError("Razorpay webhook processing failed", { action: "webhook-processing" }, error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}

async function handlePaymentSuccess(payment: any) {
    try {
        console.log("Processing successful payment:", payment.id);

        // Update payment record
        await prisma.payment.updateMany({
            where: { razorpayOrderId: payment.order_id },
            data: {
                razorpayPaymentId: payment.id,
                status: "COMPLETED",
            },
        });

        console.log("Payment record updated successfully");
    } catch (error) {
        console.error("Error handling payment success:", error);
    }
}

async function handlePaymentFailed(payment: any) {
    try {
        console.log("Processing failed payment:", payment.id);

        // Update payment record
        await prisma.payment.updateMany({
            where: { razorpayOrderId: payment.order_id },
            data: {
                razorpayPaymentId: payment.id,
                status: "FAILED",
            },
        });

        console.log("Payment failure recorded");
    } catch (error) {
        console.error("Error handling payment failure:", error);
    }
}
