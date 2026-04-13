export async function uploadToServer(
  file: File, 
  organisationId?: string, 
  campaignId?: string,
  platform?: string | null,
  isReel?: boolean,
  onProgress?: (progress: number) => void
): Promise<{ url: string }> {
  const provider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER || 'custom_server';
  const serverUrl = process.env.NEXT_PUBLIC_UPLOAD_SERVER_URL || '';

  if (provider === 'google_drive') {
    console.log("[Upload] Using Google Drive resumable storage provider...");
    
    if (!organisationId) {
      throw new Error("Organisation ID is required for Google Drive folder organization.");
    }

    const isImage = file.type.startsWith('image/');

    // For images with platform context, use the optimization path (server-side processing)
    if (isImage && platform) {
      if (onProgress) onProgress(1);
      console.log(`[Upload] Image with platform ${platform} - using server-side optimization path`);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`/api/upload/google-drive?organisationId=${organisationId}&campaignId=${campaignId || ''}&platform=${platform}&isReel=${isReel || false}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Image upload failed: ${res.statusText}`);
      }

      const result = await res.json();
      if (onProgress) onProgress(100);
      return result;
    }

    if (onProgress) onProgress(1); // Set to 1% immediately to show activity

    // 1. Initiate resumable upload session
    const initRes = await fetch('/api/upload/google-drive/resumable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        organisationId,
        campaignId,
        platform,
        isReel
      })
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Failed to initiate upload: ${err}`);
    }

    const { uploadUrl } = await initRes.json();

    // 2. Upload file in 4MB chunks to bypass Vercel serverless function limits (4.5MB)
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
    const totalSize = file.size;
    let start = 0;
    let fileId = '';

    console.log(`[Upload] Starting chunked upload for ${file.name} (${totalSize} bytes)`);

    while (start < totalSize) {
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = file.slice(start, end);

      const chunkRes = await fetch('/api/upload/google-drive/resumable', {
        method: 'PUT',
        headers: {
          'x-upload-url': uploadUrl,
          'x-total-size': totalSize.toString(),
          'x-range-start': start.toString(),
        },
        body: chunk
      });

      if (!chunkRes.ok) {
        const err = await chunkRes.text();
        throw new Error(`Chunk upload failed at ${start}: ${err}`);
      }

      const result = await chunkRes.json();
      
      if (result.status === 308) {
        // More chunks to come
        start = end;
        const progress = Math.round((start / totalSize) * 100);
        console.log(`[Upload] Progress: ${progress}%`);
        if (onProgress) onProgress(progress);
      } else if (result.status === 200 || result.status === 201) {
        // Upload complete
        fileId = result.data.id;
        if (onProgress) onProgress(100);
        break;
      } else {
        throw new Error(`Unexpected response from chunk upload: ${result.status}`);
      }
    }

    if (!fileId) {
      throw new Error("Upload completed but no File ID was returned.");
    }

    // 3. Construct a direct, publicly accessible Google Drive URL
    // We use the same format as the standard upload path for consistency
    const url = `https://drive.google.com/uc?id=${fileId}&export=download&file=${encodeURIComponent(file.name)}`;
    
    console.log(`[Upload] Resumable upload successful: ${url}`);
    return { url };
  } else {
    const formData = new FormData();
    let uploadUrl = `${serverUrl}/api/upload?platform=${platform || ''}&isReel=${isReel || false}`;
    if (organisationId) uploadUrl += `&organisationId=${organisationId}`;
    if (campaignId) uploadUrl += `&campaignId=${campaignId}`;

    formData.append('file', file); // Sync naming with /api/upload/google-drive
    console.log(`[Upload] Using custom server storage provider: ${uploadUrl}`);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Upload failed: ${res.statusText}. ${errorText}`);
    }

    const data = await res.json();
    const url = data.urls && data.urls.length > 0 ? data.urls[0] : (data.url || null);

    if (!url) {
      throw new Error("Upload succeeded but no URL was returned by the server.");
    }

    return { url };
  }
}


export async function deleteFromServer(publicUrl: string): Promise<boolean> {
  const serverUrl = process.env.NEXT_PUBLIC_UPLOAD_SERVER_URL || '';
  try {
    const filename = publicUrl.split('/').pop();
    if (!filename) return false;

    console.log(`[Cleanup] Deleting ${filename} from custom server...`);

    const res = await fetch(`${serverUrl}/api/file/${filename}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      console.warn(`[Cleanup] Failed to delete ${filename}: ${res.statusText}`);
      return false;
    }

    console.log(`[Cleanup] Successfully deleted ${filename} from custom server.`);
    return true;
  } catch (error) {
    console.error(`[Cleanup] Error deleting from custom server:`, error);
    return false;
  }
}
export async function deleteFromDriveImmediate(urls: string[]): Promise<boolean> {
  if (!urls || urls.length === 0) return true;
  
  try {
    console.log(`[DriveHelper] Immediate cleanup for ${urls.length} files via POST...`);
    const res = await fetch('/api/upload/google-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'cleanup',
        urls 
      }),
      keepalive: true // Crucial for beforeunload cleanup
    });

    if (!res.ok) {
      console.warn(`[DriveHelper] Immediate cleanup failed: ${res.statusText}`);
      return false;
    }

    const data = await res.json();
    console.log(`[DriveHelper] Cleanup successful: ${data.deletedCount} files removed.`);
    return true;
  } catch (error) {
    console.error(`[DriveHelper] Error during immediate cleanup:`, error);
    return false;
  }
}
