import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * API route to securely update a user's password using the Clerk Backend SDK.
 * This bypasses client-side restrictions on the 'password' parameter.
 */
export async function POST(req: Request) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { password } = await req.json();

        if (!password || password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
        }

        const client = await clerkClient();
        
        // Update the user's password using the Backend API
        await client.users.updateUser(userId, {
            password: password,
            // Ensure first-time login flag or other metadata can be updated here if needed
        });

        console.log(`Password updated successfully for user: ${userId}`);

        return NextResponse.json({ 
            isSuccess: true, 
            message: "Password updated successfully" 
        });
    } catch (error: any) {
        console.error("Error updating Clerk password:", error);
        
        // Handle Clerk specific errors
        const errorMessage = error.errors?.[0]?.longMessage || error.message || "Failed to update password";
        
        return NextResponse.json({ 
            error: errorMessage 
        }, { status: 500 });
    }
}
