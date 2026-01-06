import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET - Fetch single contact
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
    } catch (error: any) {
        console.error('Error fetching contact:', error);
        await logError("Failed to fetch contact", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
    }
}

// PATCH - Update contact
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
    } catch (error: any) {
        console.error('Error updating contact:', error);
        await logError("Failed to update contact", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
    }
}

// DELETE - Delete single contact
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
    } catch (error: any) {
        console.error('Error deleting contact:', error);
        await logError("Failed to delete contact", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
    }
}
