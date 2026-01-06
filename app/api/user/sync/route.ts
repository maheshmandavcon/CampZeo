import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    console.log("=== /api/user/sync called ===");
    console.log("CLERK_SECRET_KEY loaded:", !!process.env.CLERK_SECRET_KEY);
    console.log("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY loaded:", !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

    try {
        const user = await currentUser();
        console.log("User object from currentUser:", user ? { id: user.id, email: user.emailAddresses?.[0]?.emailAddress } : null);

        if (!user) {
            console.log("User not found, returning 401");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: {
                organisation: {
                    include: {
                        subscriptions: {
                            where: { status: 'ACTIVE' },
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            include: {
                                plan: true
                            }
                        }
                    }
                }
            }
        });

        if (!dbUser) {
            console.log("Creating new user in database");
            const newUser = await prisma.user.create({
                data: {
                    clerkId: user.id,
                    email: user.emailAddresses[0].emailAddress,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: "ORGANISATION_USER",
                },
            });
            console.log("User created successfully");
            return NextResponse.json({
                message: "User synced",
                user: {
                    id: newUser.id,
                    role: newUser.role,
                    organisationId: null,
                    hasOrganisation: false,
                    isAdmin: false,
                    needsOnboarding: true
                }
            });
        }

        // Determine user status
        const isAdmin = dbUser.role === "ADMIN_USER";
        const hasOrganisation = !!dbUser.organisationId && !!dbUser.organisation;
        const activeSubscription = dbUser.organisation?.subscriptions?.[0];
        const hasActiveSubscription = !!activeSubscription;
        const isTrialOrPremium = hasActiveSubscription && (
            activeSubscription.isTrial ||
            (activeSubscription.plan && Number(activeSubscription.plan.price) > 0)
        );

        // SCENARIO 3 VALIDATION: Check if organization was created from enquiry
        // Validate: user has organisationId, organisation object exists, but NO active subscription
        const needsOnboarding = hasOrganisation &&
            !hasActiveSubscription &&
            dbUser.organisationId !== null &&
            dbUser.organisation !== null;

        console.log("User sync status:", {
            isAdmin,
            hasOrganisation,
            organisationId: dbUser.organisationId,
            organisationExists: !!dbUser.organisation,
            hasActiveSubscription,
            subscriptionCount: dbUser.organisation?.subscriptions?.length || 0,
            isTrialOrPremium,
            needsOnboarding
        });

        return NextResponse.json({
            message: "User already exists",
            user: {
                id: dbUser.id,
                role: dbUser.role,
                organisationId: dbUser.organisationId,
                organisation: dbUser.organisation ? {
                    id: dbUser.organisation.id,
                    name: dbUser.organisation.name,
                    email: dbUser.organisation.email,
                    phone: dbUser.organisation.phone,
                    address: dbUser.organisation.address,
                    city: dbUser.organisation.city,
                    state: dbUser.organisation.state,
                    country: dbUser.organisation.country,
                    postalCode: dbUser.organisation.postalCode,
                    taxNumber: dbUser.organisation.taxNumber,
                } : null,
                hasOrganisation,
                isAdmin,
                hasActiveSubscription,
                isTrialOrPremium,
                needsOnboarding,
                subscription: activeSubscription ? {
                    id: activeSubscription.id,
                    isTrial: activeSubscription.isTrial,
                    planName: activeSubscription.plan?.name,
                    status: activeSubscription.status
                } : null
            }
        });
    } catch (error) {
        console.error("=== ERROR in /api/user/sync ===");
        console.error("Error syncing user:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            { error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
