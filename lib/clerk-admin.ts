/**
 * Clerk Admin utilities for user management and impersonation
 */

import { clerkClient } from "@clerk/nextjs/server";

interface CreateUserParams {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
}

/**
 * Create a new user in Clerk
 * @param params - User creation parameters
 * @returns Clerk user object
 */
export async function createClerkUser(params: CreateUserParams) {
    const { email, password, firstName, lastName, username } = params;

    // Validate inputs
    if (!email || email.trim() === '') {
        throw new Error('Email is required');
    }
    if (!password || password.trim() === '') {
        throw new Error('Password is required');
    }

    try {
        const client = await clerkClient();

        // Generate username from email if not provided (fallback)
        const generatedUsername = username || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

        console.log('Creating Clerk user with:', {
            email: email.trim(),
            username: generatedUsername,
            firstName: firstName || 'User',
            hasPassword: !!password,
            passwordLength: password.length
        });

        const user = await client.users.createUser({
            emailAddress: [email.trim()],
            username: generatedUsername,
            password,
            firstName: firstName?.trim() || 'User',
            lastName: lastName?.trim() || undefined,
            skipPasswordChecks: true,
            skipPasswordRequirement: false,
            legalAcceptedAt: new Date(), // Set current date as legal consent acceptance
        });

        console.log('User created successfully:', user.id);
        return user;
    } catch (error: any) {
        console.error('=== Clerk User Creation Error ===');
        console.error('Email:', email);
        console.error('Error object:', error);
        console.error('Error message:', error?.message);
        console.error('Error errors:', error?.errors);
        console.error('Error status:', error?.status);
        console.error('Full error:', JSON.stringify(error, null, 2));

        // Provide more specific error message
        if (error?.errors && Array.isArray(error.errors)) {
            const errorMessages = error.errors.map((e: any) => e.message).join(', ');
            throw new Error(`Failed to create user: ${errorMessages}`);
        }

        throw new Error(`Failed to create user in authentication system: ${error?.message || 'Unknown error'}`);
    }
}

/**
 * Generate a sign-in token for user impersonation
 * @param userId - Clerk user ID
 * @returns Sign-in token
 */
export async function generateSignInToken(userId: string) {
    try {
        // Create a sign-in token that allows the admin to sign in as this user
        const client = await clerkClient();
        const token = await client.signInTokens.createSignInToken({
            userId,
            expiresInSeconds: 3600, // 1 hour
        });

        return token;
    } catch (error) {
        console.error('Error generating sign-in token:', error);
        throw new Error('Failed to generate sign-in token');
    }
}

/**
 * Delete a Clerk user
 * @param userId - Clerk user ID
 */
export async function deleteClerkUser(userId: string) {
    try {
        const client = await clerkClient();
        await client.users.deleteUser(userId);
    } catch (error) {
        console.error('Error deleting Clerk user:', error);
        throw new Error('Failed to delete user from authentication system');
    }
}
