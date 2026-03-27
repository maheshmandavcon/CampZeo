import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendPaymentReceipt, sendOrganisationInvite, sendWelcomeEmail, sendNewDeviceSignInEmail } from "@/lib/email";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';
import { createClerkUser } from "@/lib/clerk-admin";
import { verifyRazorpaySignature } from "@/lib/razorpay";

import { withErrorHandling } from '@/lib/api-handler';
async function postHandler(req: Request) {

        const user = await currentUser();
        const body = await req.json();

        console.log("=== CREATE ORGANISATION REQUEST ===");
        console.log("Request body:", JSON.stringify({ ...body, password: body.password ? "***" : undefined }, null, 2));
        console.log("===================================");

        const {
            organizationName,
            plan,
            paymentData,
            phone,
            email,
            password,
            ownerName,
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

        if (!user && (!email || !password)) {
            await logWarning("Unauthorized checkout attempt to create organisation without credentials", { action: "create-organisation-guest" });
            return NextResponse.json({ error: "Email and password are required to create an account." }, { status: 401 });
        }

        let rOrderId: string | undefined;
        let rPaymentId: string | undefined;
        let rSignature: string | undefined;
        let finalClerkId = user?.id;
        let finalUserEmail = email || user?.emailAddresses[0]?.emailAddress;
        let finalFirstName = user?.firstName || ownerName?.split(' ')[0] || '';
        let finalLastName = user?.lastName || ownerName?.split(' ').slice(1).join(' ') || '';

        if (finalUserEmail) {
            const trimmedEmail = finalUserEmail.trim();
            
            const existingOrg = await prisma.organisation.findFirst({
                where: {
                    email: { equals: trimmedEmail, mode: 'insensitive' },
                    isDeleted: false,
                },
            });

            if (existingOrg) {
                return NextResponse.json(
                    { error: "An organisation with this email already exists. Only one active organisation can be associated with an email at a time." },
                    { status: 409 }
                );
            }

            const existingUserWithOrg = await prisma.user.findFirst({
                where: {
                    email: { equals: trimmedEmail, mode: 'insensitive' },
                    organisation: {
                        isDeleted: false,
                        isApproved: true,
                    },
                },
            });

            if (existingUserWithOrg) {
                return NextResponse.json(
                    { error: "An account with this email is already associated with an active organisation." },
                    { status: 409 }
                );
            }
        }

        if (plan !== 'FREE_TRIAL') {
            if (!paymentData) {
                return NextResponse.json({ error: "Payment data is required for paid plans" }, { status: 400 });
            }
            const pData = paymentData.payment || paymentData;
            rOrderId = pData.razorpay_order_id || pData.orderId || pData.razorpayOrderId;
            rPaymentId = pData.razorpay_payment_id || pData.paymentId || pData.razorpayPaymentId;
            rSignature = pData.razorpay_signature || pData.signature || pData.razorpaySignature;

            if (!rOrderId || !rPaymentId || !rSignature) {
                return NextResponse.json({ error: "Incomplete payment data" }, { status: 400 });
            }

            const isValid = verifyRazorpaySignature(rOrderId, rPaymentId, rSignature);
            if (!isValid) {
                return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
            }
            console.log(" Razorpay Payment Signature strictly verified for organisation creation.");
        }

        if (!user) {
            console.log('Creating new Clerk user for guest checkout...');
            try {
                const baseUsername = ownerName
                    ? ownerName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
                    : finalUserEmail!.split('@')[0].replace(/[^a-z0-9]/g, '');
                
                const username = `${baseUsername}${Date.now().toString().slice(-4)}`;

                const clerkUser = await createClerkUser({
                    email: finalUserEmail!.trim(),
                    password: password.trim(),
                    firstName: finalFirstName,
                    lastName: finalLastName,
                    username: username,
                });
                
                finalClerkId = clerkUser.id;
            } catch (err: any) {
                console.error("Failed to create Clerk user during checkout:", err);
                return NextResponse.json({ error: err.message || "Failed to create user account" }, { status: 400 });
            }
        }

        // Check if user already has an organisation
        const existingUser = await prisma.user.findUnique({
            where: { clerkId: finalClerkId! },
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
        let invoice: any = null;
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
            console.log("Creating new organisation:", organizationName);
            // Create new organisation
            organisation = await prisma.organisation.create({
                data: {
                    name: organizationName,
                    ownerName: `${finalFirstName} ${finalLastName}`.trim() || ownerName || 'Owner',
                    email: finalUserEmail!,
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

        console.log(`Fetching plan: ${plan}`);
        // Fetch Plan from DB
        const dbPlan = await prisma.plan.findFirst({
            where: { name: plan }
        });

        let selectedPlan = dbPlan;
        if (!selectedPlan) {
            if (plan === 'FREE_TRIAL') {
                console.log("Creating default FREE_TRIAL plan");
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
                console.error(`Invalid plan selected: ${plan}`);
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
            console.log("Creating new subscription");
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

        console.log("Upserting user data...");
        const updatedUser = await prisma.user.upsert({
            where: { clerkId: finalClerkId! },
            update: {
                organisationId: organisation.id,
            },
            create: {
                clerkId: finalClerkId!,
                email: finalUserEmail || `no-email-${finalClerkId}@campzeo.com`,
                firstName: finalFirstName,
                lastName: finalLastName,
                organisationId: organisation.id,
                role: 'ORGANISATION_USER',
            },
        });

        // Handle Payment if not free trial
        if (plan !== "FREE_TRIAL" && paymentData) {
            console.log("Processing payment and invoice...");

            if (!rOrderId) {
                console.error("Critical: razorpay_order_id is missing in paymentData", paymentData);
                throw new Error("Razorpay Order ID is missing. Please contact support.");
            }

            // Create Payment
            await prisma.payment.create({
                data: {
                    organisationId: organisation.id,
                    razorpayOrderId: rOrderId,
                    razorpayPaymentId: rPaymentId || "PENDING",
                    razorpaySignature: rSignature || "PENDING",
                    amount: selectedPlan.price,
                    currency: "INR",
                    status: "success",
                    plan: selectedPlan.name,
                    receipt: `receipt_${Date.now()}`,
                }
            });

            // Create Invoice
            invoice = await prisma.invoice.create({
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

            console.log("Sending payment receipt email...");
            // Send Payment Receipt
            try {
                await sendPaymentReceipt({
                    email: finalUserEmail || "",
                    amount: Number(selectedPlan.price),
                    currency: "INR",
                    planName: selectedPlan.name,
                    receiptId: rPaymentId || "N/A",
                    date: new Date(),
                    organisationName: organizationName
                });
                console.log("Payment receipt email sent successfully");
            } catch (emailErr) {
                console.error("Failed to send payment receipt email:", emailErr);
                // Don't crash the whole process if email fails
            }
        }

        // Log event
        try {
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
            console.log("Event logged successfully");
        } catch (logErr) {
            console.error("Failed to log event:", logErr);
        }

        if (!user && finalUserEmail && password) {
            console.log("Sending welcome/invite email to new user...");
            try {
                // await sendOrganisationInvite({
                //     email: finalUserEmail,
                //     password: password,
                //     organisationName: organizationName,
                //     ownerName: finalFirstName || ownerName || "Owner",
                // });
                // console.log("Invite email sent successfully.");

                await sendWelcomeEmail({
                    email: finalUserEmail,
                    userName: finalFirstName || ownerName || "Owner",
                    organisationName: organizationName,
                });
                console.log("Welcome message sent successfully.");

                await sendNewDeviceSignInEmail({
                    email: finalUserEmail,
                    userName: finalFirstName || ownerName || "Owner",
                });
                console.log("New device signed in email sent successfully.");

            } catch (emailErr) {
                console.error("Failed to send welcome/invite/device emails:", emailErr);
            }
        }

        console.log("Registration process completed successfully");
        return NextResponse.json({
            success: true,
            organisation,
            user: updatedUser,
            isUpdating,
            invoice,
        });

    
}

export const POST = withErrorHandling(postHandler, "POST /api/organisations");

// GET endpoint to fetch current user's organisation
async function getHandler() {

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
    
}

export const GET = withErrorHandling(getHandler, "GET /api/organisations");
