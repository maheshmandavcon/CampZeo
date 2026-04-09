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
    // Forward the Range header to support video ingestion (Meta crawler needs this)
    const incomingRange = req.headers.get('range');
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    const googleHeaders: Record<string, string> = {
      Authorization: `Bearer ${token.token}`
    };
    if (incomingRange) {
      googleHeaders['Range'] = incomingRange;
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: googleHeaders
    });

    if (!res.ok && res.status !== 206) {
      const text = await res.text();
      console.error('Failed to fetch from drive:', text);
      return new NextResponse('Error fetching media from Google Drive', { status: res.status });
    }

    // 4. Return the Web stream with the correct headers
    // Meta's video ingestion crawler requires Accept-Ranges, Content-Length, and often Content-Range
    const fileName = metadata.data.name || 'media';
    let mimeType = metadata.data.mimeType || 'application/octet-stream';
    
    // Force video/mp4 for common video extensions if Google returns generic type
    if (mimeType === 'application/octet-stream' || mimeType === 'video/x-matroska') {
      if (fileName.toLowerCase().endsWith('.mp4')) mimeType = 'video/mp4';
      else if (fileName.toLowerCase().endsWith('.mov')) mimeType = 'video/quicktime';
      else if (fileName.toLowerCase().endsWith('.webm')) mimeType = 'video/webm';
    }

    console.log(`[Proxy Log] Serving file: ${fileName} (${mimeType}) | Status: ${res.status} | Range: ${incomingRange || 'None'}`);

    const headers = new Headers({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Accept-Ranges': 'bytes',
    });

    const contentLength = res.headers.get('content-length');
    const contentRange = res.headers.get('content-range');

    if (contentLength) headers.set('Content-Length', contentLength);
    if (contentRange) headers.set('Content-Range', contentRange);

    return new NextResponse(res.body, {
      status: res.status, // Return 200 or 206 based on Google's response
      headers: headers,
    });
  } catch (error: any) {
    console.error('Proxy View Error:', error);
    return new NextResponse('Error fetching file from Google Drive', { status: 500 });
  }
}
