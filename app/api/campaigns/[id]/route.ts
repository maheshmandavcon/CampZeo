import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET - Fetch a single campaign
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to fetch campaign", { action: "fetch-campaign" });
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

        const { id } = await params;
        const campaignId = parseInt(id);

        // Fetch campaign
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
            include: {
                contacts: {
                    select: {
                        id: true,
                        contactName: true,
                        contactEmail: true,
                        contactMobile: true,
                    },
                },
                _count: {
                    select: {
                        posts: true,
                        contacts: true,
                    },
                },
            },
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json({ campaign });
    } catch (error: any) {
        console.error('Error fetching campaign:', error);
        await logError("Failed to fetch campaign", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
    }
}

// PUT - Update a campaign
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to update campaign", { action: "update-campaign" });
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

        const { id } = await params;
        const campaignId = parseInt(id);
        const body = await request.json();
        const { name, description, startDate, endDate, contactIds } = body;

        // Validation
        if (!name || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'Name, start date, and end date are required' },
                { status: 400 }
            );
        }

        // Check if campaign exists and belongs to organisation
        const existingCampaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
        });

        if (!existingCampaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Update campaign
        const campaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                name,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                contacts: {
                    set: [], // Clear existing contacts
                    connect: contactIds && contactIds.length > 0
                        ? contactIds.map((id: number) => ({ id }))
                        : [],
                },
            },
            include: {
                contacts: true,
                _count: {
                    select: {
                        posts: true,
                        contacts: true,
                    },
                },
            },
        });

        await logInfo("Campaign updated", { campaignId: campaign.id, name: campaign.name, updatedBy: user.id });
        return NextResponse.json({ campaign });
    } catch (error: any) {
        console.error('Error updating campaign:', error);
        await logError("Failed to update campaign", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }
}

// DELETE - Soft delete a campaign
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to delete campaign", { action: "delete-campaign" });
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

        const { id } = await params;
        const campaignId = parseInt(id);

        // Check if campaign exists and belongs to organisation
        const existingCampaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organisationId: effectiveOrganisationId,
                isDeleted: false,
            },
        });

        if (!existingCampaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Soft delete campaign
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { isDeleted: true },
        });

        await logInfo("Campaign deleted", { campaignId, deletedBy: user.id });
        return NextResponse.json({ message: 'Campaign deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting campaign:', error);
        await logError("Failed to delete campaign", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }
}
