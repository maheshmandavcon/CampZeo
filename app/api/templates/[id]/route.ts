import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

// GET: Get a single template
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
            where: { clerkId: user.id }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
        }

        const template = await prisma.messageTemplate.findFirst({
            where: {
                id: templateId,
                organisationId: dbUser.organisationId
            }
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: template
        });

    } catch (error: any) {
        console.error("Error fetching template:", error);
        await logError("Failed to fetch template", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: "Failed to fetch template" },
            { status: 500 }
        );
    }
}

// PUT: Update a template
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
            where: { clerkId: user.id }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
        }

        // Verify template belongs to user's organization
        const existingTemplate = await prisma.messageTemplate.findFirst({
            where: {
                id: templateId,
                organisationId: dbUser.organisationId
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

    } catch (error: any) {
        console.error("Error updating template:", error);
        await logError("Failed to update template", { userId: "unknown" }, error);
        return NextResponse.json(
            {
                error: "Failed to update template",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

// DELETE: Delete a template
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
            where: { clerkId: user.id }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
        }

        // Verify template belongs to user's organization
        const existingTemplate = await prisma.messageTemplate.findFirst({
            where: {
                id: templateId,
                organisationId: dbUser.organisationId
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

    } catch (error: any) {
        console.error("Error deleting template:", error);
        await logError("Failed to delete template", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: "Failed to delete template" },
            { status: 500 }
        );
    }
}
