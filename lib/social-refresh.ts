import { prisma } from "./prisma";
import { refreshYouTubeToken } from "./youtube";
import { refreshPinterestToken } from "./pinterest";
import { logError, logInfo } from "./audit-logger";

export async function refreshUserTokens(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId },
        select: {
            clerkId: true,
            youtubeAccessToken: true,
            youtubeAuthUrn: true, // Stores Refresh Token
            pinterestAccessToken: true,
            pinterestAuthUrn: true, // Stores Refresh Token
        }
    });

    if (!user) return { success: false, error: "User not found" };

    const results: any = {
        youtube: { refreshed: false },
        pinterest: { refreshed: false }
    };

    // 1. YouTube Refresh
    if (user.youtubeAuthUrn) {
        try {
            const clientIdConfig = await prisma.adminPlatformConfiguration.findFirst({
                where: { key: "YOUTUBE_CLIENT_ID" }
            });
            const clientSecretConfig = await prisma.adminPlatformConfiguration.findFirst({
                where: { key: "YOUTUBE_CLIENT_SECRET" }
            });

            if (clientIdConfig?.value && clientSecretConfig?.value) {
                console.log(`[Refresh] Refreshing YouTube token for user: ${clerkId}`);
                const data = await refreshYouTubeToken(
                    user.youtubeAuthUrn,
                    clientIdConfig.value,
                    clientSecretConfig.value
                );

                if (data.access_token) {
                    await prisma.user.update({
                        where: { clerkId },
                        data: {
                            youtubeAccessToken: data.access_token,
                            // Google sometimes rotates refresh tokens
                            youtubeAuthUrn: data.refresh_token || user.youtubeAuthUrn
                        }
                    });
                    results.youtube = { refreshed: true, expires_in: data.expires_in };
                    await logInfo("YouTube token auto-refreshed", { userId: clerkId });
                }
            }
        } catch (error: any) {
            console.error(`[Refresh] YouTube refresh failed for ${clerkId}:`, error.message);
            await logError("YouTube token auto-refresh failed", { userId: clerkId }, error);
            results.youtube = { refreshed: false, error: error.message };
        }
    }

    // 2. Pinterest Refresh
    if (user.pinterestAuthUrn) {
        try {
            const clientIdConfig = await prisma.adminPlatformConfiguration.findFirst({
                where: { key: "PINTEREST_CLIENT_ID" }
            });
            const clientSecretConfig = await prisma.adminPlatformConfiguration.findFirst({
                where: { key: "PINTEREST_CLIENT_SECRET" }
            });

            if (clientIdConfig?.value && clientSecretConfig?.value) {
                console.log(`[Refresh] Refreshing Pinterest token for user: ${clerkId}`);
                const data = await refreshPinterestToken(
                    user.pinterestAuthUrn,
                    clientIdConfig.value,
                    clientSecretConfig.value
                );

                if (data.access_token) {
                    await prisma.user.update({
                        where: { clerkId },
                        data: {
                            pinterestAccessToken: data.access_token,
                            // Pinterest v5 rotates tokens
                            pinterestAuthUrn: data.refresh_token || user.pinterestAuthUrn
                        }
                    });
                    results.pinterest = { refreshed: true, expires_in: data.expires_in };
                    await logInfo("Pinterest token auto-refreshed", { userId: clerkId });
                }
            }
        } catch (error: any) {
            console.error(`[Refresh] Pinterest refresh failed for ${clerkId}:`, error.message);
            await logError("Pinterest token auto-refresh failed", { userId: clerkId }, error);
            results.pinterest = { refreshed: false, error: error.message };
        }
    }

    return { success: true, results };
}
