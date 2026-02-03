import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler() {

        // Migration: Add lastRunAt column if missing
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "JobSetting" ADD COLUMN "lastRunAt" TIMESTAMP;`);
        } catch (e: any) {
            console.log("Migration skipped or failed (might already exist):", e.message);
        }

        const jobSettingColumns: any = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'JobSetting'
        `;

        return NextResponse.json({
            success: true,
            message: "Migration attempted",
            jobSettingColumns
        });
    
}

export const GET = withErrorHandling(getHandler, "GET /api/debug");
