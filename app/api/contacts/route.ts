import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET - Fetch contacts with search, filter, and pagination
export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user from database to check organisation
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

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const campaignId = searchParams.get('campaignId');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {
            organisationId: effectiveOrganisationId,
        };

        // Add search filter
        if (search) {
            where.OR = [
                { contactName: { contains: search, mode: 'insensitive' } },
                { contactEmail: { contains: search, mode: 'insensitive' } },
                { contactMobile: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Add campaign filter
        if (campaignId) {
            where.campaigns = {
                some: {
                    id: parseInt(campaignId)
                }
            };
        }

        // Get total count
        const total = await prisma.contact.count({ where });

        // Fetch contacts with pagination
        const contacts = await prisma.contact.findMany({
            where,
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
            },
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder
            }
        });

        return NextResponse.json({
            contacts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        console.error('Error fetching contacts:', error);
        await logError("Failed to fetch contacts", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }
}

// POST - Create new contact
export async function POST(request: NextRequest) {
    try {
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

        const body = await request.json();
        const { contactName, contactEmail, contactMobile, contactWhatsApp, campaignIds } = body;

        // Validation: At least one field required
        if (!contactName && !contactEmail && !contactMobile) {
            return NextResponse.json(
                { error: 'At least one of name, email, or mobile is required' },
                { status: 400 }
            );
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (contactEmail && !emailRegex.test(contactEmail)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Phone validation (basic)
        const phoneRegex = /^\+?[\d\s\-()]+$/;
        if (contactMobile && (!phoneRegex.test(contactMobile) || contactMobile.replace(/\D/g, '').length < 10)) {
            return NextResponse.json(
                { error: 'Invalid mobile number format' },
                { status: 400 }
            );
        }

        if (contactWhatsApp && (!phoneRegex.test(contactWhatsApp) || contactWhatsApp.replace(/\D/g, '').length < 10)) {
            return NextResponse.json(
                { error: 'Invalid WhatsApp number format' },
                { status: 400 }
            );
        }

        // Check for duplicates
        const existingContact = await prisma.contact.findFirst({
            where: {
                organisationId: effectiveOrganisationId,
                OR: [
                    ...(contactEmail ? [{ contactEmail: { equals: contactEmail, mode: 'insensitive' as any } }] : []),
                    ...(contactMobile ? [{ contactMobile }] : [])
                ]
            }
        });

        if (existingContact) {
            const duplicateField = existingContact.contactEmail?.toLowerCase() === contactEmail?.toLowerCase()
                ? 'email'
                : 'mobile';
            return NextResponse.json(
                {
                    error: `A contact with this ${duplicateField} already exists`,
                    duplicate: true,
                    field: duplicateField
                },
                { status: 409 }
            );
        }

        // Create contact
        const contact = await prisma.contact.create({
            data: {
                contactName,
                contactEmail,
                contactMobile,
                contactWhatsApp,
                organisationId: effectiveOrganisationId,
                ...(campaignIds && campaignIds.length > 0 ? {
                    campaigns: {
                        connect: campaignIds.map((id: number) => ({ id }))
                    }
                } : {})
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

        await logInfo("Contact created", { contactId: contact.id, contactName: contact.contactName, createdBy: user.id });
        return NextResponse.json(contact, { status: 201 });
    } catch (error: any) {
        console.error('Error creating contact:', error);
        await logError("Failed to create contact", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
    }
}

// DELETE - Bulk delete contacts
export async function DELETE(request: NextRequest) {
    try {
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

        const body = await request.json();
        const { contactIds } = body;

        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            return NextResponse.json({ error: 'Invalid contact IDs' }, { status: 400 });
        }

        // Delete contacts (only ones belonging to the organisation)
        const result = await prisma.contact.deleteMany({
            where: {
                id: { in: contactIds },
                organisationId: effectiveOrganisationId
            }
        });

        await logInfo("Contacts deleted", { count: result.count, deletedBy: user.id });
        return NextResponse.json({
            message: `Successfully deleted ${result.count} contact(s)`,
            count: result.count
        });
    } catch (error: any) {
        console.error('Error deleting contacts:', error);
        await logError("Failed to delete contacts", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to delete contacts' }, { status: 500 });
    }
}
