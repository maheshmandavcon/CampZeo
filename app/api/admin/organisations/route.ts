import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generatePassword, sendOrganisationInvite } from "@/lib/email";
import { createClerkUser } from "@/lib/clerk-admin";
import { sendSms } from "@/lib/twilio";
import { logError, logWarning, logInfo } from "@/lib/audit-logger";
// Define PlatformType locally to avoid build errors if Prisma client generation fails to export it
enum PlatformType {
    EMAIL = 'EMAIL',
    SMS = 'SMS',
    WHATSAPP = 'WHATSAPP',
    RCS = 'RCS',
    FACEBOOK = 'FACEBOOK',
    INSTAGRAM = 'INSTAGRAM',
    LINKEDIN = 'LINKEDIN',
    YOUTUBE = 'YOUTUBE',
    PINTEREST = 'PINTEREST'
}


// GET: List Organisations with Pagination, Search, Sorting
export async function GET(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({ where: { clerkId: user.id } });

        if (dbUser?.role !== "ADMIN_USER") {
            await logWarning("Forbidden access attempt to list organisations", { userId: user.id, role: dbUser?.role });
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const pageSize = parseInt(searchParams.get("pageSize") || "10");
        const pageNumber = parseInt(searchParams.get("pageNumber") || "1");
        const searchText = searchParams.get("searchText") || "";
        const isDeletedParam = searchParams.get("isDeleted");
        const isApprovedParam = searchParams.get("isApproved");
        const sortBy = searchParams.get("sortBy") || "createdAt";
        const sortDesc = searchParams.get("sortDesc") === "true";

        const skip = (pageNumber - 1) * pageSize;
        const take = pageSize === 0 ? undefined : pageSize; // 0 means all

        const whereClause: any = {};

        // Only add isDeleted filter if parameter is provided
        if (isDeletedParam !== null) {
            whereClause.isDeleted = isDeletedParam === "true";
        }

        if (isApprovedParam !== null) {
            whereClause.isApproved = isApprovedParam === "true";
        }

        if (searchText) {
            whereClause.OR = [
                { name: { contains: searchText, mode: "insensitive" } },
                // Search in related Users for email and name
                { users: { some: { email: { contains: searchText, mode: "insensitive" } } } },
                { users: { some: { firstName: { contains: searchText, mode: "insensitive" } } } },
                { users: { some: { lastName: { contains: searchText, mode: "insensitive" } } } },
            ];
        }

        const [organisations, totalCount] = await Promise.all([
            prisma.organisation.findMany({
                where: whereClause,
                skip,
                take,
                orderBy: {
                    [sortBy]: sortDesc ? "desc" : "asc",
                },
                include: {
                    users: true, // Include users to show owner details if needed
                    organisationPlatforms: true,
                },
            }),
            prisma.organisation.count({ where: whereClause }),
        ]);

        const list = organisations.map((org: any) => ({
            ...org,
            platforms: org.organisationPlatforms.map((op: any) => op.platform.toLowerCase())
        }));

        return NextResponse.json({
            data: {
                list,
                totalCount,
            },
            isSuccess: true,
            message: null,
        });

    } catch (error) {
        console.error("Error fetching organisations:", error);
        await logError("Failed to fetch organisations", { userId: "Unknown" }, error as Error);
        return NextResponse.json(
            { isSuccess: false, message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// POST: Create or Update Organisation
export async function POST(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({ where: { clerkId: user.id } });

        if (dbUser?.role !== "ADMIN_USER") {
            await logWarning("Forbidden access attempt to create/update organisation", { userId: user.id, role: dbUser?.role });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            id, // If ID is present, it's an update
            name,
            ownerName,
            phone,
            email,
            address,
            city,
            state,
            country,
            postalCode,
            enquiryText,
            taxNumber,
            organisationPlatform, // Assuming this maps to 'platforms' JSON or separate table
            isFreeTrial,
        } = body;

        if (!name || !email) {
            return NextResponse.json({ isSuccess: false, message: "Name and Email are required" }, { status: 400 });
        }

        let organisation;

        if (id && id !== 0 && id !== "0") {
            // UPDATE
            await prisma.$transaction(async (tx: any) => {
                await tx.organisation.update({
                    where: { id: Number(id) },
                    data: {
                        name,
                        phone,
                        email,
                        address,
                        city,
                        state,
                        country,
                        postalCode,
                        enquiryText: enquiryText,
                        taxNumber,
                    },
                });

                if (organisationPlatform) {
                    await tx.organisationPlatform.deleteMany({
                        where: { organisationId: Number(id) }
                    });

                    if (organisationPlatform.length > 0) {
                        const validPlatforms = organisationPlatform
                            .map((p: string) => p.toUpperCase())
                            .filter((p: string) => Object.values(PlatformType).includes(p as PlatformType));

                        if (validPlatforms.length > 0) {
                            await tx.organisationPlatform.createMany({
                                data: validPlatforms.map((p: string) => ({
                                    organisationId: Number(id),
                                    platform: p as any
                                }))
                            });
                        }
                    }
                }
            });

            organisation = await prisma.organisation.findUnique({
                where: { id: Number(id) },
                include: { organisationPlatforms: true, users: true }
            });
        } else {
            // CREATE
            const trialStartDate = isFreeTrial ? new Date() : null;
            const trialEndDate = isFreeTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

            const validPlatforms = organisationPlatform
                ? organisationPlatform
                    .map((p: string) => p.toUpperCase())
                    .filter((p: string) => Object.values(PlatformType).includes(p as PlatformType))
                : [];

            organisation = await prisma.organisation.create({
                data: {
                    name,
                    phone,
                    email,
                    address,
                    city,
                    state,
                    country,
                    postalCode,
                    enquiryText: enquiryText,
                    taxNumber,
                    isTrial: isFreeTrial,
                    trialStartDate,
                    trialEndDate,
                    isApproved: false, // Requires admin approval
                    ownerName,
                    organisationPlatforms: {
                        create: validPlatforms.map((p: string) => ({
                            platform: p as any
                        }))
                    }
                },
                include: { organisationPlatforms: true, users: true }
            });

            console.log(`✅ Organisation created: ${organisation.name} (ID: ${organisation.id})`);
            console.log(`⏳ Awaiting approval to create user account and send invitation`);
        }

        const responseOrg = {
            ...organisation,
            platforms: organisation?.organisationPlatforms.map((op: any) => op.platform.toLowerCase()) || []
        };

        return NextResponse.json({
            data: {
                list: [responseOrg],
                totalCount: 1
            },
            isSuccess: true,
            message: id ? "Organisation updated successfully." : "Organisation created successfully. Approve to send invitation.",
        });

    } catch (error) {
        console.error("Error saving organisation:", error);
        await logError("Failed to save organisation", { action: "create-update-organisation" }, error as Error);
        return NextResponse.json(
            { isSuccess: false, message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
