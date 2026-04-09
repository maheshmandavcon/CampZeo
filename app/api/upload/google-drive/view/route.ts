import { google } from 'googleapis';

/**
 * GET /api/upload/google-drive/view?id=FILE_ID
 * Proxies Google Drive files so they can be viewed reliably in the browser.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return new Response('File ID is required', { status: 400 });
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

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    // 2. Fetch the actual file content directly
    // Forward the Range header to support video ingestion
    const incomingRange = req.headers.get('range');
    
    const googleHeaders: Record<string, string> = {
      Authorization: `Bearer ${token.token}`
    };
    if (incomingRange) {
      googleHeaders['Range'] = incomingRange;
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: googleHeaders,
      redirect: 'follow',
      // No credentials/cookies sent
      credentials: 'omit',
    });

    if (!res.ok && res.status !== 206) {
      const text = await res.text();
      console.error('Failed to fetch from drive:', text);
      return new Response('Error fetching media from Google Drive', { status: res.status });
    }

    // 3. Return the Web stream with the absolute bare minimum headers
    // Meta's video ingestion crawler requires Accept-Ranges, Content-Length, Content-Type
    // For Option 3: pure static file behaviour. 
    // Force video/mp4 to guarantee Meta accepts it.
    console.log(`[Proxy Log] Serving pure file stream: ${fileId} | Status: ${res.status} | Range: ${incomingRange || 'None'}`);

    const headers = new Headers({
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    });

    const contentLength = res.headers.get('content-length');
    const contentRange = res.headers.get('content-range');

    if (contentLength) headers.set('Content-Length', contentLength);
    if (contentRange) headers.set('Content-Range', contentRange);

    return new Response(res.body, {
      status: res.status, 
      headers: headers,
    });
  } catch (error: any) {
    console.error('Proxy View Error:', error);
    return new Response('Error fetching file from Google Drive', { status: 500 });
  }
}
