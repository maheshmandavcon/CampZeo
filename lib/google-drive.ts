import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Google Drive Storage Provider
 * Handles file uploads to a specific Google Drive folder and makes them public.
 */

const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Initializes the Google Drive client using service account credentials.
 */
async function getDriveClient() {
  let keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyString) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not defined in environment variables');
  }

  // Handle potential wrapping quotes from .env
  if (keyString.startsWith("'") && keyString.endsWith("'")) {
    keyString = keyString.slice(1, -1);
  }

  try {
    const key = JSON.parse(keyString);
    
    // Ensure the private key has correct newline characters
    const privateKey = key.private_key?.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: key.client_email,
        private_key: privateKey,
      },
      scopes: SCOPES,
    });

    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', error);
    throw new Error('Invalid Google Service Account Key format');
  }
}

/**
 * Uploads a file to Google Drive.
 * @param fileBuffer The file content as a Buffer.
 * @param fileName The name of the file (including extension).
 * @param mimeType The MIME type of the file.
 * @returns The public URL of the uploaded file.
 */
/**
 * Helper to ensure a public permission exists on a file.
 */
export async function makeFilePublic(fileId: string): Promise<void> {
  const drive = await getDriveClient();
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch (error: any) {
    // If permission already exists, ignore
    if (error.code !== 400) {
      console.error(`Error making file ${fileId} public:`, error);
      throw error;
    }
  }
}

/**
 * Uploads a file to Google Drive.
 * @param fileBuffer The file content as a Buffer.
 * @param fileName The name of the file (including extension).
 * @param mimeType The MIME type of the file.
 * @returns The public URL of the uploaded file.
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const drive = await getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is not defined');
  }

  // Create a readable stream from the buffer
  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  try {
    // 1. Upload the file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType,
        body: bufferStream,
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    } as any);

    const fileId = response.data.id;
    if (!fileId) throw new Error('Upload failed: No file ID returned');

    // 2. Make the file public
    await makeFilePublic(fileId);

    // 3. Return the direct Google Drive URL
    return `https://drive.google.com/uc?id=${fileId}&export=download&file=${encodeURIComponent(fileName)}`;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
}

/**
 * Gets or creates a folder structure recursively.
 * @param pathParts Array of folder names like ['org1', 'camp2', 'pending']
 * @param parentId Starting parent folder ID
 */
export async function getOrCreateFolder(
  pathParts: string[],
  parentId?: string
): Promise<string> {
  const drive = await getDriveClient();
  let currentParentId = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!currentParentId) {
    throw new Error('Root Google Drive Folder ID is not defined');
  }

  for (const folderName of pathParts) {
    // Search for existing folder
    const listResponse: any = await drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (listResponse.data.files && listResponse.data.files.length > 0) {
      currentParentId = listResponse.data.files[0].id!;
    } else {
      // Create new folder
      const folderResponse: any = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentParentId!],
        },
        fields: 'id',
        supportsAllDrives: true,
      } as any);
      currentParentId = folderResponse.data.id!;
    }
  }

  return currentParentId!;
}

/**
 * Initiates a resumable upload and returns the location URL for the client.
 */
export async function getResumableUploadUrl(
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<{ uploadUrl: string }> {
  const drive = await getDriveClient();
  
  // Use manual fetch for the session URL to ensure it's compatible with client-side PUT
  const auth = drive.context._options.auth as any;
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': mimeType,
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to initiate Google Drive upload: ${res.statusText} - ${errorText}`);
  }

  const uploadUrl = res.headers.get('Location');
  if (!uploadUrl) throw new Error('Failed to get Google Drive upload session URL');

  return { uploadUrl };
}

export async function uploadChunkProxy(
  uploadUrl: string,
  chunkBuffer: Buffer,
  rangeStart: number,
  totalSize: number
): Promise<{ status: number; data?: any }> {
  const drive = await getDriveClient();
  const auth = drive.context._options.auth as any;
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const rangeEnd = rangeStart + chunkBuffer.length - 1;
  const contentRange = `bytes ${rangeStart}-${rangeEnd}/${totalSize}`;

  console.log(`[Drive] Uploading chunk: ${contentRange} (${chunkBuffer.length} bytes)`);

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Length': chunkBuffer.length.toString(),
      'Content-Range': contentRange,
    },
    body: new Uint8Array(chunkBuffer),
  });

  if (res.status === 308) {
    // 308 Resume Incomplete is expected for intermediate chunks
    return { status: 308 };
  }

  if (res.ok) {
    // 200 or 201 means the upload is complete
    const data = await res.json();
    return { status: res.status, data };
  }

  const errorText = await res.text();
  throw new Error(`Google Drive chunk upload failed: ${res.status} - ${errorText}`);
}

/**
 * Moves a file by updating its parents.
 */
export async function moveFile(fileId: string, targetFolderId: string): Promise<void> {
  const drive = await getDriveClient();
  
  // 1. Get current parents
  const file = await drive.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true,
  });
  
  const previousParents = (file.data.parents || []).join(',');

  // 2. Update parents
  await drive.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: previousParents,
    fields: 'id, parents',
    supportsAllDrives: true,
  });
}

/**
 * Deletes a file from Google Drive.
 * @param fileId Or the public URL from which we can extract the ID.
 */
export async function deleteFromDrive(fileIdOrUrl: string): Promise<boolean> {
  const drive = await getDriveClient();
  let fileId = fileIdOrUrl;

  // Extract ID if a URL was provided
  if (fileIdOrUrl.includes('id=')) {
    fileId = fileIdOrUrl.split('id=')[1].split('&')[0];
  }

  try {
    await drive.files.delete({ fileId });
    return true;
  } catch (error) {
    console.error(`Failed to delete file ${fileId} from Drive:`, error);
    return false;
  }
}
