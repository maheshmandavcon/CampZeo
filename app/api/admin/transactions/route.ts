import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withErrorHandling } from '@/lib/api-handler';

async function getHandler(req: Request) {
    const user = await currentUser();
    const dbUser = await prisma.user.findUnique({ where: { clerkId: user?.id } });

    if (!user || dbUser?.role !== "ADMIN_USER") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const searchText = searchParams.get("searchText") || "";
    const type = searchParams.get("type") || "all"; 

    const skip = (page - 1) * pageSize;

    const where: any = {
        OR: [
            { description: { contains: searchText, mode: 'insensitive' } },
            { wallet: { organisation: { name: { contains: searchText, mode: 'insensitive' } } } },
            { wallet: { organisation: { ownerName: { contains: searchText, mode: 'insensitive' } } } },
        ]
    };

    if (type !== 'all') {
        where.type = type;
    }

    const [transactions, totalCount] = await Promise.all([
        prisma.walletTransaction.findMany({
            where,
            include: {
                wallet: {
                    include: {
                        organisation: {
                            select: {
                                id: true,
                                name: true,
                                ownerName: true,
                                email: true,
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.walletTransaction.count({ where }),
    ]);

    return NextResponse.json({
        isSuccess: true,
        data: {
            list: transactions,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
        }
    });
}

export const GET = withErrorHandling(getHandler, "GET /api/admin/transactions");
