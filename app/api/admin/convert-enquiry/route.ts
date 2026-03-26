import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createClerkUser } from "@/lib/clerk-admin";
import { sendOrganisationInvite } from "@/lib/email";
import { logError, logWarning } from "@/lib/audit-logger";

import { withErrorHandling } from '@/lib/api-handler';
/**
 * POST /api/admin/convert-enquiry
 * Convert an enquiry to organisation with Clerk user creation
 */
async function postHandler(req: Request) {

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
            const baseUsername = enquiry.name
                .toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[^a-z0-9]/g, '');
            const username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;

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

    // Step 3-6: Atomic Database Operations
    const result = await prisma.$transaction(async (tx) => {
        // Step 3: Create organisation with 14-day free trial
        const trialStartDate = new Date();
        const trialEndDate = new Date(trialStartDate.getTime() + 14 * 24 * 60 * 60 * 1000);

        const organisation = await tx.organisation.create({
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
                organisationPlatforms: {
                    create: [
                        { platform: 'EMAIL' },
                        { platform: 'FACEBOOK' },
                        { platform: 'INSTAGRAM' },
                        { platform: 'LINKEDIN' },
                        { platform: 'YOUTUBE' },
                        { platform: 'PINTEREST' },
                    ]
                }
            }
        });

        // Step 4: Handle Plan and Subscription
        let dbPlan = await tx.plan.findFirst({
            where: { name: 'FREE_TRIAL' }
        });

        if (!dbPlan) {
            dbPlan = await tx.plan.create({
                data: {
                    name: 'FREE_TRIAL',
                    price: 0,
                    billingCycle: 'MONTHLY',
                    features: '14-day free trial features',
                    isActive: true
                }
            });
        }

        await tx.subscription.create({
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

        // Check if user already exists in local DB
        const existingUser = await tx.user.findFirst({
            where: {
                OR: [
                    { clerkId: clerkUser.id },
                    { email: enquiry.email }
                ]
            }
        });

        let createdOrUpdatedUser;
        if (existingUser) {
            console.log('Linking existing local user to new organisation:', existingUser.id);
            createdOrUpdatedUser = await tx.user.update({
                where: { id: existingUser.id },
                data: {
                    clerkId: clerkUser.id, // Ensure clerkId is synced
                    organisationId: organisation.id,
                    isApproved: true,
                    role: 'ORGANISATION_USER',
                    firstName: existingUser.firstName || dbFirstName,
                    lastName: existingUser.lastName || dbLastName,
                    mobile: existingUser.mobile || enquiry.mobile || undefined,
                }
            });
        } else {
            console.log('Creating new local user record...');
            createdOrUpdatedUser = await tx.user.create({
                data: {
                    clerkId: clerkUser.id,
                    email: enquiry.email,
                    firstName: dbFirstName,
                    lastName: dbLastName,
                    mobile: enquiry.mobile || undefined,
                    organisationId: organisation.id,
                    isApproved: true,
                    role: 'ORGANISATION_USER',
                },
            });
        }

        // Step 6: Mark enquiry as converted
        await tx.enquiry.update({
            where: { id: enquiryId },
            data: { isConverted: true }
        });

        // Log the action within the transaction
        await tx.logEvents.create({
            data: {
                message: `Enquiry ${enquiryId} converted to organisation ${organisation.id}`,
                level: 'Info',
                timeStamp: new Date(),
                properties: JSON.stringify({
                    enquiryId,
                    organisationId: organisation.id,
                    userId: createdOrUpdatedUser.id,
                    clerkId: clerkUser.id,
                })
            }
        });

        return { organisation, user: createdOrUpdatedUser };
    });

    // Step 7: Send email to user (Outside transaction as it can't be rolled back)
    try {
        await sendOrganisationInvite({
            email: enquiry.email,
            password: enquiry.password || "Redirect to login",
            organisationName: enquiry.organisationName || enquiry.name,
            ownerName: enquiry.name,
        });
    } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
        // We don't throw here as the DB transaction is already committed
        // and the core conversion was successful
    }

    return NextResponse.json({
        isSuccess: true,
        data: {
            organisation: result.organisation,
            user: result.user,
        },
        message: "Organisation created and user invited successfully"
    });

}

export const POST = withErrorHandling(postHandler, "POST /api/admin/convert-enquiry");
