import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Google Drive Storage Provider
 * Handles file uploads to a specific Google Drive folder and makes them public.
 */

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

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
      supportsAllDrives: true, // Handle shared drives if needed
    } as any);

    const fileId = response.data.id;
    if (!fileId) throw new Error('Upload failed: No file ID returned');

    // 2. Make the file public (Anyone with the link can view)
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true, // Also needed for permissions on shared items
    });

    // 3. Return a local proxy URL instead of a direct Google link
    // We add '#' with the filename at the end so frontend regexes can correctly identify the media type.
    return `/api/upload/google-drive/view?id=${fileId}#${fileName}`;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
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
