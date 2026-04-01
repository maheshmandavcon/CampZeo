import { prisma } from "./prisma";

export interface UsageLimits {
    campaigns: number;
    contacts: number;
    postsPerMonth: number;
}

export const DEFAULT_LIMITS: UsageLimits = {
    campaigns: 100,
    contacts: 10000,
    postsPerMonth: 9999,
};

export async function getSubscriptionLimits(organisationId: number) {
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

    let limits = DEFAULT_LIMITS;

    if (subscription?.plan?.usageLimits) {
        try {
            const parsedLimits = JSON.parse(subscription.plan.usageLimits as string);
            limits = {
                ...DEFAULT_LIMITS,
                ...parsedLimits,
            };
        } catch (e) {
            console.error("Error parsing usage limits:", e);
        }
    }

    return {
        limits,
        subscription,
    };
}

export async function getUsageCounts(organisationId: number) {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [campaignsCount, contactsCount, postsThisMonthCount, postsLastMonthCount] = await Promise.all([
        prisma.campaign.count({
            where: { organisationId, isDeleted: false },
        }),
        prisma.contact.count({
            where: { organisationId },
        }),
        prisma.campaignPost.count({
            where: {
                campaign: { organisationId },
                createdAt: { gte: firstDayThisMonth },
            },
        }),
        prisma.campaignPost.count({
            where: {
                campaign: { organisationId },
                createdAt: {
                    gte: firstDayLastMonth,
                    lte: lastDayLastMonth,
                },
            },
        }),
    ]);

    return {
        campaigns: campaignsCount,
        contacts: contactsCount,
        postsThisMonth: postsThisMonthCount,
        postsLastMonth: postsLastMonthCount,
    };
}

export async function checkLimit(organisationId: number, type: "campaigns" | "contacts") {
    const { limits } = await getSubscriptionLimits(organisationId);
    const counts = await getUsageCounts(organisationId);

    const current = counts[type];
    const limit = limits[type];

    if (current >= limit) {
        return {
            allowed: false,
            current,
            limit,
            message: `You have reached your limit of ${limit} ${type}. Please upgrade your plan to add more.`,
        };
    }

    return { allowed: true, current, limit };
}
