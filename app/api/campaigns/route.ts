import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET - Fetch campaigns for the organisation with pagination
export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to fetch campaigns", { action: "fetch-campaigns" });
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

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {
            organisationId: effectiveOrganisationId,
            isDeleted: false,
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Fetch campaigns with pagination
        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    startDate: true,
                    endDate: true,
                    createdAt: true,
                    _count: {
                        select: {
                            posts: true,
                            contacts: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limit,
            }),
            prisma.campaign.count({ where }),
        ]);

        return NextResponse.json({
            campaigns,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        console.error('Error fetching campaigns:', error);
        await logError("Failed to fetch campaigns", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }
}

// POST - Create a new campaign
export async function POST(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to create campaign", { action: "create-campaign" });
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

        const body = await request.json();
        const { name, description, startDate, endDate, contactIds } = body;

        // Validation
        if (!name || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'Name, start date, and end date are required' },
                { status: 400 }
            );
        }

        // Create campaign with contacts
        const campaign = await prisma.campaign.create({
            data: {
                name,
                description,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                organisationId: effectiveOrganisationId,
                contacts: contactIds && contactIds.length > 0 ? {
                    connect: contactIds.map((id: number) => ({ id })),
                } : undefined,
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

        await logInfo("Campaign created", { campaignId: campaign.id, name: campaign.name, createdBy: user.id });
        return NextResponse.json({ campaign }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating campaign:', error);
        await logError("Failed to create campaign", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }
}
