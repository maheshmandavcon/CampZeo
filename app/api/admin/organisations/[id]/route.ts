import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        const dbUser = await prisma.user.findUnique({ where: { clerkId: user?.id } });

        if (!user || dbUser?.role !== "ADMIN_USER") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const organisation = await prisma.organisation.findUnique({
            where: { id: parseInt(id) },
            include: {
                users: true,
            },
        });

        if (!organisation) {
            return NextResponse.json({ isSuccess: false, message: "Organisation not found" }, { status: 404 });
        }

        return NextResponse.json({
            data: organisation,
            isSuccess: true,
            message: null,
        });

    } catch (error: any) {
        console.error("Error fetching organisation:", error);
        await logError("Failed to fetch organisation detail", { userId: "Unknown" }, error);
        return NextResponse.json(
            { isSuccess: false, message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        const dbUser = await prisma.user.findUnique({ where: { clerkId: user?.id } });

        if (!user || dbUser?.role !== "ADMIN_USER") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const {
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
            platforms,
            isFreeTrial,
        } = body;

        const updatedOrganisation = await prisma.organisation.update({
            where: { id: parseInt(id) },
            data: {
                name,
                phone,
                email,
                address,
                city,
                state,
                country,
                postalCode,
                enquiryText,
                taxNumber,
            },
        });

        if (platforms && Array.isArray(platforms)) {
            await prisma.organisationPlatform.deleteMany({
                where: { organisationId: parseInt(id) }
            });
            await prisma.organisationPlatform.createMany({
                data: platforms.map((platform: string) => ({
                    organisationId: parseInt(id),
                    platform: platform as any
                }))
            });
        }

        if (ownerName) {
            const orgUser = await prisma.user.findFirst({
                where: { organisationId: parseInt(id) },
            });

            if (orgUser) {
                const firstName = ownerName.split(' ')[0];
                const lastName = ownerName.split(' ').slice(1).join(' ');

                await prisma.user.update({
                    where: { id: orgUser.id },
                    data: {
                        firstName: firstName || null,
                        lastName: lastName || null,
                    },
                });

                try {
                    const client = await clerkClient();
                    await client.users.updateUser(orgUser.clerkId, {
                        firstName: firstName || undefined,
                        lastName: lastName || undefined,
                    });
                } catch (clerkError) {
                    console.error("Error updating Clerk user:", clerkError);
                }
            }
        }

        await logInfo("Organisation updated", { organisationId: parseInt(id), updatedBy: user.id });
        return NextResponse.json({
            data: updatedOrganisation,
            isSuccess: true,
            message: "Organisation updated successfully.",
        });

    } catch (error: any) {
        console.error("Error updating organisation:", error);
        await logError("Failed to update organisation", { userId: "Unknown" }, error);
        return NextResponse.json(
            { isSuccess: false, message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
