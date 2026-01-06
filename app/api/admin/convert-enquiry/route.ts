import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createClerkUser } from "@/lib/clerk-admin";
import { sendOrganisationInvite } from "@/lib/email";
import { logError, logWarning } from "@/lib/audit-logger";

/**
 * POST /api/admin/convert-enquiry
 * Convert an enquiry to organisation with Clerk user creation
 */
export async function POST(req: Request) {
    try {
        const user = await currentUser();

        // Verify admin user
        if (!user) {
            await logWarning("Unauthorized access attempt to convert-enquiry", { action: "convert-enquiry" });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { role: true }
        });

        if (!dbUser || dbUser.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to convert-enquiry", {
                userId: user.id,
                role: dbUser?.role,
                action: "convert-enquiry"
            });
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const { enquiryId } = body;

        if (!enquiryId) {
            return NextResponse.json(
                { error: "enquiryId is required" },
                { status: 400 }
            );
        }

        // Fetch the enquiry
        const enquiry = await prisma.enquiry.findUnique({
            where: { id: enquiryId }
        });

        if (!enquiry) {
            return NextResponse.json(
                { error: "Enquiry not found" },
                { status: 404 }
            );
        }

        if (enquiry.isConverted) {
            return NextResponse.json(
                { error: "Enquiry already converted" },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!enquiry.email || !enquiry.name) {
            return NextResponse.json(
                { error: "Enquiry missing required fields (email or name)" },
                { status: 400 }
            );
        }

        // Step 2: Create or link Clerk user
        let clerkUser;
        try {
            const client = await clerkClient();

            // Check if user already exists in Clerk
            const existingClerkUsers = await client.users.getUserList({
                emailAddress: [enquiry.email.trim()],
            });

            if (existingClerkUsers.data && existingClerkUsers.data.length > 0) {
                clerkUser = existingClerkUsers.data[0];
                console.log('Using existing Clerk user:', clerkUser.id);
            } else {
                // User doesn't exist, need to create one. Verify password exists.
                if (!enquiry.password || enquiry.password.trim() === '') {
                    return NextResponse.json(
                        {
                            isSuccess: false,
                            error: "Password not found in enquiry",
                            details: "A password is required to create a new authentication account for this lead."
                        },
                        { status: 400 }
                    );
                }

                // Generate username from name field
                const username = enquiry.name
                    .toLowerCase()
                    .replace(/\s+/g, '') // Remove all spaces
                    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric

                if (!username || username.length === 0) {
                    throw new Error('Invalid name - cannot generate username');
                }

                // Split name into firstName and lastName
                const nameParts = enquiry.name.trim().split(/\s+/);
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

                console.log('Creating new Clerk user for lead...');
                clerkUser = await createClerkUser({
                    email: enquiry.email.trim(),
                    password: enquiry.password.trim(),
                    firstName: firstName,
                    lastName: lastName,
                    username: username,
                });
                console.log('Clerk user created successfully:', clerkUser.id);
            }
        } catch (clerkError: any) {
            console.error('Detailed Clerk error:', clerkError);
            await logError("Failed to handle Clerk user during conversion", {
                enquiryId,
                email: enquiry.email,
                action: "convert-enquiry"
            }, clerkError);
            throw clerkError;
        }

        // Step 3: Create organisation with 14-day free trial
        const trialStartDate = new Date();
        const trialEndDate = new Date(trialStartDate.getTime() + 14 * 24 * 60 * 60 * 1000);

        const organisation = await prisma.organisation.create({
            data: {
                name: enquiry.organisationName || enquiry.name,
                ownerName: enquiry.name,
                phone: enquiry.mobile || undefined,
                email: enquiry.email,
                taxNumber: enquiry.taxNumber || undefined,
                address: enquiry.address || undefined,
                postalCode: enquiry.postalCode || undefined,
                city: enquiry.city || undefined,
                state: enquiry.state || undefined,
                country: enquiry.country || undefined,
                isApproved: true,
                isTrial: true,
                trialStartDate: trialStartDate,
                trialEndDate: trialEndDate,
            }
        });

        // Step 4: Handle Plan and Subscription
        // Find or create FREE_TRIAL plan
        let dbPlan = await prisma.plan.findFirst({
            where: { name: 'FREE_TRIAL' }
        });

        if (!dbPlan) {
            dbPlan = await prisma.plan.create({
                data: {
                    name: 'FREE_TRIAL',
                    price: 0,
                    billingCycle: 'MONTHLY',
                    features: '14-day free trial features',
                    isActive: true
                }
            });
        }

        // Create active subscription
        const subscription = await prisma.subscription.create({
            data: {
                organisationId: organisation.id,
                planId: dbPlan.id,
                startDate: trialStartDate,
                endDate: trialEndDate,
                status: 'ACTIVE',
                autoRenew: true,
                isTrial: true,
                trialStartDate: trialStartDate,
                trialEndDate: trialEndDate,
            }
        });

        // Step 5: Link organisation to Clerk user in database
        const nameParts = enquiry.name.trim().split(/\s+/);
        const dbFirstName = nameParts[0];
        const dbLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

        const createdUser = await prisma.user.create({
            data: {
                clerkId: clerkUser.id,
                email: enquiry.email,
                firstName: dbFirstName,
                lastName: dbLastName,
                mobile: enquiry.mobile || undefined,
                organisationId: organisation.id,
                isApproved: true, // Auto-approve the user as well
                role: 'ORGANISATION_USER',
            },
        });

        // Step 5: Send email to user with login credentials
        // Note: Password might be null if they were already logged in (onboarding flow)
        await sendOrganisationInvite({
            email: enquiry.email,
            password: enquiry.password || "Redirect to login", // Fallback for already registered users
            organisationName: enquiry.organisationName || enquiry.name,
            ownerName: enquiry.name,
        });

        // Step 6: Mark enquiry as converted
        await prisma.enquiry.update({
            where: { id: enquiryId },
            data: { isConverted: true }
        });

        // Log the action
        await prisma.logEvents.create({
            data: {
                message: `Enquiry ${enquiryId} converted to organisation ${organisation.id}`,
                level: 'Info',
                timeStamp: new Date(),
                properties: JSON.stringify({
                    enquiryId,
                    organisationId: organisation.id,
                    userId: createdUser.id,
                    clerkId: clerkUser.id,
                })
            }
        });

        return NextResponse.json({
            isSuccess: true,
            data: {
                organisation,
                user: createdUser,
            },
            message: "Organisation created and user invited successfully"
        });
    } catch (error: any) {
        console.error("Error converting enquiry to organisation:", error);
        await logError("Failed to convert enquiry to organisation", {
            action: "convert-enquiry",
            error: error.message
        }, error);
        return NextResponse.json(
            {
                isSuccess: false,
                error: "Failed to convert enquiry",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
