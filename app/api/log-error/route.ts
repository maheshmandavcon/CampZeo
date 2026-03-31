import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { apiName, error, stack, context } = body;

        console.error(`[Error Log] ${apiName}: ${error}`);
        if (stack) console.error(stack);
        if (context) console.log('Context:', JSON.stringify(context, null, 2));

        await prisma.logEvents.create({
            data: {
                message: `[${apiName}] ${error}`,
                exception: stack || null,
                timeStamp: new Date(),
                level: "ERROR",
                properties: context ? JSON.stringify(context) : null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Failed to log error:", err);
        return NextResponse.json({ error: "Failed to log error" }, { status: 500 });
    }
}
