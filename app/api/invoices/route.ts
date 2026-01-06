import { currentUser } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        let userId: string | null = null;
        const user = await currentUser();

        if (user) {
            userId = user.id;
        } else {
            // Check for Mobile API Key
            const apiKey = req.headers.get('x-api-key');
            const validApiKey = process.env.MOBILE_API_KEY;

            if (apiKey && validApiKey && apiKey === validApiKey) {
                // If API Key is valid, allow fetching for a specific clerkId (userId) passed in query
                const { searchParams } = new URL(req.url);
                const queryUserId = searchParams.get('userId');

                if (queryUserId) {
                    userId = queryUserId;
                } else {
                    return NextResponse.json({ error: "Missing userId query parameter for API Key access" }, { status: 400 });
                }
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: userId },
            include: { organisation: true },
        });

        if (!dbUser || !dbUser.organisationId) {
            return NextResponse.json({ error: "User not found or no tenant" }, { status: 404 });
        }

        const invoices = await prisma.invoice.findMany({
            where: {
                subscription: {
                    organisationId: dbUser.organisationId
                }
            },
            include: {
                subscription: {
                    include: {
                        plan: true,
                        organisation: true
                    }
                }
            },
            orderBy: { invoiceDate: 'desc' }
        });

        return NextResponse.json({ invoices });
    } catch (error) {
        console.error("Error fetching invoices:", error);
        return NextResponse.json(
            { error: "Failed to fetch invoices" },
            { status: 500 }
        );
    }
}
