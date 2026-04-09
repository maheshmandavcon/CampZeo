import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { uploadToDrive, deleteFromDrive } from '@/lib/google-drive';
import { withErrorHandling, ApiError } from '@/lib/api-handler';
import sharp from 'sharp';
import { getTargetAspectRatio } from '@/lib/media-utils';

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
    const platform = searchParams.get('platform');
    const isReel = searchParams.get('isReel') === 'true';
    
    const pathParts = (orgId && campId) ? [orgId, campId, 'pending'] : undefined;

    // --- AUTOMATIC ASPECT RATIO ADJUSTMENT ---
    let processedBuffer = buffer;
    if (file.type.startsWith('image/') && platform) {
        try {
            const targetRatio = getTargetAspectRatio(platform, isReel);
            if (targetRatio) {
                console.log(`[Drive API] Auto-adjusting aspect ratio for ${platform} (${isReel ? 'Reel' : 'Post'}). Target ratio: ${targetRatio}`);
                
                // Get image metadata to determine current dimensions
                const image = sharp(buffer);
                const metadata = await image.metadata();
                
                if (metadata.width && metadata.height) {
                    const currentRatio = metadata.width / metadata.height;
                    
                    // Only process if the ratio is significantly different (threshold 0.05)
                    if (Math.abs(currentRatio - targetRatio) > 0.05) {
                        console.log(`[Drive API] Processing image. Current ratio: ${currentRatio.toFixed(2)}, Target: ${targetRatio.toFixed(2)}`);
                        
                        // We use fit: 'cover' for a center-crop that fills the target aspect ratio
                        // We need to calculate new width/height that matches targetRatio
                        let newWidth, newHeight;
                        
                        if (currentRatio > targetRatio) {
                            // Current is wider than target -> Keep height, reduce width (crop sides)
                            newHeight = metadata.height;
                            newWidth = Math.round(newHeight * targetRatio);
                        } else {
                            // Current is taller than target -> Keep width, reduce height (crop top/bottom)
                            newWidth = metadata.width;
                            newHeight = Math.round(newWidth / targetRatio);
                        }

                        processedBuffer = Buffer.from(await image
                            .extract({
                                left: Math.floor((metadata.width - newWidth) / 2),
                                top: Math.floor((metadata.height - newHeight) / 2),
                                width: newWidth,
                                height: newHeight
                            })
                            .resize(newWidth, newHeight) // Just to be safe / normalize
                            .toBuffer());
                            
                        console.log(`[Drive API] Image center-cropped to ${newWidth}x${newHeight}`);
                    }
                }
            }
        } catch (sharpError) {
            console.error('[Drive API] Sharp processing error:', sharpError);
            // Fallback to original buffer if processing fails
        }
    }
    // ------------------------------------------

    // Call the Google Drive helper with processed buffer
    const publicUrl = await uploadToDrive(
      processedBuffer as any,
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
