import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logWarning } from "@/lib/audit-logger";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { withErrorHandling } from '@/lib/api-handler';
import { getSubscriptionLimits, getUsageCounts } from '@/lib/subscription-limits';

async function getHandler() {
    const user = await currentUser();

    if (!user) {
        await logWarning("Unauthorized access attempt to fetch usage metrics", { action: "fetch-usage-metrics" });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let organisationId = dbUser.organisationId;
    if (dbUser.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            organisationId = impersonatedId;
        }
    }

    if (!organisationId) {
        return NextResponse.json(
            { error: "No organisation associated" },
            { status: 404 }
        );
    }

    const { limits } = await getSubscriptionLimits(organisationId);
    const counts = await getUsageCounts(organisationId);

    const orgUsers = await prisma.user.findMany({
        where: { organisationId },
        select: {
            linkedInAccessToken: true,
            facebookAccessToken: true,
            facebookPageAccessToken: true,
            instagramAccessToken: true,
            instagramUserId: true,
            youtubeAccessToken: true,
            pinterestAccessToken: true,
        },
    });

    const connectedPlatforms: string[] = [];
    if (orgUsers.some(u => !!u.linkedInAccessToken)) connectedPlatforms.push('LinkedIn');
    if (orgUsers.some(u => !!(u.facebookAccessToken || u.facebookPageAccessToken))) connectedPlatforms.push('Facebook');
    if (orgUsers.some(u => !!(u.instagramAccessToken && u.instagramUserId))) connectedPlatforms.push('Instagram');
    if (orgUsers.some(u => !!u.youtubeAccessToken)) connectedPlatforms.push('YouTube');
    if (orgUsers.some(u => !!u.pinterestAccessToken)) connectedPlatforms.push('Pinterest');

    // Check for SMS and WhatsApp in OrganisationPlatform table
    const activeOrgPlatforms = await prisma.organisationPlatform.findMany({
        where: {
            organisationId,
            isActive: true,
            platform: { in: ['SMS', 'WHATSAPP'] }
        }
    });

    if (activeOrgPlatforms.some(p => p.platform === 'SMS')) connectedPlatforms.push('SMS');
    if (activeOrgPlatforms.some(p => p.platform === 'WHATSAPP')) connectedPlatforms.push('WhatsApp');

    const calculateMetric = (current: number, limit: number) => {
        const percentage = limit > 0 ? (current / limit) * 100 : 0;
        return {
            current,
            limit,
            percentage: Math.round(percentage * 10) / 10,
            isNearLimit: percentage >= 80,
        };
    };

    const usage = {
        campaigns: calculateMetric(counts.campaigns, limits.campaigns),
        contacts: calculateMetric(counts.contacts, limits.contacts),
        platforms: {
            ...calculateMetric(connectedPlatforms.length, 5),
            connectedNames: connectedPlatforms,
        },
        postsThisMonth: {
            current: counts.postsThisMonth,
            lastMonth: counts.postsLastMonth,
            growth: counts.postsLastMonth > 0 
                ? Math.round(((counts.postsThisMonth - counts.postsLastMonth) / counts.postsLastMonth) * 100)
                : (counts.postsThisMonth > 0 ? 100 : 0),
        }
    };

    return NextResponse.json({ usage });
}

export const GET = withErrorHandling(getHandler, "GET /api/subscription/usage");
