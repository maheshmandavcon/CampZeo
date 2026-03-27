import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from '@/lib/api-handler';

async function getHandler(req: Request) {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id }
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    const wallet = await prisma.wallet.findUnique({
        where: { organisationId: dbUser.organisationId },
        include: {
            transactions: {
                take: 10,
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    // Also get the organisation's twilio status
    const organisation = await prisma.organisation.findUnique({
        where: { id: dbUser.organisationId },
        select: { twilioAccessStatus: true, twilioAccessReason: true }
    });

    return NextResponse.json({ 
        isSuccess: true,
        wallet: wallet || { 
            smsCreditsAvailable: 0, 
            smsCreditsUsed: 0, 
            whatsappCreditsAvailable: 0, 
            whatsappCreditsUsed: 0,
            transactions: [] 
        },
        twilioAccess: organisation
    });
}

export const GET = withErrorHandling(getHandler, "GET /api/wallet/balance");
