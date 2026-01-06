import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { logError, logWarning } from "@/lib/audit-logger";

export async function GET() {
    try {
        const user = await currentUser();

        if (!user) {
            await logWarning("Unauthorized access attempt to fetch current subscription", { action: "fetch-current-subscription" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: { organisation: true },
        });

        // Handle Admin Impersonation
        let organisation = dbUser?.organisation;

        if (dbUser?.role === 'ADMIN_USER') {
            const impersonatedId = await getImpersonatedOrganisationId();
            if (impersonatedId) {
                const impersonatedOrg = await prisma.organisation.findUnique({
                    where: { id: impersonatedId }
                });
                if (impersonatedOrg) {
                    organisation = impersonatedOrg;
                }
            }
        }

        if (!organisation) {
            return NextResponse.json(
                { error: "Organisation not found" },
                { status: 404 }
            );
        }

        // Get the active subscription (latest with status ACTIVE or CANCELING)
        const subscription = await prisma.subscription.findFirst({
            where: {
                organisationId: organisation.id,
                status: { in: ["ACTIVE", "CANCELING"] },
            },
            include: {
                plan: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Calculate trial information
        let trialInfo = null;
        if (organisation.isTrial && organisation.trialStartDate && organisation.trialEndDate) {
            const now = new Date();
            const trialEnd = new Date(organisation.trialEndDate);
            const trialStart = new Date(organisation.trialStartDate);
            const daysRemaining = Math.ceil(
                (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            trialInfo = {
                isActive: organisation.isTrial && now < trialEnd,
                daysRemaining: Math.max(0, daysRemaining),
                startDate: trialStart.toISOString(),
                endDate: trialEnd.toISOString(),
                isExpired: now >= trialEnd,
            };
        }

        // Parse plan features and limits
        let planData = null;
        if (subscription?.plan) {
            let features;
            try {
                features = subscription.plan.features ? JSON.parse(subscription.plan.features) : [];
            } catch (e) {
                // If parsing fails, treat as a single string item or plain string depending on contract. 
                // Assuming legacy frontend might expect array, but safetst is to return what we have if it's not parseable.
                // Or better: wrap in array if it's a non-empty string.
                features = subscription.plan.features ? [subscription.plan.features] : [];
            }

            let usageLimits;
            try {
                usageLimits = subscription.plan.usageLimits ? JSON.parse(subscription.plan.usageLimits) : null;
            } catch (e) {
                usageLimits = subscription.plan.usageLimits; // Return raw string if not JSON
            }

            planData = {
                id: subscription.plan.id,
                name: subscription.plan.name,
                price: Number(subscription.plan.price),
                billingCycle: subscription.plan.billingCycle,
                features,
                usageLimits,
            };
        }

        // Build subscription response
        const subscriptionData = subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                startDate: subscription.startDate?.toISOString() || null,
                endDate: subscription.endDate?.toISOString() || null,
                renewalDate: subscription.renewalDate?.toISOString() || null,
                autoRenew: subscription.autoRenew,
                plan: planData,
            }
            : null;

        return NextResponse.json({
            subscription: subscriptionData,
            trial: trialInfo,
            organisation: {
                id: organisation.id,
                name: organisation.name,
                isApproved: organisation.isApproved,
            },
        });
    } catch (error: any) {
        console.error("Error fetching subscription:", error);
        await logError("Failed to fetch subscription", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: "Failed to fetch subscription" },
            { status: 500 }
        );
    }
}
