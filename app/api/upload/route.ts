import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

import { withErrorHandling } from '@/lib/api-handler';
async function postHandler(request: Request) {
    const body = (await request.json()) as HandleUploadBody;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('BLOB_READ_WRITE_TOKEN is not set');
        return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });
    }

    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
            return {
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
}

export const POST = withErrorHandling(postHandler as any, "POST /api/upload", "postHandler");
