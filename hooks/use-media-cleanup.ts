import { useEffect, useRef, useCallback } from 'react';
import { deleteFromDriveImmediate } from '@/lib/upload-helper';

/**
 * Custom hook to track and cleanup media uploads within a page session.
 * Ensures that any uploaded files are deleted if the user aborts the action.
 */
export function useMediaCleanup() {
  // URLs uploaded in this specific session
  const uploadedUrls = useRef<Set<string>>(new Set());
  // Flag to mark the session as "successful" (e.g. form submitted)
  const isSubmitted = useRef(false);

  /**
   * Tracks a newly uploaded URL for potential cleanup.
   */
  const trackUpload = useCallback((url: string | null | undefined) => {
    if (url && typeof url === 'string') {
      uploadedUrls.current.add(url);
      console.log(`[SessionCleanup] Tracking URL: ${url}`);
    }
  }, []);

  /**
   * Forget all tracked URLs (e.g. after form submission).
   */
  const markAsSubmitted = useCallback(() => {
    const urls = Array.from(uploadedUrls.current);
    if (urls.length > 0) {
      console.log(`[SessionCleanup] Form submitted. Disabling cleanup for ${urls.length} files.`);
    }
    isSubmitted.current = true;
    uploadedUrls.current.clear();
  }, []);

  /**
   * Immediate cleanup of all tracked URLs.
   * This is called on unmount or tab closure.
   */
  const performCleanup = useCallback(() => {
    if (isSubmitted.current || uploadedUrls.current.size === 0) {
        return;
    }

    const urls = Array.from(uploadedUrls.current);
    console.log(`[SessionCleanup] Execution Triggered. Cleaning up ${urls.length} orphaned files.`);
    
    // Clear them immediately to prevent double cleanup if unmount and beforeunload fire together
    uploadedUrls.current.clear();
    
    // Start the fire-and-forget cleanup
    deleteFromDriveImmediate(urls).catch(err => {
      console.error('[SessionCleanup] Failure during background cleanup:', err);
    });
  }, []);

  useEffect(() => {
    // 1. Internal Navigation Cleanup (Component Unmount)
    return () => {
      console.log('[SessionCleanup] Component unmount cleanup check.');
      performCleanup();
    };
  }, [performCleanup]);

  useEffect(() => {
    // 2. Tab Closure / Refresh Cleanup (Before Unload)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isSubmitted.current && uploadedUrls.current.size > 0) {
        console.log('[SessionCleanup] BeforeUnload triggered cleanup.');
        performCleanup();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [performCleanup]);

  return { trackUpload, markAsSubmitted, performCleanup };
}
