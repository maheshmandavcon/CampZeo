import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            console.error('BLOB_READ_WRITE_TOKEN is not set');
            return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });
        }

        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                // Authenticate user here
                return {
                    // Allowed content types are commented out to allow ANY file type
                    // allowedContentTypes: [ ... ], 
                    maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
                    tokenPayload: JSON.stringify({
                        userId: user.id,
                    }),
                    addRandomSuffix: true,
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                console.log('Blob uploaded successfully:', blob.url);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error('Error in /api/upload:', error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }, // Use 500 for server errors
        );
    }
}
