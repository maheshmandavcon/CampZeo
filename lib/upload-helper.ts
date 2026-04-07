export async function uploadToServer(file: File): Promise<{ url: string }> {
  const provider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER || 'custom_server';
  const serverUrl = process.env.NEXT_PUBLIC_UPLOAD_SERVER_URL || '';

  const formData = new FormData();
  let uploadUrl = `${serverUrl}/api/upload`;

  if (provider === 'google_drive') {
    uploadUrl = '/api/upload/google-drive';
    formData.append('file', file); // My API route expects 'file'
    console.log("[Upload] Using Google Drive storage provider...");
  } else {
    formData.append('files', file); // Custom server expects 'files'
    console.log(`[Upload] Using custom server storage provider: ${serverUrl}`);
  }

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

  console.log("File is now at:", url);
  return { url };
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
