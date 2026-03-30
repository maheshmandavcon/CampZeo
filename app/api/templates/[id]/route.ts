import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logInfo } from '@/lib/audit-logger';
import { withErrorHandling } from '@/lib/api-handler';
import { getImpersonatedOrganisationId } from '@/lib/admin-impersonation';  

// GET: Get a single template
async function getHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
        return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    let effectiveOrganisationId = dbUser?.organisationId;

    if (dbUser?.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            effectiveOrganisationId = impersonatedId;
        }
    }

    if (!effectiveOrganisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    const template = await prisma.messageTemplate.findFirst({
        where: {
            id: templateId,
            organisationId: effectiveOrganisationId
        }
    });

    if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        data: template
    });
}

// PUT: Update a template
async function putHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
        return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    let effectiveOrganisationId = dbUser?.organisationId;

    if (dbUser?.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            effectiveOrganisationId = impersonatedId;
        }
    }

    if (!effectiveOrganisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    // Verify template belongs to user's organization
    const existingTemplate = await prisma.messageTemplate.findFirst({
        where: {
            id: templateId,
            organisationId: effectiveOrganisationId
        }
    });

    if (!existingTemplate) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, content, subject, platform, category, variables, isActive, metadata, mediaUrls } = body;

    console.log('Updating template:', templateId, 'with data:', {
        name,
        hasContent: !!content,
        platform,
        category,
        hasMetadata: !!metadata,
        mediaUrlsCount: mediaUrls?.length || 0
    });

    const template = await prisma.messageTemplate.update({
        where: { id: templateId },
        data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(content !== undefined && { content }),
            ...(subject !== undefined && { subject }),
            ...(platform !== undefined && { platform }),
            ...(category !== undefined && { category }),
            ...(variables !== undefined && { variables }),
            ...(metadata !== undefined && { metadata }),
            ...(mediaUrls !== undefined && { mediaUrls }),
            ...(isActive !== undefined && { isActive })
        }
    });

    await logInfo("Template updated", { templateId: template.id, updatedBy: user.id });
    return NextResponse.json({
        success: true,
        data: template,
        message: "Template updated successfully"
    });
}

// DELETE: Delete a template
async function deleteHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
        return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true, role: true }
    });

    let effectiveOrganisationId = dbUser?.organisationId;

    if (dbUser?.role === 'ADMIN_USER') {
        const impersonatedId = await getImpersonatedOrganisationId();
        if (impersonatedId) {
            effectiveOrganisationId = impersonatedId;
        }
    }

    if (!effectiveOrganisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    // Verify template belongs to user's organization
    const existingTemplate = await prisma.messageTemplate.findFirst({
        where: {
            id: templateId,
            organisationId: effectiveOrganisationId
        }
    });

    if (!existingTemplate) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.messageTemplate.delete({
        where: { id: templateId }
    });

    await logInfo("Template deleted", { templateId, deletedBy: user.id });
    return NextResponse.json({
        success: true,
        message: "Template deleted successfully"
    });
}

export const GET = withErrorHandling(getHandler, "GET /api/templates/:id");
export const PUT = withErrorHandling(putHandler, "PUT /api/templates/:id");
export const DELETE = withErrorHandling(deleteHandler, "DELETE /api/templates/:id");
