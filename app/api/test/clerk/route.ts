import { NextResponse } from "next/server";

export async function GET() {
    try {
        console.log("=== /api/test/clerk called ===");
        console.log("CLERK_SECRET_KEY:", process.env.CLERK_SECRET_KEY?.substring(0, 10) + "...");
        console.log("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:", process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 10) + "...");

        // Test 1: Check if Clerk module loads
        const { currentUser } = await import("@clerk/nextjs/server");
        console.log("Clerk module loaded successfully");

        // Test 2: Try to get current user
        const user = await currentUser();
        console.log("currentUser() result:", user ? "User found" : "No user");

        if (user) {
            console.log("User ID:", user.id);
            console.log("User email:", user.emailAddresses?.[0]?.emailAddress);
        }

        return NextResponse.json({
            success: true,
            hasUser: !!user,
            userId: user?.id,
            clerkConfigured: !!process.env.CLERK_SECRET_KEY
        });
    } catch (error) {
        console.error("=== ERROR in /api/test/clerk ===");
        console.error(error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
