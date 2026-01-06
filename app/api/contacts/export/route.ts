import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET - Export contacts to CSV
export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            await logWarning("Unauthorized access attempt to export contacts", { action: "export-contacts" });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { organisationId: true }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search') || '';
        const campaignId = searchParams.get('campaignId');
        const contactIds = searchParams.get('contactIds'); // For exporting selected contacts

        // Build where clause
        const where: any = {
            organisationId: dbUser.organisationId,
        };

        // Export specific contacts if IDs provided
        if (contactIds) {
            const ids = contactIds.split(',').map(id => parseInt(id));
            where.id = { in: ids };
        } else {
            // Apply filters for full export
            if (search) {
                where.OR = [
                    { contactName: { contains: search, mode: 'insensitive' } },
                    { contactEmail: { contains: search, mode: 'insensitive' } },
                    { contactMobile: { contains: search, mode: 'insensitive' } },
                ];
            }

            if (campaignId) {
                where.campaigns = {
                    some: {
                        id: parseInt(campaignId)
                    }
                };
            }
        }

        // Fetch all matching contacts
        const contacts = await prisma.contact.findMany({
            where,
            include: {
                campaigns: {
                    select: {
                        name: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Generate CSV content
        const csvHeaders = ['ID', 'Name', 'Email', 'Mobile', 'WhatsApp', 'Campaigns', 'Created At'];
        const csvRows = contacts.map((contact: any) => [
            contact.id,
            contact.contactName || '',
            contact.contactEmail || '',
            contact.contactMobile || '',
            contact.contactWhatsApp || '',
            contact.campaigns.map((c: any) => c.name).join('; ') || '',
            new Date(contact.createdAt).toLocaleString()
        ]);

        // Create CSV string
        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map((row: any) =>
                row.map((cell: any) => {
                    // Escape cells containing commas, quotes, or newlines
                    const cellStr = String(cell);
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return `"${cellStr.replace(/"/g, '""')}"`;
                    }
                    return cellStr;
                }).join(',')
            )
        ].join('\n');

        await logInfo("Contacts exported", { count: contacts.length, exportedBy: user.id });
        // Return CSV file
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });
    } catch (error: any) {
        console.error('Error exporting contacts:', error);
        await logError("Failed to export contacts", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to export contacts' }, { status: 500 });
    }
}
