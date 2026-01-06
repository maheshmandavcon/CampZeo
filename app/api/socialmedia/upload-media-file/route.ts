import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';
import crypto from "crypto";

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
// NOTE: Vercel Serverless Functions have a request body limit of 4.5MB.
// This 500MB limit will only work if running locally or using a different hosting provider.
// For Vercel deployment, use Client Uploads (implemented in /api/upload).
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB for videos

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Validate file type
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

        if (!isImage && !isVideo) {
            return NextResponse.json({
                error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP, MP4, MOV, WebM"
            }, { status: 400 });
        }

        // Validate file size
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (file.size > maxSize) {
            const maxSizeMB = maxSize / (1024 * 1024);
            return NextResponse.json({
                error: `File too large. Maximum size: ${maxSizeMB}MB`
            }, { status: 400 });
        }

        // Generate unique filename
        const fileExtension = file.name.split('.').pop();
        const filename = `${crypto.randomUUID()}.${fileExtension}`;

        // Always use Vercel Blob storage
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return NextResponse.json({
                error: 'Blob storage not configured. Please set BLOB_READ_WRITE_TOKEN environment variable.'
            }, { status: 500 });
        }

        console.log('[Upload] Using Vercel Blob storage');

        const blob = await put(filename, file, {
            access: 'public',
            addRandomSuffix: false,
        });

        const url = blob.url;
        console.log('[Upload] File uploaded to Vercel Blob:', url);

        return NextResponse.json({
            url,
            filename,
            size: file.size,
            type: file.type,
            isImage,
            isVideo
        });

    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Upload failed"
        }, { status: 500 });
    }
}

// Optional: Add GET endpoint to retrieve upload info
export async function GET() {
    return NextResponse.json({
        maxImageSize: MAX_IMAGE_SIZE,
        maxVideoSize: MAX_VIDEO_SIZE,
        allowedImageTypes: ALLOWED_IMAGE_TYPES,
        allowedVideoTypes: ALLOWED_VIDEO_TYPES,
        storage: 'vercel-blob',
        configured: !!process.env.BLOB_READ_WRITE_TOKEN
    });
}
