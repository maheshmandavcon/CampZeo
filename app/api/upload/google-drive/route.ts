import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { uploadToDrive, deleteFromDrive } from '@/lib/google-drive';
import { withErrorHandling, ApiError } from '@/lib/api-handler';

/**
 * Common cleanup logic for session files
 */
async function doCleanup(urls: string[]) {
    console.log(`[Drive API] Cleaning up ${urls.length} files...`);
    const results = [];
    for (const url of urls) {
        try {
            const success = await deleteFromDrive(url);
            results.push({ url, success });
            if (success) {
                console.log(`[Drive API] Successfully deleted: ${url}`);
            } else {
                console.warn(`[Drive API] Could not delete (likely ID not found): ${url}`);
            }
        } catch (error) {
            console.error(`[Drive API] Error deleting ${url}:`, error);
            results.push({ url, success: false, error: String(error) });
        }
    }
    return results;
}

/**
 * POST /api/upload/google-drive
 * Handles:
 * 1. File uploads (Multipart form)
 * 2. Cleanup actions (JSON with action: 'cleanup')
 */
async function postHandler(req: NextRequest) {
  console.log(`[DRIVE_API] Received ${req.method} request to /api/upload/google-drive`);
  const contentType = req.headers.get('content-type') || '';
  
  // 1. Handle JSON (Cleanup Action)
  // We do this BEFORE auth check to ensure fire-and-forget cleanup during logout/unload works
  if (contentType.includes('application/json')) {
      try {
          const body = await req.json();
          if (body.action === 'cleanup') {
              console.log(`[DRIVE_SESSION_CLEANUP] Start cleanup for ${body.urls?.length || 0} URLs`);
              const results = await doCleanup(body.urls || []);
              console.log(`[DRIVE_SESSION_CLEANUP] Completed. Deleted: ${results.filter(r => r.success).length}`);
              return NextResponse.json({
                  success: true,
                  deletedCount: results.filter(r => r.success).length,
                  results
              });
          }
      } catch (err) {
          console.error('[DRIVE_SESSION_CLEANUP] JSON parse error:', err);
      }
  }

  // 2. Handle File Upload (Requires Auth)
  const user = await currentUser();
  if (!user) {
    console.warn('[DRIVE_API] Unauthorized upload attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert file to Buffer for Google Drive API
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get context for folder structure from query params
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organisationId');
    const campId = searchParams.get('campaignId');
    const pathParts = (orgId && campId) ? [orgId, campId, 'pending'] : undefined;

    // Call the Google Drive helper
    const publicUrl = await uploadToDrive(
      buffer,
      file.name,
      file.type,
      pathParts
    );

    return NextResponse.json({
      url: publicUrl,
      urls: [publicUrl],
      success: true,
    });
  } catch (error: any) {
    console.error('Error in /api/upload/google-drive:', error);
    return NextResponse.json(
      { error: error?.message || 'Server-side upload to Google Drive failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/google-drive
 * (Kept for backward compatibility)
 */
const deleteHandler = async (req: NextRequest) => {
    console.log('[Drive API] Received DELETE request');
    const { urls } = await req.json().catch(() => ({ urls: [] }));
    if (!urls || !Array.isArray(urls)) {
        throw new ApiError(400, 'Missing or invalid "urls"');
    }
    const results = await doCleanup(urls);
    return NextResponse.json({
        success: true,
        deletedCount: results.filter(r => r.success).length,
        results
    });
};

export const POST = withErrorHandling(postHandler, "POST /api/upload/google-drive");
export const DELETE = withErrorHandling(deleteHandler, "DELETE /api/upload/google-drive");
