import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendPaymentReceipt } from "@/lib/email";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function POST(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            await logWarning("Unauthorized access attempt to create organisation", { action: "create-organisation" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();

        console.log("=== CREATE ORGANISATION REQUEST ===");
        console.log("Request body:", JSON.stringify(body, null, 2));
        console.log("===================================");

        const {
            organizationName,
            plan,
            paymentData,
            phone,
            email,
            address,
            city,
            state,
            country,
            postalCode,
            taxNumber
        } = body;

        if (!organizationName || !plan) {
            return NextResponse.json(
                { error: "Organization name and plan are required" },
                { status: 400 }
            );
        }

        // Check if user already has an organisation
        const existingUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: {
                organisation: {
                    include: {
                        subscriptions: true
                    }
                }
            },
        });

        let organisation: any;
        let subscription: any;
        let isUpdating = false;

        // If user already has an organisation (e.g., created by admin), update it
        if (existingUser?.organisation) {
            isUpdating = true;
            console.log("⚠️ Organisation already exists, updating instead of creating");

            // Update existing organisation with onboarding data
            organisation = await prisma.organisation.update({
                where: { id: existingUser.organisation.id },
                data: {
                    phone,
                    address,
                    city,
                    state,
                    country,
                    postalCode,
                    taxNumber,
                    isTrial: plan === 'FREE_TRIAL',
                    trialStartDate: plan === 'FREE_TRIAL' ? new Date() : null,
                    trialEndDate: plan === 'FREE_TRIAL' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
                }
            });
        } else {
            // Create new organisation
            organisation = await prisma.organisation.create({
                data: {
                    name: organizationName,
                    ownerName: `${user.firstName} ${user.lastName}`.trim(),
                    email: email || user.emailAddresses[0]?.emailAddress,
                    phone,
                    address,
                    city,
                    state,
                    country,
                    postalCode,
                    taxNumber,
                    isTrial: plan === 'FREE_TRIAL',
                    trialStartDate: plan === 'FREE_TRIAL' ? new Date() : null,
                    trialEndDate: plan === 'FREE_TRIAL' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
                    isApproved: true,
                }
            });

            // Auto-assign all platforms for paid plans
            if (plan !== 'FREE_TRIAL') {
                const allPlatforms = ['EMAIL', 'SMS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'];

                await prisma.organisationPlatform.createMany({
                    data: allPlatforms.map((platform) => ({
                        organisationId: organisation.id,
                        platform: platform as any
                    }))
                });

                console.log(`✅ Auto-assigned all platforms to paid organisation: ${organisation.name}`);
            } else {
                console.log(`⏳ Free trial organisation created. Platforms will be assigned by admin: ${organisation.name}`);
            }
        }

        // Fetch Plan from DB
        const dbPlan = await prisma.plan.findFirst({
            where: { name: plan }
        });

        let selectedPlan = dbPlan;
        if (!selectedPlan) {
            if (plan === 'FREE_TRIAL') {
                selectedPlan = await prisma.plan.create({
                    data: {
                        name: 'FREE_TRIAL',
                        price: 0,
                        billingCycle: 'MONTHLY',
                        features: 'Basic features',
                        isActive: true
                    }
                });
            } else {
                return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
            }
        }

        // Check if subscription already exists
        const existingSubscription = await prisma.subscription.findFirst({
            where: {
                organisationId: organisation.id,
                status: 'ACTIVE'
            }
        });

        if (!existingSubscription) {
            // Create Subscription only if one doesn't exist
            subscription = await prisma.subscription.create({
                data: {
                    organisationId: organisation.id,
                    planId: selectedPlan.id,
                    startDate: new Date(),
                    status: 'ACTIVE',
                    autoRenew: true,
                    isTrial: plan === 'FREE_TRIAL',
                    trialStartDate: plan === 'FREE_TRIAL' ? new Date() : null,
                    trialEndDate: plan === 'FREE_TRIAL' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
                }
            });
        } else {
            subscription = existingSubscription;
            console.log("✅ Subscription already exists, using existing one");
        }

        const updatedUser = await prisma.user.upsert({
            where: { clerkId: user.id },
            update: {
                organisationId: organisation.id,
            },
            create: {
                clerkId: user.id,
                email: user.emailAddresses[0]?.emailAddress || "",
                firstName: user.firstName,
                lastName: user.lastName,
                organisationId: organisation.id,
                role: 'ORGANISATION_USER',
            },
        });
        // Handle Payment if not free trial
        if (plan !== "FREE_TRIAL" && paymentData) {
            // Create Payment
            await prisma.payment.create({
                data: {
                    organisationId: organisation.id,
                    razorpayOrderId: paymentData.razorpay_order_id,
                    razorpayPaymentId: paymentData.razorpay_payment_id,
                    razorpaySignature: paymentData.razorpay_signature,
                    amount: selectedPlan.price,
                    currency: "INR",
                    status: "success",
                    plan: selectedPlan.name,
                    receipt: `receipt_${Date.now()}`,
                }
            });

            // Create Invoice
            await prisma.invoice.create({
                data: {
                    subscriptionId: subscription.id,
                    invoiceDate: new Date(),
                    dueDate: new Date(),
                    paidDate: new Date(),
                    status: "PAID",
                    amount: selectedPlan.price,
                    taxAmount: 0,
                    discountAmount: 0,
                    balance: 0,
                    currency: "INR",
                    invoiceNumber: `INV-${Date.now()}`,
                    paymentMethod: "RAZORPAY",
                    description: `Subscription for ${selectedPlan.name}`,
                }
            });

            // Send Payment Receipt
            await sendPaymentReceipt({
                email: email || user.emailAddresses[0]?.emailAddress || "",
                amount: Number(selectedPlan.price),
                currency: "INR",
                planName: selectedPlan.name,
                receiptId: paymentData.razorpay_payment_id,
                date: new Date(),
                organisationName: organizationName
            });
        }

        // Log event
        await prisma.logEvents.create({
            data: {
                message: isUpdating
                    ? `Organisation updated: ${organisation.name}`
                    : `Organisation created: ${organisation.name}`,
                level: 'Info',
                timeStamp: new Date(),
                properties: JSON.stringify({
                    userId: updatedUser.id,
                    organisationId: organisation.id,
                    plan: selectedPlan.name,
                    isUpdating
                })
            }
        });

        return NextResponse.json({
            success: true,
            organisation,
            user: updatedUser,
            isUpdating,
            invoice: plan !== "FREE_TRIAL" && paymentData ? await prisma.invoice.findFirst({ where: { description: `Subscription for ${selectedPlan.name}`, subscription: { organisationId: organisation.id } }, orderBy: { createdAt: 'desc' } }) : null,
            // We can also just use the invoice created above if we assign it to a variable, but it's inside an if block.
            // Let's rely on finding it or refactoring. 
            // Better: let invoice variable be outside.
        });
    } catch (error) {
        console.error("=== ERROR CREATING ORGANISATION ===");
        console.error("Error details:", error);
        console.error("Error message:", error instanceof Error ? error.message : "Unknown error");
        console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
        console.error("===================================");

        return NextResponse.json(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// GET endpoint to fetch current user's organisation
export async function GET() {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: { organisation: true },
        });

        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            user: dbUser,
            organisation: dbUser.organisation,
        });
    } catch (error) {
        console.error("Error fetching organisation:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
