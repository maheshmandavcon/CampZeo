/**
 * Utility functions for handling media URLs across different environments
 * Defines standard aspect ratios for social media platforms
 */

export const PLATFORM_ASPECT_RATIOS: Record<string, { standard: number; reel?: number; name: string; ratioText: string }> = {
    INSTAGRAM: {
        standard: 1, // 1:1 Square is the most reliable for Feed
        reel: 9 / 16, // 9:16 Vertical
        name: 'Instagram',
        ratioText: '1:1 (Square) or 4:5 (Vertical)'
    },
    FACEBOOK: {
        standard: 1.91 / 1, // 1.91:1 Horizontal
        reel: 9 / 16,
        name: 'Facebook',
        ratioText: '1.91:1 (Horizontal) or 1:1 (Square)'
    },
    LINKEDIN: {
        standard: 1.91 / 1,
        name: 'LinkedIn',
        ratioText: '1.91:1 (Horizontal)'
    },
    YOUTUBE: {
        standard: 16 / 9,
        reel: 9 / 16,
        name: 'YouTube',
        ratioText: '16:9 (Horizontal) or 9:16 (Shorts)'
    },
    PINTEREST: {
        standard: 2 / 3,
        name: 'Pinterest',
        ratioText: '2:3 (Vertical)'
    }
};

/**
 * Gets the target aspect ratio for a given platform
 * @param platform - The platform name
 * @param isReel - Whether it's a Reel/Short
 * @returns Numerical aspect ratio (width/height)
 */
export function getTargetAspectRatio(platform: string | null | undefined, isReel?: boolean): number | null {
    if (!platform) return null;
    const config = PLATFORM_ASPECT_RATIOS[platform.toUpperCase()];
    if (!config) return null;
    return isReel && config.reel ? config.reel : config.standard;
}

/**
 * Converts a relative URL to an absolute public URL
 * @param url - The URL to convert (can be relative or absolute)
 * @returns Absolute public URL
 */
export function getPublicMediaUrl(url: string): string {
    // If already absolute URL, return as is (but ensure it's not a relative-protocol URL)
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // If relative URL, convert to absolute
    // Priority: Explicit App URL -> Vercel Deployment URL -> Localhost (Development)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Remove any accidental multiple slashes
    const cleanPath = url.startsWith('/') ? url : `/${url}`;

    // Facebook/Instagram sometimes fail if fragments are present in the 'url' param
    const urlWithoutFragment = cleanPath.split('#')[0];

    return `${baseUrl}${urlWithoutFragment}`;
}

/**
 * Checks if a URL is a Google Drive URL (standard or optimized CDN)
 */
export function isGoogleDriveUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return url.includes('drive.google.com/uc') ||
        url.includes('googleusercontent.com/d/') ||
        url.includes('/file/d/') ||
        url.includes('/api/upload/google-drive/');
}

/**
 * Extracts a file ID from various Google Drive URL formats
 */
export function extractGoogleDriveId(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        // 1. Check for ?id= parameter (uc?id=...)
        const id = urlObj.searchParams.get('id');
        if (id) return id;

        // 2. Check for /d/ID pattern (lh3.googleusercontent.com/d/ID)
        if (url.includes('googleusercontent.com/d/')) {
            const parts = url.split('/d/')[1]?.split(/[/?=]/);
            if (parts && parts[0]) return parts[0];
        }

        // 3. Check for standard /file/d/ID/view pattern
        if (url.includes('/file/d/')) {
            const parts = url.split('/file/d/')[1]?.split('/');
            if (parts && parts[0]) return parts[0];
        }
    } catch {
        // Fallback for non-standard or malformed URLs (including relative internal paths)
        const ucMatch = url.match(/[?&]id=([^?&]+)/);
        if (ucMatch) return ucMatch[1];

        const dMatch = url.match(/\/d\/([^/?=]+)/);
        if (dMatch) return dMatch[1];
    }
    return null;
}

/**
 * Gets a URL suitable for local frontend preview (bypasses CORS/Download-only issues)
 * @param url - The source URL
 * @returns Proxy URL for Google Drive, or original URL
 */
export function getPreviewUrl(url: string | null | undefined): string {
    if (!url) return '';

    // If it's a Google Drive link, use our proxy for the preview
    if (isGoogleDriveUrl(url)) {
        const id = extractGoogleDriveId(url);
        if (id) {
            return `https://storage.campzeo.com/api/upload/google-drive/view?id=${id}`;
        }
    }

    return url;
}

/**
 * Checks if a URL is publicly accessible (not localhost/127.0.0.1)
 * @param url - The URL to check
 * @returns true if URL is publicly accessible
 */
export function isPublicUrl(url: string): boolean {
    if (!url) return false;

    // A "public" url must be absolute and NOT localhost
    const isLocal = url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.includes('0.0.0.0');

    return (url.startsWith('http://') || url.startsWith('https://')) && !isLocal;
}

/**
 * Gets the appropriate media URL for browser previewing.
 * Converts Google Drive direct links back to local proxy URLs if needed to avoid CORS/Download issues.
 */
