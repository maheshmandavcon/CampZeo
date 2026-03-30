import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from '@/lib/api-handler';
import { logInfo, logWarning } from '@/lib/audit-logger';
import { sendTwilioAccessStatusEmail } from "@/lib/email";

async function getHandler(req: Request) {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id }
    });

    if (!dbUser || dbUser.role !== "ADMIN_USER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await prisma.twilioAccessRequest.findMany({
        include: { organisation: true },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ requests, isSuccess: true });
}

async function patchHandler(req: Request) {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id }
    });

    if (!dbUser || dbUser.role !== "ADMIN_USER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { requestId, status, reason } = await req.json();

    if (!requestId || !status) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const request = await prisma.twilioAccessRequest.findUnique({
        where: { id: requestId },
        include: { organisation: true }
    });

    if (!request) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Update the request
    const updatedRequest = await prisma.twilioAccessRequest.update({
        where: { id: requestId },
        data: {
            status,
            reason: reason || request.reason,
            updatedAt: new Date()
        }
    });

    // Update organisation status
    await prisma.organisation.update({
        where: { id: request.organisationId },
        data: {
            twilioAccessStatus: status,
            twilioAccessReason: reason || request.reason
        }
    });

    // If approved, ensure the organisation has a wallet
    if (status === "APPROVED") {
        await prisma.wallet.upsert({
            where: { organisationId: request.organisationId },
            update: {},
            create: {
                organisationId: request.organisationId,
                smsCreditsAvailable: 0,
                whatsappCreditsAvailable: 0
            }
        });
    }

    // Send email notification to user
    if ((status === "APPROVED" || status === "REJECTED") && request.organisation.email) {
        try {
            await sendTwilioAccessStatusEmail({
                email: request.organisation.email,
                organisationName: request.organisation.name,
                status: status as 'APPROVED' | 'REJECTED',
                reason: reason || request.reason || undefined,
                ownerName: request.organisation.ownerName || undefined
            });
        } catch (error) {
            console.error("Failed to send Twilio access status email:", error);
            // We don't want to fail the whole request if email fails
        }
    }

    await logInfo(`Twilio access request ${status}`, { organisationId: request.organisationId, requestId, status });

    return NextResponse.json({ isSuccess: true, request: updatedRequest });
}

export const GET = withErrorHandling(getHandler, "GET /api/admin/twilio-requests");
export const PATCH = withErrorHandling(patchHandler, "PATCH /api/admin/twilio-requests");
