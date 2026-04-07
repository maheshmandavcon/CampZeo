/**
 * Utility functions for handling media URLs across different environments
 */

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
 * Gets a URL suitable for local frontend preview (bypasses CORS/Download-only issues)
 * @param url - The source URL
 * @returns Proxy URL for Google Drive, or original URL
 */
export function getPreviewUrl(url: string | null | undefined): string {
    if (!url) return '';

    // If it's a Google Drive direct link, use our proxy for the preview
    if (url.includes('drive.google.com/uc')) {
        try {
            const urlObj = new URL(url);
            const id = urlObj.searchParams.get('id');
            if (id) {
                return `/api/upload/google-drive/view?id=${id}`;
            }
        } catch (e) {
            // Regex fallback if URL parsing fails
            const match = url.match(/[?&]id=([^?&]+)/);
            if (match) return `/api/upload/google-drive/view?id=${match[1]}`;
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
    if (url.includes('drive.google.com/uc') || url.includes('googleusercontent.com/d/')) {
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get('id') || url.split('/d/')[1]?.split(/[/?]/)[0];
        const file = urlObj.searchParams.get('file') || 'media';
        
        if (id) {
            return `/api/upload/google-drive/view?id=${id}&file=${encodeURIComponent(file)}`;
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
    // If it's already a public absolute URL, return as is
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

        // 2. Try to get from a 'file' query parameter (used for Google Drive links)
        const fileParam = urlObj.searchParams.get('file');
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
