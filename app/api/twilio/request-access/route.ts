import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from '@/lib/api-handler';
import { logInfo } from '@/lib/audit-logger';

async function postHandler(req: Request) {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reason } = await req.json();

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        include: { organisation: true }
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "User or Organisation not found" }, { status: 404 });
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.twilioAccessRequest.findFirst({
        where: {
            organisationId: dbUser.organisationId,
            status: "PENDING"
        }
    });

    if (existingRequest) {
        return NextResponse.json({ error: "You already have a pending request" }, { status: 400 });
    }

    // Create the request
    const request = await prisma.twilioAccessRequest.create({
        data: {
            organisationId: dbUser.organisationId,
            status: "PENDING",
            reason: reason || ""
        }
    });

    // Update organisation status
    await prisma.organisation.update({
        where: { id: dbUser.organisationId },
        data: {
            twilioAccessStatus: "PENDING",
            twilioAccessReason: reason || ""
        }
    });

    await logInfo("Twilio access requested", { organisationId: dbUser.organisationId, requestId: request.id });

    return NextResponse.json({ isSuccess: true, request });
}

async function getHandler(req: Request) {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id }
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "User or Organisation not found" }, { status: 404 });
    }

    const requests = await prisma.twilioAccessRequest.findMany({
        where: { organisationId: dbUser.organisationId },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ requests, isSuccess: true });
}

export const POST = withErrorHandling(postHandler, "POST /api/twilio/request-access");
export const GET = withErrorHandling(getHandler, "GET /api/twilio/request-access");
