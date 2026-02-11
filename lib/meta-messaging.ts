import { prisma } from "./prisma";

const META_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaConversation {
    id: string;
    snippet: string;
    updated_time: string;
    participants: {
        data: {
            name: string;
            id: string;
            picture?: {
                data: {
                    url: string;
                }
            }
        }[]
    };
    unread_count: number;
    platform: 'FACEBOOK' | 'INSTAGRAM';
}

export interface MetaMessage {
    id: string;
    message: string;
    from: { name: string; id: string };
    created_time: string;
}

export async function fetchUnifiedConversations(pageId: string, pageAccessToken: string, instagramId?: string) {
    const platforms = ['messenger', 'instagram'];
    const fetchPromises = platforms.map(async (platform) => {
        let url = `${BASE_URL}/${pageId}/conversations?platform=${platform}&fields=id,snippet,updated_time,participants{name,id,picture},unread_count&access_token=${pageAccessToken}`;

        // Experiment: For Instagram, sometimes folder=inbox helps
        if (platform === 'instagram') {
            url += '&folder=inbox';
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error(`[Meta API] Error fetching ${platform} conversations for Page ${pageId}:`, JSON.stringify(data.error, null, 2));

            // If Page-level fetch failed for Instagram, and we have an instagramId, try the direct IG ID endpoint as fallback
            if (platform === 'instagram' && instagramId) {
                console.log(`[Meta API] Attempting alternate Instagram fetch using IG ID: ${instagramId}`);
                const alternateUrl = `${BASE_URL}/${instagramId}/conversations?fields=id,snippet,updated_time,participants{name,id,picture},unread_count&access_token=${pageAccessToken}`;
                try {
                    const altRes = await fetch(alternateUrl);
                    const altData = await altRes.json();
                    if (!altData.error) {
                        console.log(`[Meta API] Alternate fetch SUCCESS for IG ID ${instagramId}`);
                        return (altData.data || []).map((conv: any) => ({
                            ...conv,
                            platform: 'INSTAGRAM'
                        }));
                    } else {
                        console.error(`[Meta API] Alternate fetch FAILED for IG ID ${instagramId}:`, JSON.stringify(altData.error, null, 2));
                    }
                } catch (e) {
                    console.error(`[Meta API] Alternate fetch CRASHED for IG ID ${instagramId}:`, e);
                }
            }

            return [];
        }

        let results = data.data || [];

        // Special Case: If Instagram returned 0, try without folder=inbox as a last resort at Page level
        if (platform === 'instagram' && results.length === 0 && url.includes('folder=inbox')) {
            const retryUrl = url.replace('&folder=inbox', '');
            console.log(`[Meta API] Instagram inbox empty, retrying WITHOUT folder=inbox...`);
            try {
                const retryRes = await fetch(retryUrl);
                const retryData = await retryRes.json();
                if (!retryData.error && retryData.data?.length > 0) {
                    console.log(`[Meta API] Instagram retry SUCCESS: found ${retryData.data.length} conversations.`);
                    results = retryData.data;
                }
            } catch (e) {
                console.error(`[Meta API] Instagram retry failed:`, e);
            }
        }

        const count = results.length;
        if (platform === 'instagram' && count === 0) {
            console.log(`[Meta API] Instagram data payload was EMPTY:`, JSON.stringify(data, null, 2));
            console.log(`[Meta API] Used URL: ${url.replace(pageAccessToken, 'HIDDEN_TOKEN')}`);
        } else if (platform === 'instagram') {
            console.log(`[Meta API] Successfully fetched ${count} Instagram conversations.`);
        }

        return results.map((conv: any) => ({
            ...conv,
            platform: platform === 'messenger' ? 'FACEBOOK' : 'INSTAGRAM'
        }));
    });

    const results = await Promise.all(fetchPromises);
    const unified = results.flat().sort((a, b) =>
        new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime()
    );

    return unified;
}

export async function fetchConversationMessages(conversationId: string, pageAccessToken: string, after?: string) {
    let url = `${BASE_URL}/${conversationId}?fields=messages{message,from,created_time}&access_token=${pageAccessToken}`;
    if (after) {
        url = `${BASE_URL}/${conversationId}/messages?fields=message,from,created_time&limit=20&after=${after}&access_token=${pageAccessToken}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    // If it's the initial fetch of the conversation object
    if (data.messages) {
        return {
            messages: data.messages.data || [],
            paging: data.messages.paging
        };
    }

    // If it's a paginated fetch of the messages edge
    return {
        messages: data.data || [],
        paging: data.paging
    };
}

export async function sendMetaMessage(recipientId: string, messageText: string, pageAccessToken: string) {
    const url = `${BASE_URL}/me/messages?access_token=${pageAccessToken}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: messageText },
        }),
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message);
    }

    return data;
}

export function isWithin24HourWindow(lastMessageTime: string): boolean {
    const lastTime = new Date(lastMessageTime).getTime();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (now - lastTime) <= twentyFourHours;
}
