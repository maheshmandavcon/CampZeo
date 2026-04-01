import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

import { withErrorHandling } from '@/lib/api-handler';
async function getHandler() {

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let targetUserId = user.id;
        const impersonatedOrgId = await getImpersonatedOrganisationId();

        if (impersonatedOrgId) {
            const orgUser = await prisma.user.findFirst({
                where: { organisationId: impersonatedOrgId }
            });
            if (orgUser) {
                targetUserId = orgUser.clerkId;
            }
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: targetUserId },
        });

        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const status: any = {};

        // Helper to fetch with timeout
        const fetchWithTimeout = async (url: string, options: any = {}, timeout = 3000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(id);
                return response;
            } catch (error) {
                clearTimeout(id);
                throw error;
            }
        };

        // Facebook & Instagram Shared Helper for Status
        const getFacebookStatus = async (accessToken: string, pageId?: string | null, isInstagram = false) => {
            try {
                // Remove hardcoded version to use default/app-approved version
                const baseUrl = "https://graph.facebook.com";

                // Try 1: Fetch by ID (if page) or /me
                const endpoint = pageId && !isInstagram ? `${baseUrl}/${pageId}?fields=name` : `${baseUrl}/me?fields=name`;
                let res = await fetchWithTimeout(`${endpoint}&access_token=${accessToken}`);

                if (res.ok) {
                    const data = await res.json();
                    return { connected: true, name: data.name || "Connected" };
                }

                // Try 2: If we had a pageId and it failed, try /me (sometimes tokens work differently)
                if (pageId && !isInstagram) {
                    res = await fetchWithTimeout(`${baseUrl}/me?fields=name&access_token=${accessToken}`);
                    if (res.ok) {
                        const data = await res.json();
                        return { connected: true, name: data.name || "Connected" };
                    }
                }

                // Capture Error details if all attempts failed
                const errorData = await res.json().catch(() => ({}));
                console.error(`[Social Status] Facebook API Error (${isInstagram ? 'IG' : 'FB'}):`, errorData);

                const errorCode = errorData.error?.code;
                const errorMsg = errorData.error?.message || "Unknown Error";

                if (errorCode === 190) {
                    return { connected: false, error: "Session Expired", details: errorMsg };
                }

                // For other errors, return descriptive status so user understands why name is missing
                return {
                    connected: true,
                    name: `Connected (Error: ${errorMsg.length > 25 ? errorMsg.substring(0, 25) + "..." : errorMsg})`,
                    error: errorMsg,
                    details: errorData
                };
            } catch (e: any) {
                console.error(`[Social Status] Connection Error (${isInstagram ? 'IG' : 'FB'}):`, e);
                return { connected: true, name: "Connected (Network Error)", error: e.message };
            }
        };

        // Facebook
        if (dbUser.facebookAccessToken || dbUser.facebookPageAccessToken) {
            let fbStatus: any = { connected: true, pageId: dbUser.facebookPageId };
            let hasError = false;

            if (dbUser.facebookAccessToken) {
                const userStatus = await getFacebookStatus(dbUser.facebookAccessToken);
                if (userStatus.connected && !userStatus.error) {
                    fbStatus.userName = userStatus.name;
                    fbStatus.name = userStatus.name; 
                } else if (userStatus.error) {
                    fbStatus.error = userStatus.error;
                    hasError = true;
                }
            }

            if (dbUser.facebookPageAccessToken && dbUser.facebookPageId) {
                const pageStatus = await getFacebookStatus(dbUser.facebookPageAccessToken, dbUser.facebookPageId);
                if (pageStatus.connected && !pageStatus.error) {
                    fbStatus.pageName = pageStatus.name;
                }
            }

            // Error formatting
            if (fbStatus.error === "Session Expired") {
                fbStatus.name = "Session Expired (Re-connect)";
                fbStatus.userName = "Session Expired";
                fbStatus.pageName = "Session Expired";
            } else if (!fbStatus.userName && !hasError) {
                fbStatus.name = "Connection Restricted";
            }

            status.facebook = fbStatus;
        } else {
            status.facebook = { connected: false };
        }

        if (dbUser.instagramAccessToken && dbUser.instagramUserId) {
            const connectionType = dbUser?.instagramConnectionType;

            if (connectionType === 'DIRECT') {
                try {
                    const res = await fetchWithTimeout(
                        `https://graph.instagram.com/v18.0/me?fields=username,name&access_token=${dbUser.instagramAccessToken}`
                    );
                    if (res.ok) {
                        const data = await res.json();
                        const displayName = data.username ? `@${data.username}` : data.name || "Connected";
                        status.instagram = { connected: true, name: displayName, username: data.username };
                    } else {
                        const errorData = await res.json().catch(() => ({}));
                        console.error("[Social Status] Instagram Direct fetch error:", errorData);
                        if (errorData.error?.code === 190 || errorData.error?.type === 'OAuthException') {
                            status.instagram = { connected: false, error: "Session Expired" };
                        } else {
                            status.instagram = { connected: true, name: "Connected" };
                        }
                    }
                } catch (e) {
                    console.error("[Social Status] Instagram Direct error:", e);
                    status.instagram = { connected: true, name: "Connected" };
                }
            } else {
                // Check if we need to try and heal a "no-business-account" state
                if (dbUser.instagramUserId === 'no-business-account') {
                    let healed = false;
                    try {
                        console.log("[Social Status] Attempting to heal Instagram 'no-business-account' state...");
                        const pagesRes = await fetchWithTimeout(
                            `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${dbUser.instagramAccessToken}`
                        );

                        if (pagesRes.ok) {
                            const pagesData = await pagesRes.json();
                            if (pagesData.data && Array.isArray(pagesData.data)) {
                                for (const page of pagesData.data) {
                                    if (page.instagram_business_account?.id) {
                                        const businessId = page.instagram_business_account.id;
                                        const pageToken = page.access_token;
                                        const username = page.instagram_business_account.username;

                                        await prisma.user.update({
                                            where: { clerkId: targetUserId },
                                            data: {
                                                instagramUserId: businessId,
                                                instagramAccessToken: pageToken,
                                                instagramConnectionType: 'FACEBOOK'
                                            }
                                        });

                                        status.instagram = { connected: true, name: username ? `@${username}` : page.instagram_business_account.name || "Connected" };
                                        healed = true;
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (healError) {
                        console.error("[Social Status] Heal attempt failed:", healError);
                    }

                    if (!healed) {
                        status.instagram = { connected: true, name: "No Business Account Linked" };
                    }
                } else {
                    // Normal Facebook-based fetching
                    try {
                        const res = await fetchWithTimeout(
                            `https://graph.facebook.com/v18.0/${dbUser.instagramUserId}?fields=username,name&access_token=${dbUser.instagramAccessToken}`
                        );
                        if (res.ok) {
                            const data = await res.json();
                            const displayName = data.username ? `@${data.username}` : data.name || "Connected";
                            status.instagram = { connected: true, name: displayName, username: data.username };
                        } else {
                            const errorData = await res.json().catch(() => ({}));
                            console.error("[Social Status] Instagram Business fetch error:", errorData);
                            if (errorData.error?.code === 190) {
                                status.instagram = { connected: false, error: "Session Expired" };
                            } else {
                                status.instagram = { connected: true, name: "Connected" };
                            }
                        }
                    } catch (e) {
                        console.error("[Social Status] Instagram Business error:", e);
                        status.instagram = { connected: true, name: "Connected" };
                    }
                }
            }
        } else if (dbUser.instagramAccessToken) {
            // Has token but no userId (Legacy state)
            status.instagram = { connected: true, name: "Connected (Legacy)" };
        } else {
            status.instagram = { connected: false };
        }

        // LinkedIn
        if (dbUser.linkedInAccessToken) {
            try {
                let name = "Connected";
                let followerCount: number | null = null;
                let urn = dbUser.linkedInAuthUrn;
                const token = dbUser.linkedInAccessToken;

                if (urn && urn.startsWith("urn:li:organization:")) {
                    const orgId = urn.split(":").pop();
                    const res = await fetchWithTimeout(`https://api.linkedin.com/v2/organizations/${orgId}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "X-Restli-Protocol-Version": "2.0.0"
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        name = data.localizedName;
                    }

                    // Fetch followers
                    try {
                        const followersRes = await fetchWithTimeout(`https://api.linkedin.com/v2/networkSizes/${urn}?edgeType=CompanyFollowedByMember`, {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "X-Restli-Protocol-Version": "2.0.0"
                            }
                        });
                        if (followersRes.ok) {
                            const followersData = await followersRes.json();
                            followerCount = followersData.firstDegreeSize;
                        }
                    } catch (e) {
                        console.error("Error fetching followers", e);
                    }
                } else {
                    // Default to profile
                    const res = await fetchWithTimeout(`https://api.linkedin.com/v2/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const firstName = data.localizedFirstName;
                        const lastName = data.localizedLastName;
                        name = `${firstName} ${lastName}`;

                        // Auto-fix URN if missing/incorrect
                        if (data.id) {
                            const correctUrn = `urn:li:person:${data.id}`;
                            if (urn !== correctUrn) {
                                try {
                                    await prisma.user.update({
                                        where: { id: dbUser.id },
                                        data: { linkedInAuthUrn: correctUrn }
                                    });
                                    urn = correctUrn; // Update local variable so response is correct
                                    console.log(`[Social Status] Auto-fixed LinkedIn URN for user ${dbUser.id} to ${correctUrn}`);
                                } catch (updateErr) {
                                    console.error("[Social Status] Failed to auto-fix LinkedIn URN", updateErr);
                                }
                            }
                        }
                    }
                }

                // [NEW] Check if this user has any associated organizations (Company Pages)
                let organizations: any[] = [];
                try {
                    const aclsRes = await fetchWithTimeout("https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "X-Restli-Protocol-Version": "2.0.0"
                        }
                    });

                    if (aclsRes.ok) {
                        const aclsData = await aclsRes.json();
                        if (aclsData.elements && aclsData.elements.length > 0) {
                            for (const element of aclsData.elements) {
                                const orgUrn = element.organizationalTarget;
                                const orgId = orgUrn.split(":").pop();

                                // Get org details (briefly)
                                const orgRes = await fetchWithTimeout(`https://api.linkedin.com/v2/organizations/${orgId}`, {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        "X-Restli-Protocol-Version": "2.0.0"
                                    }
                                });
                                if (orgRes.ok) {
                                    const orgData = await orgRes.json();
                                    organizations.push({
                                        id: orgUrn,
                                        name: orgData.localizedName
                                    });
                                }
                            }
                        }
                    }
                } catch (orgError) {
                    console.error("[Social Status] LinkedIn Organization Fetch Error:", orgError);
                }

                status.linkedin = {
                    connected: true,
                    name,
                    followerCount,
                    hasOrganizations: organizations.length > 0,
                    organizations: organizations,
                    urn: urn
                };
            } catch (e) {
                status.linkedin = { connected: true, name: "Connected" };
            }
        } else {
            status.linkedin = { connected: false };
        }

        // YouTube
        if (dbUser.youtubeAccessToken) {
            try {
                let res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, {
                    headers: { Authorization: `Bearer ${dbUser.youtubeAccessToken}` }
                });

                // If unauthorized, attempt one-time refresh
                if (res.status === 401 && dbUser.youtubeAuthUrn) {
                    console.log(`[Social Status] YouTube token expired for ${targetUserId}, attempting refresh...`);
                    const { refreshUserTokens } = await import("@/lib/social-refresh");
                    const refreshResult = await refreshUserTokens(targetUserId);

                    if (refreshResult.success && refreshResult.results.youtube.refreshed) {
                        // Retry the request with new token
                        const refreshedUser = await prisma.user.findUnique({ where: { clerkId: targetUserId } });
                        if (refreshedUser?.youtubeAccessToken) {
                            res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, {
                                headers: { Authorization: `Bearer ${refreshedUser.youtubeAccessToken}` }
                            });
                        }
                    }
                }

                if (res.ok) {
                    const data = await res.json();
                    const title = data.items?.[0]?.snippet?.title;
                    status.youtube = { connected: true, name: title || "Connected" };
                } else {
                    status.youtube = { connected: true, name: "Connected (Session Expired)" };
                }
            } catch (e) {
                status.youtube = { connected: true, name: "Connected" };
            }
        } else {
            status.youtube = { connected: false };
        }

        // Pinterest
        if (dbUser.pinterestAccessToken) {
            try {
                // Use Production API
                let res = await fetchWithTimeout(`https://api.pinterest.com/v5/user_account`, {
                    headers: { Authorization: `Bearer ${dbUser.pinterestAccessToken}` }
                });

                // If unauthorized, attempt one-time refresh
                if (res.status === 401 && dbUser.pinterestAuthUrn) {
                    console.log(`[Social Status] Pinterest token expired for ${targetUserId}, attempting refresh...`);
                    const { refreshUserTokens } = await import("@/lib/social-refresh");
                    const refreshResult = await refreshUserTokens(targetUserId);

                    if (refreshResult.success && refreshResult.results.pinterest.refreshed) {
                        // Retry the request with new token
                        const refreshedUser = await prisma.user.findUnique({ where: { clerkId: targetUserId } });
                        if (refreshedUser?.pinterestAccessToken) {
                            res = await fetchWithTimeout(`https://api.pinterest.com/v5/user_account`, {
                                headers: { Authorization: `Bearer ${refreshedUser.pinterestAccessToken}` }
                            });
                        }
                    }
                }

                if (res.ok) {
                    const data = await res.json();
                    status.pinterest = { connected: true, name: data.username };
                } else {
                    status.pinterest = { connected: true, name: "Connected (Session Expired)" };
                }
            } catch (e) {
                status.pinterest = { connected: true, name: "Connected" };
            }
        } else {
            status.pinterest = { connected: false };
        }

        return NextResponse.json(status);
    
}

export const GET = withErrorHandling(getHandler, "GET /api/user/social-status");
