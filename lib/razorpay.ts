const Razorpay = require("razorpay");
import crypto from "crypto";

// Initialize Razorpay instance
export const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/**
 * Create a Razorpay order
 */
export async function createRazorpayOrder(
    amount: number,
    currency: string = "INR",
    receipt: string,
    notes?: Record<string, string>
) {
    try {
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency,
            receipt,
            notes,
        };

        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw error;
    }
}

/**
 * Verify Razorpay payment signature
 */
export function verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    try {
        const text = `${orderId}|${paymentId}`;
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(text)
            .digest("hex");

        return generatedSignature === signature;
    } catch (error) {
        console.error("Error verifying signature:", error);
        return false;
    }
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string
): boolean {
    try {
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(body)
            .digest("hex");

        return expectedSignature === signature;
    } catch (error) {
        console.error("Error verifying webhook signature:", error);
        return false;
    }
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPaymentDetails(paymentId: string) {
    try {
        const payment = await razorpay.payments.fetch(paymentId);
        return payment;
    } catch (error) {
        console.error("Error fetching payment details:", error);
        throw error;
    }
}
