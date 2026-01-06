import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: { organisation: true },
        });

        if (!dbUser || !dbUser.organisationId) {
            return NextResponse.json({ error: "User not found or no organisation" }, { status: 404 });
        }

        const latestInvoice = await prisma.invoice.findFirst({
            where: {
                subscription: {
                    organisationId: dbUser.organisationId
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!latestInvoice) {
            return NextResponse.json({ error: "No invoices found" }, { status: 404 });
        }

        return NextResponse.json({ invoice: latestInvoice });
    } catch (error) {
        console.error("Error fetching latest invoice:", error);
        return NextResponse.json(
            { error: "Failed to fetch latest invoice" },
            { status: 500 }
        );
    }
}
