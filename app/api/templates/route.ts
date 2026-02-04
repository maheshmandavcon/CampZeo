import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

import { withErrorHandling } from '@/lib/api-handler';
// GET: List all templates for the organization
async function getHandler(req: Request) {

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            include: { organisation: true }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const platform = searchParams.get("platform");
        const category = searchParams.get("category");
        const search = searchParams.get("search");
        const isActive = searchParams.get("isActive");

        const whereClause: any = {
            organisationId: dbUser.organisationId
        };

        if (platform) {
            // Enforce proper enum casing (uppercase)
            whereClause.platform = platform.toUpperCase() as any;
        }

        if (category) {
            whereClause.category = category.toUpperCase() as any;
        }

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { content: { contains: search, mode: "insensitive" } }
            ];
        }

        if (isActive !== null && isActive !== undefined) {
            whereClause.isActive = isActive === "true";
        }

        const templates = await prisma.messageTemplate.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            data: templates
        });

    
}

export const GET = withErrorHandling(getHandler, "GET /api/templates");

// POST: Create a new template
async function postHandler(req: Request) {

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id }
        });

        if (!dbUser?.organisationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 });
        }

        const body = await req.json();
        const { name, description, content, subject, platform, category, variables, isActive, metadata, mediaUrls } = body;

        if (!name || !content || !platform) {
            return NextResponse.json(
                { error: "Name, content, and platform are required" },
                { status: 400 }
            );
        }

        // Validate and format platform
        const formattedPlatform = platform.toUpperCase();
        const validPlatforms = ['EMAIL', 'SMS', 'WHATSAPP', 'RCS', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'];

        if (!validPlatforms.includes(formattedPlatform)) {
            return NextResponse.json(
                { error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate and format category
        const formattedCategory = category ? category.toUpperCase() : "CUSTOM";
        const validCategories = ['MARKETING', 'TRANSACTIONAL', 'NOTIFICATION', 'CUSTOM'];

        if (!validCategories.includes(formattedCategory)) {
            return NextResponse.json(
                { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
                { status: 400 }
            );
        }

        console.log('Creating template with data:', {
            name,
            description,
            content: content?.substring(0, 50) + '...',
            subject,
            platform: formattedPlatform,
            category: formattedCategory,
            metadata,
            mediaUrls,
            organisationId: dbUser.organisationId,
            createdBy: user.id
        });

        const template = await prisma.messageTemplate.create({
            data: {
                name,
                description,
                content,
                subject,
                platform: formattedPlatform as any,
                category: formattedCategory as any,
                variables: variables || {},
                metadata: metadata || {},
                mediaUrls: mediaUrls || [],
                isActive: isActive !== undefined ? isActive : true,
                organisationId: dbUser.organisationId,
                createdBy: user.id
            }
        });

        await logInfo("Template created", { templateId: template.id, name: template.name, createdBy: user.id });
        return NextResponse.json({
            success: true,
            data: template,
            message: "Template created successfully"
        });

    
}

export const POST = withErrorHandling(postHandler, "POST /api/templates");
