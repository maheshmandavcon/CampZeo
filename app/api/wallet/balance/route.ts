import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from '@/lib/api-handler';
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

async function getHandler(req: Request) {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id }
    });

    if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle Admin Impersonation
    // Admins don't have their own wallet — only show wallet if impersonating an org
    let organisationId = dbUser.organisationId;
    if (dbUser.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            organisationId = impersonatedId;
        } else {
            // Admin not impersonating — return empty wallet, admins don't own wallets
            return NextResponse.json({ 
                isSuccess: true,
                isAdmin: true,
                wallet: { 
                    smsCreditsAvailable: 0, 
                    smsCreditsUsed: 0, 
                    whatsappCreditsAvailable: 0, 
                    whatsappCreditsUsed: 0,
                    transactions: [] 
                },
                twilioAccess: null
            });
        }
    }

    if (!organisationId) {
        // Return 200 with zeroed values instead of 404 to gracefully handle 
        // users/admins without an organisation attached yet.
        return NextResponse.json({ 
            isSuccess: true,
            wallet: { 
                smsCreditsAvailable: 0, 
                smsCreditsUsed: 0, 
                whatsappCreditsAvailable: 0, 
                whatsappCreditsUsed: 0,
                transactions: [] 
            },
            twilioAccess: null
        });
    }

    const wallet = await prisma.wallet.findUnique({
        where: { organisationId: organisationId },
        include: {
            transactions: {
                take: 10,
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    // Also get the organisation's twilio status
    const organisation = await prisma.organisation.findUnique({
        where: { id: organisationId },
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
