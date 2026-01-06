import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
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
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
