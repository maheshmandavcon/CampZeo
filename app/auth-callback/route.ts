import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const META_API_VERSION = 'v24.0';

export async function GET(request: NextRequest) {
    let platform = "unknown";
    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
            return NextResponse.redirect(new URL(`/auth-complete?status=error&error=${error}`, request.url));
        }

        if (!code || !state) {
            return NextResponse.redirect(new URL("/auth-complete?status=error&error=missing_params", request.url));
        }

        const stateParts = state.split("_");
        const userIndex = stateParts.findIndex(p => p === "user");
        
        let stateUserId = "";
        if (userIndex !== -1) {
            platform = stateParts.slice(0, userIndex).join("_");
            stateUserId = stateParts.slice(userIndex).join("_");
        } else {
            platform = stateParts[0];
            stateUserId = state.substring(platform.length + 1);
        }

        console.log("🔵 OAuth Callback Received:", {
            platform,
            stateUserId: stateUserId?.substring(0, 10) + "...",
            hasCode: !!code,
        });

        if (!stateUserId) {
            console.error("❌ No user ID in state parameter");
            return NextResponse.redirect(new URL(`/auth-complete?status=error&error=invalid_state&platform=${platform}`, request.url));
        }

        let user = await prisma.user.findUnique({
            where: { clerkId: stateUserId }
        });

        if (!user) {
            console.log("⚠️  User not found in database, fetching from Clerk and creating...");

            try {
                const { clerkClient } = await import("@clerk/nextjs/server");
                const client = await clerkClient();
                const clerkUser = await client.users.getUser(stateUserId);

                if (!clerkUser) {
                    console.error("❌ User not found in Clerk either:", { stateUserId });
                    return NextResponse.redirect(new URL(`/auth-complete?status=error&error=user_not_found&platform=${platform}`, request.url));
                }

                user = await prisma.user.create({
                    data: {
                        clerkId: stateUserId,
                        email: clerkUser.emailAddresses[0]?.emailAddress || "",
                        firstName: clerkUser.firstName,
                        lastName: clerkUser.lastName,
                        role: "ORGANISATION_USER",
                    },
                });

                console.log(" User created in database:", { email: user.email });
            } catch (createError: any) {
                console.error(" Failed to create user:", createError);
                return NextResponse.redirect(new URL(`/auth-complete?status=error&error=user_creation_failed&platform=${platform}`, request.url));
            }
        }

        console.log(" User verified:", { email: user.email });

        const isDirect = platform === 'INSTAGRAM_DIRECT' || platform === 'INSTAGRAM_BASIC';
        const clientIdConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key: isDirect ? 'INSTAGRAM_DIRECT_ID' : `${platform}_CLIENT_ID` }
        });
        const clientSecretConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key: isDirect ? 'INSTAGRAM_DIRECT_SECRET' : `${platform}_CLIENT_SECRET` }
        });
        const redirectUriConfig = await prisma.adminPlatformConfiguration.findFirst({
            where: { key: isDirect ? 'INSTAGRAM_DIRECT_REDIRECT_URI' : `${platform}_REDIRECT_URI` }
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const isLocal = appUrl.includes('localhost');
        const redirectUri = (isLocal ? null : redirectUriConfig?.value) || `${appUrl}/auth-callback`;

        const clientId = clientIdConfig?.value || process.env.INSTAGRAM_DIRECT_ID;
        const clientSecret = clientSecretConfig?.value || process.env.INSTAGRAM_DIRECT_SECRET;

        if (!clientId || !clientSecret) {
            return NextResponse.redirect(new URL(`/auth-complete?status=error&error=config_missing&platform=${platform}`, request.url));
        }

        let accessToken = "";
        let refreshToken = "";
        let expiresIn = 0;

        // Exchange code for token
        if (platform === "FACEBOOK" || platform === "INSTAGRAM") {
            const tokenUrl = `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`;
            
            const res = await fetch(tokenUrl);
            const data = await res.json();
            if (data.error) throw new Error(data.error.message || data.error);
            accessToken = data.access_token;
            expiresIn = data.expires_in;
        } else if (platform === "INSTAGRAM_DIRECT" || platform === "INSTAGRAM_BASIC") {
            const tokenUrl = "https://api.instagram.com/oauth/access_token";
            const params = new URLSearchParams();
            params.append("client_id", clientId);
            params.append("client_secret", clientSecret);
            params.append("grant_type", "authorization_code");
            params.append("redirect_uri", redirectUri);
            params.append("code", code);

            const res = await fetch(tokenUrl, {
                method: "POST",
                body: params,
            });
            const data = await res.json();
            
            if (data.error || data.error_message) throw new Error(data.error_message || data.error || "Token exchange failed");
            
            const shortLivedToken = data.access_token;
            
            try {
                const longLivedRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortLivedToken}`);
                const longLivedData = await longLivedRes.json();
                
                if (longLivedData.access_token) {
                    accessToken = longLivedData.access_token;
                    expiresIn = longLivedData.expires_in || 5184000; 
                    console.log(" Instagram Long-Lived Token obtained");
                } else {
                    accessToken = shortLivedToken;
                    expiresIn = 3600;
                    console.warn(" Failed to obtain Instagram Long-Lived Token, using short-lived.");
                }
            } catch (exchangeError) {
                console.error(" Error exchanging Instagram token:", exchangeError);
                accessToken = shortLivedToken;
                expiresIn = 3600;
            }
        } else if (platform === "LINKEDIN") {
            const tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
            const params = new URLSearchParams();
            params.append("grant_type", "authorization_code");
            params.append("code", code);
            params.append("redirect_uri", redirectUri);
            params.append("client_id", clientId);
            params.append("client_secret", clientSecret);

            const res = await fetch(tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params,
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error_description);
            accessToken = data.access_token;
            expiresIn = data.expires_in;
        } else if (platform === "YOUTUBE") {
            const tokenUrl = "https://oauth2.googleapis.com/token";
            const params = new URLSearchParams();
            params.append("code", code);
            params.append("client_id", clientId);
            params.append("client_secret", clientSecret);
            params.append("redirect_uri", redirectUri);
            params.append("grant_type", "authorization_code");

            console.log("🔵 YouTube Token Exchange - Request:", {
                tokenUrl,
                redirectUri,
                clientId: clientId.substring(0, 10) + "...",
            });

            const res = await fetch(tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params,
            });
            const data = await res.json();

            console.log("🔵 YouTube Token Exchange - Response:", {
                hasAccessToken: !!data.access_token,
                hasRefreshToken: !!data.refresh_token,
                expiresIn: data.expires_in,
                error: data.error,
            });

            if (data.error) throw new Error(data.error_description || data.error);
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            expiresIn = data.expires_in;
        } else if (platform === "PINTEREST") {
            // Pinterest token exchange
            // POST https://api.pinterest.com/v5/oauth/token
            // Authorization: Basic <base64(client_id:client_secret)>
            // grant_type=authorization_code&code=...&redirect_uri=...
            const tokenUrl = "https://api.pinterest.com/v5/oauth/token";
            const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const params = new URLSearchParams();
            params.append("grant_type", "authorization_code");
            params.append("code", code);
            params.append("redirect_uri", redirectUri);

            const res = await fetch(tokenUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Basic ${authHeader}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params,
            });
            const data = await res.json();
            if (data.error) throw new Error(data.message);
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            expiresIn = data.expires_in;
        }

        // Save to DB
        const updateData: any = {};
        if (platform === "FACEBOOK") {
            updateData.facebookAccessToken = accessToken;
            updateData.facebookTokenExpiresIn = expiresIn;
            updateData.facebookTokenCreatedAt = new Date();

            // Fetch Facebook Pages and Page Access Token
            try {
                // First, get user's pages with instagram_business_account
                const pagesRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`);
                const pagesData = await pagesRes.json();

                console.log("🔵 Facebook Pages Response:", pagesData);

                if (pagesData.data && pagesData.data.length > 0) {
                    // Use the first page (you can later let users select which page)
                    const firstPage = pagesData.data[0];

                    updateData.facebookPageId = firstPage.id;
                    updateData.facebookPageAccessToken = firstPage.access_token; // Page-specific token
                    updateData.facebookUserId = firstPage.id; // Store page ID here too

                    if (firstPage.instagram_business_account) {
                        updateData.instagramUserId = firstPage.instagram_business_account.id;
                        updateData.instagramAccessToken = firstPage.access_token;
                        updateData.instagramTokenCreatedAt = new Date();
                        updateData.instagramTokenExpiresIn = expiresIn;
                        console.log("✅ Instagram Business Account linked automatically via Facebook connection:", firstPage.instagram_business_account.id);
                    }

                    console.log("✅ Facebook Page Connected:", {
                        pageId: firstPage.id,
                        pageName: firstPage.name,
                        hasPageToken: !!firstPage.access_token
                    });
                } else {
                    console.warn("⚠️  No Facebook Pages found for this user");
                    // Still save the user token, but warn that no pages are available
                    updateData.facebookUserId = "no-pages";
                }
            } catch (e) {
                console.error("❌ Failed to fetch Facebook Pages:", e);
            }
        } else if (platform === "INSTAGRAM") {
            // For Instagram Business/Creator accounts (via Facebook Graph API)
            // We need to find the Instagram Business Account connected to a Facebook Page

            try {
                // Fetch user's pages with connected Instagram accounts
                // Handle pagination to ensure we check ALL pages
                let allPages: any[] = [];
                let nextUrl = `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}&limit=100`;

                while (nextUrl) {
                    const pagesRes = await fetch(nextUrl);
                    const pagesData = await pagesRes.json();

                    if (pagesData.data) {
                        allPages = [...allPages, ...pagesData.data];
                    }

                    nextUrl = pagesData.paging?.next || null;
                }

                console.log(`🔵 Instagram/Facebook Pages Fetched: ${allPages.length}`);

                let instagramAccountFound = false;

                if (allPages.length > 0) {
                    // Method 1: Check if instagram_business_account is directly returned
                    for (const page of allPages) {
                        if (page.instagram_business_account) {
                            updateData.instagramUserId = page.instagram_business_account.id;
                            updateData.instagramAccessToken = page.access_token; // Use Page Token for existing/legacy logic

                            // Also set Facebook Page fields so the unified inbox can find the connection
                            updateData.facebookPageId = page.id;
                            updateData.facebookPageAccessToken = page.access_token;

                            updateData.instagramTokenExpiresIn = expiresIn;
                            updateData.instagramTokenCreatedAt = new Date();

                            console.log("✅ Instagram Business Account Connected:", {
                                instagramId: page.instagram_business_account.id,
                                instagramUsername: page.instagram_business_account.username,
                                pageId: page.id,
                                pageName: page.name
                            });

                            instagramAccountFound = true;
                            // Prefer the first found, or logic could be improved to pick a specific one? 
                            // For now, first found is standard behavior.
                            break;
                        }
                    }

                    // Method 2: Fallback - Explicitly query each page if Method 1 missed it (rare but possible with permissions)
                    if (!instagramAccountFound) {
                        console.log("⚠️ Method 1 failed. Trying Method 2 (Explicit Page Query)...");

                        for (const page of allPages) {
                            try {
                                const igRes = await fetch(
                                    `https://graph.facebook.com/${META_API_VERSION}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`
                                );
                                const igData = await igRes.json();

                                if (igData.instagram_business_account) {
                                    updateData.instagramUserId = igData.instagram_business_account.id;
                                    updateData.instagramAccessToken = page.access_token;
                                    updateData.instagramTokenExpiresIn = expiresIn;
                                    updateData.instagramTokenCreatedAt = new Date();

                                    console.log("✅ Instagram Business Account Connected (Method 2):", {
                                        instagramId: igData.instagram_business_account.id,
                                        instagramUsername: igData.instagram_business_account.username,
                                        pageId: page.id
                                    });

                                    instagramAccountFound = true;
                                    break;
                                }
                            } catch (altError) {
                                console.error(`  ❌ Method 2 failed for page ${page.id}:`, altError);
                            }
                        }
                    }
                } else {
                    console.warn("⚠️ No Facebook Pages found for this user");
                }

                if (!instagramAccountFound) {
                    console.warn("⚠️ No Instagram Business Account found connected to any Facebook Page");

                    // Fallback: Set to 'no-business-account' so UI knows
                    updateData.instagramAccessToken = accessToken;
                    updateData.instagramUserId = "no-business-account";

                    // Redirect with stricter error if preferred, or allow 'connected' state with warning
                    // return NextResponse.redirect(new URL("/organisation/settings?error=no_business_account_found", request.url));
                }

            } catch (e) {
                console.error("❌ Failed to fetch Instagram Business Account:", e);
                updateData.instagramAccessToken = accessToken;
                updateData.instagramUserId = "no-business-account";
            }
        } else if (platform === "INSTAGRAM_DIRECT" || platform === "INSTAGRAM_BASIC") {
            // New Instagram Login Product (v18.0+)
            updateData.instagramAccessToken = accessToken;
            updateData.instagramTokenExpiresIn = expiresIn;
            updateData.instagramTokenCreatedAt = new Date();

            try {
                // Fetch the Instagram account details directly
                const meRes = await fetch(`https://graph.instagram.com/v18.0/me?fields=id,username,name&access_token=${accessToken}`);
                const meData = await meRes.json();
                
                if (meData.id) {
                    updateData.instagramUserId = meData.id;
                    console.log("✅ Instagram Direct (Business Login) Connected:", {
                        instagramId: meData.id,
                        username: meData.username
                    });
                }
            } catch (e) {
                console.error("❌ Failed to fetch Instagram Direct profile:", e);
            }
        } else if (platform === "LINKEDIN") {
            updateData.linkedInAccessToken = accessToken;
            // LinkedIn tokens are usually 60 days

            // Fetch LinkedIn Member ID (URN)
            try {
                const profileRes = await fetch("https://api.linkedin.com/v2/me", {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const profileData = await profileRes.json();
                if (profileData.id) {
                    updateData.linkedInAuthUrn = profileData.id;
                }
            } catch (e) {
                console.error("Failed to fetch LinkedIn Profile", e);
            }
        } else if (platform === "YOUTUBE") {
            updateData.youtubeAccessToken = accessToken;
            // Store refresh token in youtubeAuthUrn field for token refresh capability
            if (refreshToken) {
                updateData.youtubeAuthUrn = refreshToken;
            }
            console.log("🔵 YouTube Update Data:", {
                hasAccessToken: !!updateData.youtubeAccessToken,
                hasRefreshToken: !!updateData.youtubeAuthUrn,
                accessTokenLength: updateData.youtubeAccessToken?.length,
            });
        } else if (platform === "PINTEREST") {
            updateData.pinterestAccessToken = accessToken;
            // Store refresh token if available
            if (refreshToken) {
                updateData.pinterestAuthUrn = refreshToken;
            }
        }


        console.log("🔵 Updating user:", {
            clerkId: stateUserId,
            platform,
            updateFields: Object.keys(updateData),
        });

        const updatedUser = await prisma.user.update({
            where: { clerkId: stateUserId },
            data: updateData,
        });

        console.log("🔵 User updated successfully:", {
            platform,
            youtubeAccessToken: updatedUser.youtubeAccessToken ? "SET" : "NULL",
            youtubeAuthUrn: updatedUser.youtubeAuthUrn ? "SET" : "NULL",
        });

        return NextResponse.redirect(new URL(`/auth-complete?status=success&platform=${platform}`, request.url));
    } catch (error: any) {
        console.error("❌ Error in callback:", error);
        return NextResponse.redirect(new URL(`/auth-complete?status=error&error=${encodeURIComponent(error.message || 'connection_failed')}&platform=${platform}`, request.url));
    }
}
