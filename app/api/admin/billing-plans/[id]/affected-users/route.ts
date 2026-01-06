import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logError, logWarning } from '@/lib/audit-logger';

// GET: Get affected users/organizations for a plan
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            await logWarning("Unauthorized access attempt to fetch affected users", { action: "fetch-affected-users" });
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to fetch affected users", { userId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const planId = parseInt(id);

        if (isNaN(planId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid plan ID' }, { status: 400 });
        }

        // Get plan with active subscriptions
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

        const organisations = plan.subscriptions.map(sub => sub.organisation);

        return NextResponse.json({
            isSuccess: true,
            data: {
                planId: plan.id,
                planName: plan.name,
                activeSubscriptions: plan.subscriptions.length,
                organisations: organisations
            }
        });

    } catch (error: any) {
        console.error("Error fetching affected users:", error);
        await logError("Failed to fetch affected users", { userId: "Unknown" }, error);
        return NextResponse.json({ isSuccess: false, message: error.message }, { status: 500 });
    }
}
