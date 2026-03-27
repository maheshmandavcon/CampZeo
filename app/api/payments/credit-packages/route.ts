import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from '@/lib/api-handler';

async function getHandler(req: Request) {
    const packages = await prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' }
    });

    return NextResponse.json({ packages, isSuccess: true });
}

export const GET = withErrorHandling(getHandler, "GET /api/payments/credit-packages");
