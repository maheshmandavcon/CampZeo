import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Assuming this alias works, if not will use relative path. 

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get('x-api-key');

    if (!process.env.N8N_API_KEY) {
        // If not strict about key presence for dev, maybe skip? But better to be safe.
        // For now I'll assume it's required.
    }

    if (apiKey !== process.env.N8N_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch organizations
        const organizations = await prisma.organisation.findMany({
            select: {
                id: true,
                name: true,
            },
            where: {
                isDeleted: false,
                // Fetching all non-deleted, maybe filter by approved if needed
                isApproved: true
            }
        });

        return NextResponse.json(organizations);
    } catch (error) {
        console.error('Error fetching organizations for n8n:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
