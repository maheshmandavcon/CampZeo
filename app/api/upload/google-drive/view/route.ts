import { google } from 'googleapis';
import { NextResponse } from 'next/server';

/**
 * GET /api/upload/google-drive/view?id=FILE_ID
 * Proxies Google Drive files so they can be viewed reliably in the browser.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return new NextResponse('File ID is required', { status: 400 });
  }

  try {
    // 1. Initialize Auth
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    const key = JSON.parse(keyString.startsWith("'") ? keyString.slice(1, -1) : keyString);
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 2. Get Metadata to know the MimeType
    const metadata = await drive.files.get({
      fileId,
      fields: 'mimeType, name',
      supportsAllDrives: true,
    });

    // 3. Fetch the actual file content
    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    // 4. Return as a stream with the correct headers
    return new NextResponse(response.data as any, {
      headers: {
        'Content-Type': metadata.data.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${metadata.data.name}"`,
      },
    });
  } catch (error: any) {
    console.error('Proxy View Error:', error);
    return new NextResponse('Error fetching file from Google Drive', { status: 500 });
  }
}
