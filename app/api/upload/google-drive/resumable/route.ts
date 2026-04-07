import { NextResponse } from 'next/server';
import { getOrCreateFolder, getResumableUploadUrl, uploadChunkProxy } from '@/lib/google-drive';
import { withErrorHandling, ApiError } from '@/lib/api-handler';

/**
 * POST /api/upload/google-drive/resumable
 * Initiates a Google Drive resumable upload session.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const body = await req.json();
  const { fileName, mimeType, organisationId, campaignId } = body;

  if (!fileName || !mimeType || !organisationId || !campaignId) {
    throw new ApiError(400, 'Missing required fields: fileName, mimeType, organisationId, campaignId');
  }

  // 1. Get or create the folder structure: {orgId}/{campId}/pending
  // We use a "pending" folder initially because the postId is not yet known.
  console.log(`[Drive] Initiating resumable upload in: ${organisationId}/${campaignId}/pending`);
  
  const folderId = await getOrCreateFolder([organisationId, campaignId, 'pending']);

  // 2. Start the resumable session with Google
  const { uploadUrl } = await getResumableUploadUrl(fileName, mimeType, folderId);

  return NextResponse.json({ uploadUrl });
}, "POST /api/upload/google-drive/resumable");

/**
 * PUT /api/upload/google-drive/resumable
 * Uploads a single chunk to the current resumable session.
 * We use PUT because that's what Google Drive's API expects for the actual binary data.
 */
export const PUT = withErrorHandling(async (req: Request) => {
  const uploadUrl = req.headers.get('x-upload-url');
  const totalSize = parseInt(req.headers.get('x-total-size') || '0', 10);
  const rangeStart = parseInt(req.headers.get('x-range-start') || '0', 10);

  if (!uploadUrl || isNaN(totalSize) || isNaN(rangeStart)) {
    throw new ApiError(400, 'Missing chunk headers: x-upload-url, x-total-size, x-range-start');
  }

  // Get the chunk as a Buffer (using arrayBuffer then Buffer.from)
  const arrayBuffer = await req.arrayBuffer();
  const chunkBuffer = Buffer.from(arrayBuffer);

  if (chunkBuffer.length === 0) {
    throw new ApiError(400, 'Empty chunk body');
  }

  // Proxy the chunk to Google
  const result = await uploadChunkProxy(uploadUrl, chunkBuffer, rangeStart, totalSize);

  return NextResponse.json(result);
}, "PUT /api/upload/google-drive/resumable");
