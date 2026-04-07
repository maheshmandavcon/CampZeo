import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { uploadToDrive } from '@/lib/google-drive';
import { withErrorHandling } from '@/lib/api-handler';

/**
 * POST /api/upload/google-drive
 * Handles file uploads securely from the server side.
 */
async function postHandler(req: Request) {
  const user = await currentUser();
  if (!user) {
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

    // Call the Google Drive helper
    const publicUrl = await uploadToDrive(
      buffer,
      file.name,
      file.type
    );

    return NextResponse.json({
      url: publicUrl,
      urls: [publicUrl], // For compatibility with older upload-helper.ts logic
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

export const POST = withErrorHandling(postHandler, "POST /api/upload/google-drive");
