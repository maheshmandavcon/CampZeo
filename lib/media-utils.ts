/**
 * Utility functions for handling media URLs across different environments
 */

/**
 * Converts a relative URL to an absolute public URL
 * @param url - The URL to convert (can be relative or absolute)
 * @returns Absolute public URL
 */
export function getPublicMediaUrl(url: string): string {
    // If already absolute URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // If relative URL, convert to absolute
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
        'http://localhost:3000';

    return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

/**
 * Checks if a URL is publicly accessible (not localhost)
 * @param url - The URL to check
 * @returns true if URL is publicly accessible
 */
export function isPublicUrl(url: string): boolean {
    if (!url) return false;

    const isLocalhost = url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.includes('0.0.0.0');

    return !isLocalhost && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * Gets the appropriate media URL for social media posting
 * For production: returns the URL as is (should be Vercel Blob)
 * For development: converts localhost URLs to public URLs if available
 * @param url - The media URL
 * @returns URL suitable for social media posting
 */
export function getSocialMediaUrl(url: string): string {
    // If it's already a public URL (Vercel Blob, Cloudinary, etc.), return as is
    if (isPublicUrl(url)) {
        return url;
    }

    // For localhost URLs, convert to public URL
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
    const match = url.match(/\.([^./?]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : '';
}

/**
 * Checks if URL points to a video file
 * @param url - The URL to check
 * @returns true if URL is a video
 */
export function isVideoUrl(url: string): boolean {
    const ext = getFileExtension(url);
    return ['mp4', 'mov', 'webm', 'avi', 'quicktime'].includes(ext);
}

/**
 * Checks if URL points to an image file
 * @param url - The URL to check
 * @returns true if URL is an image
 */
export function isImageUrl(url: string): boolean {
    const ext = getFileExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}
