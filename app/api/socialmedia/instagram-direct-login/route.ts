import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * Instagram Direct Login API
 * Authenticates users directly using Instagram credentials (not via Facebook OAuth)
 * This uses Instagram's Graph API with username and password-based authentication
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { message: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Get Instagram Direct credentials from admin config
        const directIdConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key: 'INSTAGRAM_DIRECT_ID' }
        });

        const directSecretConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key: 'INSTAGRAM_DIRECT_SECRET' }
        });

        if (!directIdConfig?.value || !directSecretConfig?.value) {
            return NextResponse.json(
                { message: 'Instagram Direct Login not configured. Please contact admin.' },
                { status: 400 }
            );
        }

        // Step 1: Get OAuth token for Instagram Graph API
        // Note: This is a simplified implementation. In production, you might need to:
        // 1. Use Instagram's official SDK
        // 2. Implement proper error handling for rate limiting and security
        // 3. Consider using Instagram's server-to-server authentication

        try {
            // Attempt to authenticate using Instagram Graph API
            // This endpoint validates credentials and returns an access token
            const tokenResponse = await fetch(
                'https://graph.instagram.com/v18.0/oauth/access_token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        app_id: directIdConfig.value,
                        app_secret: directSecretConfig.value,
                        username: username,
                        password: password,
                        grant_type: 'password'
                    }).toString()
                }
            );

            const tokenData = await tokenResponse.json();

            if (!tokenResponse.ok) {
                console.error('Instagram auth error:', tokenData);
                return NextResponse.json(
                    { message: 'Invalid Instagram credentials. Please check your username and password.' },
                    { status: 401 }
                );
            }

            const accessToken = tokenData.access_token;
            const expiresIn = tokenData.expires_in || 5184000; // 60 days default

            // Step 2: Fetch user information
            const meResponse = await fetch(
                `https://graph.instagram.com/v18.0/me?fields=id,username,name,account_type&access_token=${accessToken}`
            );

            const meData = await meResponse.json();

            if (!meResponse.ok || !meData.id) {
                console.error('Failed to fetch Instagram user:', meData);
                return NextResponse.json(
                    { message: 'Failed to fetch Instagram profile information' },
                    { status: 400 }
                );
            }

            // Step 3: Save to database
            const user = await prisma.user.findUnique({
                where: { clerkId: userId }
            });

            if (!user) {
                return NextResponse.json(
                    { message: 'User not found' },
                    { status: 404 }
                );
            }

            // Update user with Instagram credentials
            await prisma.user.update({
                where: { clerkId: userId },
                data: {
                    instagramAccessToken: accessToken,
                    instagramUserId: meData.id,
                    instagramTokenCreatedAt: new Date(),
                    instagramTokenExpiresIn: expiresIn
                }
            });

            console.log('✅ Instagram Direct Login Successful:', {
                userId: meData.id,
                username: meData.username,
                accountType: meData.account_type
            });

            return NextResponse.json({
                success: true,
                message: 'Instagram connected successfully',
                data: {
                    instagramId: meData.id,
                    username: meData.username,
                    name: meData.name,
                    accountType: meData.account_type
                }
            });

        } catch (error: any) {
            console.error('Instagram Direct Login Error:', error);
            return NextResponse.json(
                { message: error.message || 'Failed to authenticate with Instagram' },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('Error in Instagram direct login:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
