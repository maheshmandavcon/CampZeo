import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logError, logWarning } from "@/lib/audit-logger";

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler() {

        const user = await currentUser();

        if (!user) {
            await logWarning("Unauthorized access attempt to fetch usage metrics", { action: "fetch-usage-metrics" });
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

        const organisationId = dbUser.organisationId;

        // Get active subscription to fetch plan limits
        const subscription = await prisma.subscription.findFirst({
            where: {
                organisationId,
                status: { in: ["ACTIVE", "CANCELING"] },
            },
            include: {
                plan: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Parse usage limits from plan
        // Parse usage limits from plan
        let usageLimits;
        const defaultLimits = {
            campaigns: 100,
            contacts: 100,
            users: 10,
            platforms: 8,
            postsPerMonth: 100,
        };

        try {
            usageLimits = subscription?.plan?.usageLimits
                ? JSON.parse(subscription.plan.usageLimits as string)
                : defaultLimits;

            // Validate it's an object
            if (typeof usageLimits !== 'object' || usageLimits === null) {
                usageLimits = defaultLimits;
            }
        } catch (e) {
            usageLimits = defaultLimits;
        }

        // Count current usage
        const [campaignsCount, contactsCount, usersCount, platformsCount, postsThisMonthCount] =
            await Promise.all([
                // Count active campaigns (not deleted)
                prisma.campaign.count({
                    where: {
                        organisationId,
                        isDeleted: false,
                    },
                }),
                // Count contacts
                prisma.contact.count({
                    where: {
                        organisationId,
                    },
                }),
                // Count users
                prisma.user.count({
                    where: {
                        organisationId,
                    },
                }),
                // Count organisation platforms
                prisma.organisationPlatform.count({
                    where: {
                        organisationId,
                    },
                }),
                // Count campaign posts created this month
                prisma.campaignPost.count({
                    where: {
                        campaign: {
                            organisationId,
                        },
                        createdAt: {
                            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                        },
                    },
                }),
            ]);

        // Calculate usage metrics
        const calculateMetric = (current: number, limit: number) => {
            const percentage = limit > 0 ? (current / limit) * 100 : 0;
            return {
                current,
                limit,
                percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
                isNearLimit: percentage >= 80,
            };
        };

        const usage = {
            campaigns: calculateMetric(campaignsCount, usageLimits.campaigns),
            contacts: calculateMetric(contactsCount, usageLimits.contacts),
            users: calculateMetric(usersCount, usageLimits.users),
            platforms: calculateMetric(platformsCount, usageLimits.platforms),
            postsThisMonth: calculateMetric(postsThisMonthCount, usageLimits.postsPerMonth),
        };

        return NextResponse.json({ usage });
    
}

export const GET = withErrorHandling(getHandler, "GET /api/subscription/usage");
