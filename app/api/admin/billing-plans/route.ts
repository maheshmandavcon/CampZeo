import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET: List all plans
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            await logWarning("Unauthorized access attempt to fetch billing plans", { action: "fetch-plans" });
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to fetch billing plans", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search') || '';
        const isActive = searchParams.get('isActive');
        const sortBy = searchParams.get('sortBy') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        // Build where clause
        const where: any = { isDeleted: false };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (isActive !== null && isActive !== undefined && isActive !== '') {
            where.isActive = isActive === 'true';
        }

        // Get plans with subscription counts
        const plans = await prisma.plan.findMany({
            where,
            include: {
                _count: {
                    select: { subscriptions: true }
                },
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    select: { id: true }
                }
            },
            orderBy: sortBy === 'subscriptionCount'
                ? undefined
                : { [sortBy]: sortOrder }
        });

        // Format response with subscription counts
        const formattedPlans = plans.map(plan => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            billingCycle: plan.billingCycle,
            features: plan.features,
            usageLimits: plan.usageLimits,
            isActive: plan.isActive,
            autoRenew: plan.autoRenew,
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
            totalSubscriptions: plan._count.subscriptions,
            activeSubscriptions: plan.subscriptions.length
        }));

        // Sort by subscription count if requested
        if (sortBy === 'subscriptionCount') {
            formattedPlans.sort((a, b) => {
                const diff = a.activeSubscriptions - b.activeSubscriptions;
                return sortOrder === 'asc' ? diff : -diff;
            });
        }

        return NextResponse.json({
            isSuccess: true,
            data: formattedPlans
        });

    } catch (error: any) {
        console.error("Error fetching billing plans:", error);
        await logError("Failed to fetch billing plans", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}

// POST: Create new plan
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            await logWarning("Unauthorized access attempt to create billing plan", { action: "create-plan" });
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to create billing plan", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, price, billingCycle, features, usageLimits, isActive, autoRenew } = body;

        // Validation
        if (!name || !name.trim()) {
            return NextResponse.json({ isSuccess: false, message: 'Plan name is required' }, { status: 400 });
        }

        if (price === undefined || price === null || price < 0) {
            return NextResponse.json({ isSuccess: false, message: 'Valid price is required (must be >= 0)' }, { status: 400 });
        }

        if (!billingCycle || !['MONTHLY', 'YEARLY'].includes(billingCycle)) {
            return NextResponse.json({ isSuccess: false, message: 'Valid billing cycle is required (MONTHLY or YEARLY)' }, { status: 400 });
        }

        if (!features || !Array.isArray(features) || features.length === 0) {
            return NextResponse.json({ isSuccess: false, message: 'At least one feature is required' }, { status: 400 });
        }

        // Check for unique name
        const existingPlan = await prisma.plan.findUnique({ where: { name: name.trim() } });
        if (existingPlan) {
            return NextResponse.json({ isSuccess: false, message: 'Plan name already exists' }, { status: 400 });
        }

        // Create plan
        const newPlan = await prisma.plan.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                price: parseFloat(price),
                billingCycle,
                features: JSON.stringify(features),
                usageLimits: usageLimits ? JSON.stringify(usageLimits) : null,
                isActive: isActive !== undefined ? isActive : true,
                autoRenew: autoRenew !== undefined ? autoRenew : true
            }
        });

        await logInfo("Billing plan created", { planId: newPlan.id, name: newPlan.name, createdBy: userId });

        return NextResponse.json({
            isSuccess: true,
            data: newPlan,
            message: 'Plan created successfully'
        });

    } catch (error: any) {
        console.error("Error creating billing plan:", error);
        await logError("Failed to create billing plan", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
