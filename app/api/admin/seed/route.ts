import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export async function POST() {
    try {

        const user = await currentUser();

        // Only allow admins to seed
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id }
        });

        if (dbUser?.role !== "ADMIN_USER") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        console.log('🌱 Seeding database...');

        // Seed Plans
        const plans = [
            {
                name: 'FREE_TRIAL',
                description: '14-day free trial with basic features',
                price: 0,
                billingCycle: 'MONTHLY',
                features: JSON.stringify([
                    'Up to 5 team members',
                    '10GB storage',
                    'Basic analytics',
                    'Email support',
                    '14-day trial period'
                ]),
                isActive: true,
                autoRenew: false
            },
            {
                name: 'PROFESSIONAL',
                description: 'Professional plan for growing teams',
                price: 2999,
                billingCycle: 'MONTHLY',
                features: JSON.stringify([
                    'Up to 50 team members',
                    '100GB storage',
                    'Advanced analytics',
                    'Priority email support',
                    'API access',
                    'Custom integrations'
                ]),
                isActive: true,
                autoRenew: true
            },
            {
                name: 'ENTERPRISE',
                description: 'Enterprise plan with unlimited features',
                price: 9999,
                billingCycle: 'MONTHLY',
                features: JSON.stringify([
                    'Unlimited team members',
                    '1TB storage',
                    'Advanced analytics & reporting',
                    '24/7 phone & email support',
                    'Dedicated account manager',
                    'Custom integrations',
                    'SLA guarantee',
                    'Advanced security features'
                ]),
                isActive: true,
                autoRenew: true
            }
        ];

        const createdPlans = [];

        // Try to create each plan, skip if it already exists
        for (const plan of plans) {
            try {
                const existing = await prisma.plan.findFirst({
                    where: { name: plan.name }
                });

                if (existing) {
                    console.log(`⏭️  Plan already exists: ${plan.name}`);
                    createdPlans.push(existing);
                } else {
                    const created = await prisma.plan.create({
                        data: plan
                    });
                    createdPlans.push(created);
                    console.log(`✅ Created plan: ${plan.name}`);
                }
            } catch (error) {
                console.error(`Error creating plan ${plan.name}:`, error);
            }
        }

        // Seed Job Settings
        const jobSettings = [
            {
                jobId: 'campaign-post-scheduler',
                cronExpression: '*/5 * * * *',
                isEnabled: true
            }
        ];

        for (const setting of jobSettings) {
            try {
                const existing = await prisma.jobSetting.findFirst({
                    where: { jobId: setting.jobId }
                });

                if (existing) {
                    console.log(`⏭️  Job setting already exists: ${setting.jobId}. Updating isEnabled: true`);
                    await prisma.jobSetting.update({
                        where: { id: existing.id },
                        data: { isEnabled: true }
                    });
                } else {
                    await prisma.jobSetting.create({
                        data: setting
                    });
                    console.log(`✅ Created job setting: ${setting.jobId}`);
                }
            } catch (error) {
                console.error(`Error creating job setting ${setting.jobId}:`, error);
            }
        }

        console.log('✨ Seeding completed!');

        return NextResponse.json({
            success: true,
            message: "Database seeded successfully",
            plans: createdPlans
        });

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        return NextResponse.json(
            {
                error: "Failed to seed database",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
