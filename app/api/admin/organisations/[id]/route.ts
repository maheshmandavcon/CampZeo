import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logInfo } from '@/lib/audit-logger';
import { withErrorHandling } from '@/lib/api-handler';

async function getHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await currentUser();
    const dbUser = await prisma.user.findUnique({ where: { clerkId: user?.id } });

    if (!user || dbUser?.role !== "ADMIN_USER") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const organisation = await prisma.organisation.findUnique({
        where: { id: parseInt(id) },
        include: {
            users: true,
        },
    });

    if (!organisation) {
        return NextResponse.json({ isSuccess: false, message: "Organisation not found" }, { status: 404 });
    }

    return NextResponse.json({
        data: organisation,
        isSuccess: true,
        message: null,
    });
}

async function putHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await currentUser();
    const dbUser = await prisma.user.findUnique({ where: { clerkId: user?.id } });

    if (!user || dbUser?.role !== "ADMIN_USER") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
        name,
        ownerName,
        phone,
        email,
        address,
        city,
        state,
        country,
        postalCode,
        enquiryText,
        taxNumber,
        platforms,
        isFreeTrial,
    } = body;

    const updatedOrganisation = await prisma.organisation.update({
        where: { id: parseInt(id) },
        data: {
            name,
            phone,
            email,
            address,
            city,
            state,
            country,
            postalCode,
            enquiryText,
            taxNumber,
        },
    });

    if (platforms && Array.isArray(platforms)) {
        const PlatformType = {
            EMAIL: 'EMAIL',
            SMS: 'SMS',
            WHATSAPP: 'WHATSAPP',
            RCS: 'RCS',
            FACEBOOK: 'FACEBOOK',
            INSTAGRAM: 'INSTAGRAM',
            LINKEDIN: 'LINKEDIN',
            YOUTUBE: 'YOUTUBE',
            PINTEREST: 'PINTEREST'
        };

        const validPlatforms = platforms
            .map((p: string) => p.toUpperCase())
            .filter((p: string) => Object.values(PlatformType).includes(p));

        await prisma.organisationPlatform.deleteMany({
            where: { organisationId: parseInt(id) }
        });
        
        if (validPlatforms.length > 0) {
            await prisma.organisationPlatform.createMany({
                data: validPlatforms.map((platform: string) => ({
                    organisationId: parseInt(id),
                    platform: platform as any
                }))
            });
        }

        const { deactivatedPlatforms, suspensionReason } = body;
        if (deactivatedPlatforms && Array.isArray(deactivatedPlatforms) && deactivatedPlatforms.length > 0 && suspensionReason) {
            const org = await prisma.organisation.findUnique({
                where: { id: parseInt(id) },
                include: { users: true }
            });

            const owner = org?.users?.[0]; // Get primary user

            if (org) {
                if (owner) {
                    const { sendServiceSuspensionEmail } = await import('@/lib/email');
                    await sendServiceSuspensionEmail({
                        email: owner.email,
                        organisationName: org.name,
                        ownerName: owner.firstName ? `${owner.firstName} ${owner.lastName || ''}`.trim() : (org.ownerName || undefined),
                        suspendedServices: deactivatedPlatforms,
                        reason: suspensionReason
                    });
                }

                await prisma.notification.create({
                    data: {
                        organisationId: parseInt(id),
                        message: `The following services have been suspended for your organisation: ${deactivatedPlatforms.join(', ').toUpperCase()}.\n\nReason: ${suspensionReason}`,
                        type: 'SYSTEM_ALERT',
                        isRead: false
                    }
                });
            }
        }

        const { activatedPlatforms } = body;
        if (activatedPlatforms && Array.isArray(activatedPlatforms) && activatedPlatforms.length > 0) {
            const org = await prisma.organisation.findUnique({
                where: { id: parseInt(id) },
                include: { users: true }
            });

            const owner = org?.users?.[0]; // Get primary user

            if (org) {
                if (owner) {
                    const { sendServiceRestorationEmail } = await import('@/lib/email');
                    await sendServiceRestorationEmail({
                        email: owner.email,
                        organisationName: org.name,
                        ownerName: owner.firstName ? `${owner.firstName} ${owner.lastName || ''}`.trim() : (org.ownerName || undefined),
                        restoredServices: activatedPlatforms
                    });
                }

                await prisma.notification.create({
                    data: {
                        organisationId: parseInt(id),
                        message: `Good news! The following services have been fully restored and re-enabled for your organisation: ${activatedPlatforms.join(', ').toUpperCase()}.`,
                        type: 'SERVICE_RESTORED',
                        isRead: false
                    }
                });
            }
        }
    }

    if (ownerName) {
        const orgUser = await prisma.user.findFirst({
            where: { organisationId: parseInt(id) },
        });

        if (orgUser) {
            const firstName = ownerName.split(' ')[0];
            const lastName = ownerName.split(' ').slice(1).join(' ');

            await prisma.user.update({
                where: { id: orgUser.id },
                data: {
                    firstName: firstName || null,
                    lastName: lastName || null,
                },
            });

            try {
                const client = await clerkClient();
                await client.users.updateUser(orgUser.clerkId, {
                    firstName: firstName || undefined,
                    lastName: lastName || undefined,
                });
            } catch (clerkError) {
                console.error("Error updating Clerk user:", clerkError);
            }
        }
    }

    await logInfo("Organisation updated", { organisationId: parseInt(id), updatedBy: user.id });
    return NextResponse.json({
        data: updatedOrganisation,
        isSuccess: true,
        message: "Organisation updated successfully.",
    });
}

export const GET = withErrorHandling(getHandler, "GET /api/admin/organisations/:id");
export const PUT = withErrorHandling(putHandler, "PUT /api/admin/organisations/:id");
