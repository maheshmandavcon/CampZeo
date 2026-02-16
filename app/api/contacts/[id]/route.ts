import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logInfo } from '@/lib/audit-logger';
import { withErrorHandling } from '@/lib/api-handler';

// GET - Fetch single contact
async function getHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    let effectiveOrganisationId = dbUser?.organisationId;

    // Check for admin impersonation
    if (dbUser?.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            effectiveOrganisationId = impersonatedId;
        }
    }

    if (!effectiveOrganisationId) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    const contact = await prisma.contact.findFirst({
        where: {
            id: parseInt(id),
            organisationId: effectiveOrganisationId
        },
        include: {
            campaigns: {
                where: {
                    isDeleted: false
                },
                select: {
                    id: true,
                    name: true,
                    startDate: true,
                    endDate: true,
                }
            }
        }
    });

    if (!contact) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json(contact);
}

// PATCH - Update contact
async function patchHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    let effectiveOrganisationId = dbUser?.organisationId;

    // Check for admin impersonation
    if (dbUser?.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            effectiveOrganisationId = impersonatedId;
        }
    }

    if (!effectiveOrganisationId) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Verify contact belongs to organisation
    const existingContact = await prisma.contact.findFirst({
        where: {
            id: parseInt(id),
            organisationId: effectiveOrganisationId
        }
    });

    if (!existingContact) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const { contactName, contactEmail, contactMobile, contactWhatsApp, campaignIds } = body;

    // Update contact
    const contact = await prisma.contact.update({
        where: { id: parseInt(id) },
        data: {
            ...(contactName !== undefined && { contactName }),
            ...(contactEmail !== undefined && { contactEmail }),
            ...(contactMobile !== undefined && { contactMobile }),
            ...(contactWhatsApp !== undefined && { contactWhatsApp }),
            ...(campaignIds !== undefined && {
                campaigns: {
                    set: campaignIds.map((id: number) => ({ id }))
                }
            })
        },
        include: {
            campaigns: {
                where: {
                    isDeleted: false
                },
                select: {
                    id: true,
                    name: true,
                }
            }
        }
    });

    await logInfo("Contact updated", { contactId: contact.id, updatedBy: user.id });
    return NextResponse.json(contact);
}

// DELETE - Delete single contact
async function deleteHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    let effectiveOrganisationId = dbUser?.organisationId;

    // Check for admin impersonation
    if (dbUser?.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            effectiveOrganisationId = impersonatedId;
        }
    }

    if (!effectiveOrganisationId) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Delete contact (only if it belongs to the organisation)
    const result = await prisma.contact.deleteMany({
        where: {
            id: parseInt(id),
            organisationId: effectiveOrganisationId
        }
    });

    if (result.count === 0) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await logInfo("Contact deleted", { contactId: parseInt(id), deletedBy: user.id });
    return NextResponse.json({ message: 'Contact deleted successfully' });
}

export const GET = withErrorHandling(getHandler, "GET /api/contacts/:id");
export const PATCH = withErrorHandling(patchHandler, "PATCH /api/contacts/:id");
export const DELETE = withErrorHandling(deleteHandler, "DELETE /api/contacts/:id");