export function getMediaPreviewUrl(url: string): string {
    if (!url) return '';

    // If it's a Google Drive direct link, convert to local proxy for rendering
    if (isGoogleDriveUrl(url)) {
        const id = extractGoogleDriveId(url);
        const urlObj = new URL(url);
        const file = urlObj.searchParams.get('file') ||
            urlObj.searchParams.get('filename') ||
            (urlObj.hash ? decodeURIComponent(urlObj.hash.substring(1)) : 'media');

        if (id) {
            return `https://storage.campzeo.com/api/upload/google-drive/view?id=${id}&file=${encodeURIComponent(file)}`;
        }
    }

    return url;
}

/**
 * Gets the appropriate media URL for social media posting
 * @param url - The media URL
 * @returns URL suitable for social media posting
 */
export function getSocialMediaUrl(url: string): string {
    if (!url) return '';

    // Transform Google Drive links to optimized CDN links or internal proxies for social media
    if (isGoogleDriveUrl(url)) {
        try {
            const id = extractGoogleDriveId(url);
            const urlObj = new URL(url);
            const file = urlObj.searchParams.get('file') ||
                urlObj.searchParams.get('filename') ||
                urlObj.searchParams.get('name') ||
                (urlObj.hash ? decodeURIComponent(urlObj.hash.substring(1)) : 'media');

            if (id) {
                // Determine if it's definitely an image based on the file hint (if available)
                const isDefinitelyImage = isImageUrl(file);

                // For confirmed images, use the lh3 CDN (optimized, faster)
                if (isDefinitelyImage) {
                    return `https://lh3.googleusercontent.com/d/${id}=w1000`;
                }

                // For videos OR unknown types, use our internal proxy.
                // This is safer because the proxy handles any file type via the Drive API.
                return getPublicMediaUrl(`/api/upload/google-drive/view?id=${id}`);
            }
        } catch (e) {
            console.warn('[MediaUtils] Failed to transform Drive URL:', e);
        }
    }

    // If it's already a public absolute URL (or our transformed one), return as is
    if (isPublicUrl(url)) {
        return url;
    }

    // Otherwise, try to make it absolute using the configured base URL
    return getPublicMediaUrl(url);
}

/**
 * Validates if media URL is suitable for social media posting
 * @param url - The media URL to validate
 * @returns Object with validation result and message
 */
export function validateMediaUrl(url: string): { valid: boolean; message?: string; url: string } {
    if (!url) {
        return { valid: false, message: 'No media URL provided', url: '' };
    }

    const publicUrl = getSocialMediaUrl(url);

    if (!isPublicUrl(publicUrl)) {
        return {
            valid: false,
            message: 'Media URL is not publicly accessible. Social media platforms cannot fetch localhost URLs.',
            url: publicUrl
        };
    }

    return { valid: true, url: publicUrl };
}

/**
 * Gets file extension from URL
 * @param url - The URL
 * @returns File extension (e.g., 'jpg', 'mp4')
 */
export function getFileExtension(url: string): string {
    if (!url) return '';
    try {
        const urlObj = new URL(url);

        // 1. Try to get extension from the pathname
        const path = urlObj.pathname;
        const lastDotInPath = path.lastIndexOf('.');
        if (lastDotInPath !== -1) {
            const ext = path.substring(lastDotInPath + 1).toLowerCase();
            if (ext && !ext.includes('/')) return ext;
        }

        // 2. Try to get from filename parameters or fragment hint (used for Google Drive links)
        const fileParam = urlObj.searchParams.get('file') ||
            urlObj.searchParams.get('filename') ||
            urlObj.searchParams.get('name') ||
            (urlObj.hash ? decodeURIComponent(urlObj.hash.substring(1)) : null);
        if (fileParam) {
            const lastDotInFile = fileParam.lastIndexOf('.');
            if (lastDotInFile !== -1) {
                return fileParam.substring(lastDotInFile + 1).toLowerCase();
            }
        }

        // 3. Fallback to generic regex for other patterns
        const match = url.match(/\.([^./?&]+)(?:[?&]|$)/);
        return match ? match[1].toLowerCase() : '';
    } catch {
        const match = url.match(/\.([^./?&]+)(?:[?&]|$)/);
        return match ? match[1].toLowerCase() : '';
    }
}

/**
 * Checks if URL points to a video file
 * @param url - The URL to check
 * @returns true if URL is a video
 */
export function isVideoUrl(url: string | null | undefined): boolean {
    if (!url) return false;


    if (url.includes('campzeo.com')) return true;
    if (url.includes('lh3.googleusercontent.com')) return false;

    const ext = getFileExtension(url);
    return ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'quicktime'].includes(ext);
}

/**
 * Checks if URL points to an image file
 * @param url - The URL to check
 * @returns true if URL is an image
 */
export function isImageUrl(url: string | null | undefined): boolean {
    if (!url) return false;

    // Heuristic: lh3 google links are always images
    if (url.includes('lh3.googleusercontent.com')) return true;
    // Heuristic: campzeo.com links in this context are specialized video proxies
    if (url.includes('campzeo.com')) return false;

    const ext = getFileExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'tiff'].includes(ext);
}

/**
 * Checks if URL points to a document file
 * @param url - The URL to check
 * @returns true if URL is a document
 */
export function isDocumentUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    const ext = getFileExtension(url);
    return ['pdf', 'csv', 'xlsx', 'xls', 'doc', 'docx', 'txt', 'ppt', 'pptx'].includes(ext);
}
