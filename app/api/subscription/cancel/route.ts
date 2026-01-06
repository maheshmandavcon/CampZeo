import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logInfo, logError, logWarning } from "@/lib/audit-logger";

export async function POST(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            await logWarning("Unauthorized access attempt to cancel subscription", { action: "cancel-subscription" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: { organisation: true },
        });

        if (!dbUser || !dbUser.organisationId) {
            return NextResponse.json(
                { error: "User not found or no organisation" },
                { status: 404 }
            );
        }

        const { immediate, reason } = await req.json();

        // Find active subscription
        const subscription = await prisma.subscription.findFirst({
            where: {
                organisationId: dbUser.organisationId,
                status: { in: ["ACTIVE", "CANCELING"] },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        if (!subscription) {
            return NextResponse.json(
                { error: "No active subscription found" },
                { status: 404 }
            );
        }

        // Update subscription based on cancellation type
        const updatedSubscription = await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: immediate ? "CANCELED" : "CANCELING",
                endDate: immediate ? new Date() : subscription.endDate,
                autoRenew: false,
            },
        });

        // Create audit log
        await logInfo("Subscription cancelled", {
            action: "cancel",
            resourceType: "subscription",
            subscriptionId: subscription.id,
            organisationId: dbUser.organisationId,
            immediate,
            reason,
            userId: user.id,
        });

        return NextResponse.json({
            success: true,
            message: immediate
                ? "Subscription cancelled immediately"
                : "Subscription will be cancelled at the end of the billing period",
            subscription: {
                id: updatedSubscription.id,
                status: updatedSubscription.status,
                endDate: updatedSubscription.endDate?.toISOString() || null,
                autoRenew: updatedSubscription.autoRenew,
            },
        });
    } catch (error: any) {
        console.error("Error cancelling subscription:", error);
        await logError("Failed to cancel subscription", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: "Failed to cancel subscription" },
            { status: 500 }
        );
    }
}
