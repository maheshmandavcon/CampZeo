import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET: Get plan details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            await logWarning("Unauthorized access attempt to fetch plan details", { action: "fetch-plan-details" });
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to fetch plan details", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const planId = parseInt(id);

        if (isNaN(planId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid plan ID' }, { status: 400 });
        }

        const plan = await prisma.plan.findUnique({
            where: { id: planId },
            include: {
                _count: {
                    select: { subscriptions: true }
                },
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    select: {
                        id: true,
                        organisation: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!plan) {
            return NextResponse.json({ isSuccess: false, message: 'Plan not found' }, { status: 404 });
        }

        let features = [];
        try {
            features = plan.features ? JSON.parse(plan.features) : [];
        } catch (e) {
            features = [];
        }

        return NextResponse.json({
            isSuccess: true,
            data: {
                ...plan,
                features,
                totalSubscriptions: plan._count.subscriptions,
                activeSubscriptions: plan.subscriptions.length,
                activeOrganisations: plan.subscriptions.map((sub: { organisation: any; }) => sub.organisation)
            }
        });

    } catch (error: any) {
        console.error("Error fetching plan details:", error);
        await logError("Failed to fetch plan details", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}

// PUT: Update plan
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            await logWarning("Unauthorized access attempt to update plan", { action: "update-plan" });
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to update plan", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const planId = parseInt(id);

        if (isNaN(planId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid plan ID' }, { status: 400 });
        }

        const body = await request.json();
        const { name, description, price, billingCycle, features, usageLimits, isActive, autoRenew } = body;

        // Check if plan exists
        const existingPlan = await prisma.plan.findUnique({
            where: { id: planId },
            include: {
                subscriptions: {
                    where: { status: 'ACTIVE' }
                }
            }
        });

        if (!existingPlan) {
            return NextResponse.json({ isSuccess: false, message: 'Plan not found' }, { status: 404 });
        }

        const hasActiveSubscriptions = existingPlan.subscriptions.length > 0;

        // Validation
        if (name && name !== existingPlan.name) {
            const duplicateName = await prisma.plan.findUnique({ where: { name: name.trim() } });
            if (duplicateName) {
                return NextResponse.json({ isSuccess: false, message: 'Plan name already exists' }, { status: 400 });
            }
        }

        if (price !== undefined && price < 0) {
            return NextResponse.json({ isSuccess: false, message: 'Price must be >= 0' }, { status: 400 });
        }

        if (features && (!Array.isArray(features) || features.length === 0)) {
            return NextResponse.json({ isSuccess: false, message: 'At least one feature is required' }, { status: 400 });
        }

        // Restrict critical changes if plan has active subscriptions
        if (hasActiveSubscriptions) {
            if (price !== undefined && price !== parseFloat(existingPlan.price.toString())) {
                return NextResponse.json({
                    isSuccess: false,
                    message: 'Cannot change price for plan with active subscriptions. Please create a new plan instead.'
                }, { status: 400 });
            }

            if (billingCycle && billingCycle !== existingPlan.billingCycle) {
                return NextResponse.json({
                    isSuccess: false,
                    message: 'Cannot change billing cycle for plan with active subscriptions. Please create a new plan instead.'
                }, { status: 400 });
            }
        }

        // Update plan
        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (price !== undefined && !hasActiveSubscriptions) updateData.price = parseFloat(price);
        if (billingCycle !== undefined && !hasActiveSubscriptions) updateData.billingCycle = billingCycle;
        if (features !== undefined) updateData.features = JSON.stringify(features);
        if (usageLimits !== undefined) updateData.usageLimits = JSON.stringify(usageLimits);
        if (isActive !== undefined) updateData.isActive = isActive;
        if (autoRenew !== undefined) updateData.autoRenew = autoRenew;

        const updatedPlan = await prisma.plan.update({
            where: { id: planId },
            data: updateData
        });

        await logInfo("Billing plan updated", { planId, updatedBy: userId, hasActiveSubscriptions });

        return NextResponse.json({
            isSuccess: true,
            data: updatedPlan,
            message: 'Plan updated successfully'
        });

    } catch (error: any) {
        console.error("Error updating plan:", error);
        await logError("Failed to update plan", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}

// DELETE: Delete plan (soft delete)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            await logWarning("Unauthorized access attempt to delete plan", { action: "delete-plan" });
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to delete plan", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const planId = parseInt(id);

        if (isNaN(planId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid plan ID' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const { migrateToPlanId } = body;

        // Check if plan exists
        const plan = await prisma.plan.findUnique({
            where: { id: planId },
            include: {
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    include: {
                        organisation: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });

        if (!plan) {
            return NextResponse.json({ isSuccess: false, message: 'Plan not found' }, { status: 404 });
        }

        // Check if plan is already soft deleted
        if ((plan as any).isDeleted) {
            return NextResponse.json({ isSuccess: false, message: 'Plan is already deleted' }, { status: 400 });
        }

        const activeSubscriptions = plan.subscriptions;

        // If plan has active subscriptions, require migration target
        if (activeSubscriptions.length > 0) {
            if (!migrateToPlanId) {
                return NextResponse.json({
                    isSuccess: false,
                    message: 'Plan has active subscriptions. Please provide migrateToPlanId to migrate users to another plan.'
                }, { status: 400 });
            }

            const targetPlan = await prisma.plan.findUnique({ where: { id: parseInt(migrateToPlanId) } });
            if (!targetPlan) {
                return NextResponse.json({ isSuccess: false, message: 'Migration target plan not found' }, { status: 404 });
            }

            // Validate target plan is active and not deleted
            if (!targetPlan.isActive || (targetPlan as any).isDeleted) {
                return NextResponse.json({ isSuccess: false, message: 'Cannot migrate to inactive or deleted plan' }, { status: 400 });
            }

            // Migrate subscriptions
            await prisma.subscription.updateMany({
                where: {
                    planId: planId,
                    status: 'ACTIVE'
                },
                data: {
                    planId: parseInt(migrateToPlanId)
                }
            });

            await logInfo("Subscriptions migrated during plan deletion", {
                fromPlanId: planId,
                toPlanId: migrateToPlanId,
                count: activeSubscriptions.length,
                deletedBy: userId
            });
        }

        // Soft delete the plan
        await prisma.plan.update({
            where: { id: planId },
            data: { isDeleted: true } as any
        });

        await logInfo("Billing plan soft deleted", {
            planId,
            planName: plan.name,
            migratedSubscriptions: activeSubscriptions.length,
            deletedBy: userId
        });

        return NextResponse.json({
            isSuccess: true,
            message: `Plan deleted successfully${activeSubscriptions.length > 0 ? `. ${activeSubscriptions.length} subscriptions migrated.` : ''}`,
            data: {
                deletedPlanId: planId,
                migratedSubscriptions: activeSubscriptions.length,
                affectedOrganisations: activeSubscriptions.map((sub: { organisation: any; }) => sub.organisation)
            }
        });

    } catch (error: any) {
        console.error("Error deleting plan:", error);
        await logError("Failed to delete plan", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
