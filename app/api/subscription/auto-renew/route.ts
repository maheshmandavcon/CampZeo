import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logInfo, logError, logWarning } from "@/lib/audit-logger";

export async function POST(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            await logWarning("Unauthorized access attempt to toggle auto-renew", { action: "toggle-auto-renew" });
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

        const { autoRenew } = await req.json();

        if (typeof autoRenew !== "boolean") {
            return NextResponse.json(
                { error: "autoRenew must be a boolean value" },
                { status: 400 }
            );
        }

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

        // Update auto-renew setting
        const updatedSubscription = await prisma.subscription.update({
            where: { id: subscription.id },
            data: { autoRenew },
        });

        // Create audit log
        await logInfo(`Auto-renew ${autoRenew ? "enabled" : "disabled"}`, {
            action: "toggle_auto_renew",
            resourceType: "subscription",
            subscriptionId: subscription.id,
            organisationId: dbUser.organisationId,
            autoRenew,
            userId: user.id,
        });

        return NextResponse.json({
            success: true,
            message: `Auto-renew ${autoRenew ? "enabled" : "disabled"} successfully`,
            subscription: {
                id: updatedSubscription.id,
                autoRenew: updatedSubscription.autoRenew,
            },
        });
    } catch (error: any) {
        console.error("Error toggling auto-renew:", error);
        await logError("Failed to update auto-renew setting", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: "Failed to update auto-renew setting" },
            { status: 500 }
        );
    }
}
