/**
 * Utility for Meta Boost URL construction and ID parsing
 */

export function parseMetaPostId(fbPostId: string): string {
    if (!fbPostId) return '';

    // Extract the numeric post ID if it's in PAGEID_POSTID format or a URL
    let targetId = fbPostId;
    if (fbPostId.includes('_')) {
        // PAGEID_POSTID format
        targetId = fbPostId.split('_')[1];
    } else if (fbPostId.includes('/posts/')) {
        // URL format: https://www.facebook.com/page/posts/123456789/
        const match = fbPostId.match(/\/posts\/(\d+)/);
        if (match) targetId = match[1];
    } else if (fbPostId.includes('fbid=')) {
        // Alternative URL format: ...?fbid=123456789...
        const match = fbPostId.match(/fbid=(\d+)/);
        if (match) targetId = match[1];
    }

    return targetId;
}

export function getNativeBoostUrl(adAccountId: string, pageId: string, fbPostId: string): string {
    const cleanAdAccountId = adAccountId.replace('act_', '');
    const targetId = parseMetaPostId(fbPostId);

    return `https://www.facebook.com/ad_center/create/boostpost/?ad_account_id=${cleanAdAccountId}&page_id=${pageId}&target_id=${targetId}&entry_point=partner_campzeo`;
}

export function openNativeBoostPopup(adAccountId: string, pageId: string, fbPostId: string) {
    const url = getNativeBoostUrl(adAccountId, pageId, fbPostId);

    // Open in a centered popup
    const width = 1000;
    const height = 800;
    const left = (typeof window !== 'undefined' ? window.innerWidth : 1200 - width) / 2;
    const top = (typeof window !== 'undefined' ? window.innerHeight : 800 - height) / 2;

    if (typeof window !== 'undefined') {
        return window.open(url, 'fbBoost', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
    }
}
