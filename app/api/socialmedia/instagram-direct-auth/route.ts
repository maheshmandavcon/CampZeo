import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * Instagram Direct Auth Callback
 * Handles Instagram app-based authentication using client ID and secret
 * This is an alternative to Facebook login for direct Instagram app authentication
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { code, platform = 'INSTAGRAM_DIRECT' } = await request.json();

        if (!code) {
            return NextResponse.json(
                { message: 'Authorization code is required' },
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
                { message: 'Instagram Direct authentication not configured' },
                { status: 400 }
            );
        }

        try {
            // Exchange auth code for access token
            const tokenResponse = await fetch(
                'https://api.instagram.com/oauth/access_token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: directIdConfig.value,
                        client_secret: directSecretConfig.value,
                        code: code,
                        grant_type: 'authorization_code'
                    }).toString()
                }
            );

            const tokenData = await tokenResponse.json();

            if (!tokenResponse.ok) {
                console.error('Instagram token exchange error:', tokenData);
                return NextResponse.json(
                    { message: 'Failed to exchange authorization code' },
                    { status: 401 }
                );
            }

            const accessToken = tokenData.access_token;
            const userId_ig = tokenData.user_id;

            // Fetch user details using the access token
            const userResponse = await fetch(
                `https://graph.instagram.com/me?fields=id,username,name,ig_id&access_token=${accessToken}`
            );

            const userData = await userResponse.json();

            if (!userResponse.ok) {
                console.error('Failed to fetch Instagram user data:', userData);
                return NextResponse.json(
                    { message: 'Failed to fetch Instagram profile' },
                    { status: 400 }
                );
            }

            // Save credentials to database
            const user = await prisma.user.findUnique({
                where: { clerkId: userId }
            });

            if (!user) {
                return NextResponse.json(
                    { message: 'User not found' },
                    { status: 404 }
                );
            }

            await prisma.user.update({
                where: { clerkId: userId },
                data: {
                    instagramAccessToken: accessToken,
                    instagramUserId: userData.id || userId_ig,
                    instagramTokenCreatedAt: new Date(),
                    instagramTokenExpiresIn: tokenData.expires_in || 5184000
                }
            });

            console.log('✅ Instagram Direct Auth Successful:', {
                userId: userData.id,
                username: userData.username
            });

            return NextResponse.json({
                success: true,
                message: 'Instagram connected successfully',
                data: {
                    instagramId: userData.id,
                    username: userData.username,
                    name: userData.name
                }
            });

        } catch (error: any) {
            console.error('Instagram Direct Auth Error:', error);
            return NextResponse.json(
                { message: error.message || 'Authentication failed' },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('Error in Instagram direct auth callback:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
