import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch active plans (public endpoint - no auth required for pricing pages)
export async function GET(request: NextRequest) {
    try {
        // Fetch only active, non-deleted plans
        const plans = await prisma.plan.findMany({
            where: {
                isActive: true,
                isDeleted: false
            },
            orderBy: {
                price: 'asc'
            },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                billingCycle: true,
                features: true,
                usageLimits: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // Format the response - parse features from JSON string to array
        const formattedPlans = plans.map(plan => {
            let parsedFeatures: string[] = [];
            let parsedUsageLimits: any = null;

            // Parse features
            if (plan.features) {
                try {
                    parsedFeatures = typeof plan.features === 'string'
                        ? JSON.parse(plan.features)
                        : plan.features;
                } catch (e) {
                    console.error(`Failed to parse features for plan ${plan.id}:`, e);
                    parsedFeatures = [];
                }
            }

            // Parse usage limits
            if (plan.usageLimits) {
                try {
                    parsedUsageLimits = typeof plan.usageLimits === 'string'
                        ? JSON.parse(plan.usageLimits)
                        : plan.usageLimits;
                } catch (e) {
                    console.error(`Failed to parse usageLimits for plan ${plan.id}:`, e);
                }
            }

            return {
                id: plan.id,
                name: plan.name,
                description: plan.description,
                price: Number(plan.price),
                billingCycle: plan.billingCycle || 'month',
                features: parsedFeatures,
                usageLimits: parsedUsageLimits,
                createdAt: plan.createdAt,
                updatedAt: plan.updatedAt
            };
        });

        return NextResponse.json({
            success: true,
            plans: formattedPlans
        });

    } catch (error: any) {
        console.error("Error fetching plans:", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || 'Failed to fetch plans',
                plans: []
            },
            { status: 500 }
        );
    }
}
