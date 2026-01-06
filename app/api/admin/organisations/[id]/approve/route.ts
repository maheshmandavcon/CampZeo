import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generatePassword, sendOrganisationInvite } from "@/lib/email";
import { createClerkUser } from "@/lib/clerk-admin";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ isSuccess: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const organisationId = parseInt(id);

        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user || user.role !== 'ADMIN_USER') {
            await logWarning("Forbidden access attempt to approve organisation", { userId, organisationId });
            return NextResponse.json({ isSuccess: false, message: 'Forbidden' }, { status: 403 });
        }

        if (isNaN(organisationId)) {
            return NextResponse.json({ isSuccess: false, message: 'Invalid organisation ID' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const { firstName, lastName, username, email: bodyEmail, password: bodyPassword } = body;

        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
        });

        if (!organisation) {
            return NextResponse.json({ isSuccess: false, message: 'Organisation not found' }, { status: 404 });
        }

        const isApproved = organisation.isApproved;

        let updatedOrganisation;
        let message;

        if (isApproved) {
            updatedOrganisation = await prisma.organisation.update({
                where: { id: organisationId },
                data: {
                    isDeleted: false,
                    isApproved: true
                },
            });
            message = `Organisation ${organisation.name} has been recovered`;
        } else {
            updatedOrganisation = await prisma.organisation.update({
                where: { id: organisationId },
                data: {
                    isDeleted: false,
                    isApproved: true
                },
            });
            message = `Organisation ${organisation.name} has been approved`;

            const existingUser = await prisma.user.findFirst({
                where: { organisationId: organisationId }
            });

            if (!existingUser) {
                const password = bodyPassword || generatePassword();
                const email = bodyEmail || organisation.email;

                if (!email) {
                    console.error("No email found for organisation, cannot create user");
                } else {
                    try {
                        let finalFirstName = firstName;
                        let finalLastName = lastName;

                        if (!finalFirstName) {
                            const nameParts = (organisation.ownerName || "").split(" ");
                            finalFirstName = nameParts[0] || "Admin";
                            finalLastName = nameParts.slice(1).join(" ") || "";
                        }

                        const clerkUser = await createClerkUser({
                            email,
                            password,
                            firstName: finalFirstName,
                            lastName: finalLastName,
                            username: username // Optional
                        });

                        await prisma.user.create({
                            data: {
                                clerkId: clerkUser.id,
                                email: email,
                                firstName: finalFirstName,
                                lastName: finalLastName,
                                role: "ORGANISATION_USER",
                                organisationId: organisationId,
                                isApproved: true,
                                isFirstLogin: true
                            }
                        });

                        await sendOrganisationInvite({
                            email,
                            password,
                            organisationName: organisation.name,
                            ownerName: `${finalFirstName} ${finalLastName}`.trim() || "User"
                        });

                        message += ". User account created and invitation sent.";
                    } catch (err: any) {
                        console.error("Failed to create user/send invite:", err);
                        message += ". Warning: Failed to create user account (" + err.message + ")";
                    }
                }
            }
        }

        await logInfo("Organisation approved", { organisationId, approvedBy: userId, message });
        return NextResponse.json({
            isSuccess: true,
            message,
            data: updatedOrganisation
        });
    } catch (error: any) {
        console.error('Suspend/Recover error:', error);
        await logError("Failed to approve organisation", { userId: "Unknown" }, error);
        return NextResponse.json({
            isSuccess: false,
            message: error.message || 'Failed to update organisation status'
        }, { status: 500 });
    }
}
