import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';
import crypto from "crypto";

import { withErrorHandling } from '@/lib/api-handler';
// File size limits (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
// NOTE: Vercel Serverless Functions have a request body limit of 4.5MB.
// This 500MB limit will only work if running locally or using a different hosting provider.
// For Vercel deployment, use Client Uploads (implemented in /api/upload).
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB for videos

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

async function postHandler(request: NextRequest) {

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

        console.log('[Upload] Redirecting to custom server upload API');

        const uploadFormData = new FormData();
        uploadFormData.append('files', file);

        const uploadRes = await fetch('http://103.72.220.77:5000/api/upload', {
            method: 'POST',
            body: uploadFormData,
        });

        if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            throw new Error(`Custom server upload failed: ${uploadRes.statusText}. ${errorText}`);
        }

        const uploadData = await uploadRes.json();
        const url = uploadData.urls && uploadData.urls.length > 0 ? uploadData.urls[0] : null;

        if (!url) {
            throw new Error('[Upload] Custom server upload succeeded but no URL was returned.');
        }

        console.log('[Upload] File uploaded to custom server:', url);

        return NextResponse.json({
            url,
            filename,
            size: file.size,
            type: file.type,
            isImage,
            isVideo
        });

    
}

export const POST = withErrorHandling(postHandler, "POST /api/socialmedia/upload-media-file");

// Optional: Add GET endpoint to retrieve upload info
async function getHandler() {

    return NextResponse.json({
        maxImageSize: MAX_IMAGE_SIZE,
        maxVideoSize: MAX_VIDEO_SIZE,
        allowedImageTypes: ALLOWED_IMAGE_TYPES,
        allowedVideoTypes: ALLOWED_VIDEO_TYPES,
        storage: 'vercel-blob',
        configured: !!process.env.BLOB_READ_WRITE_TOKEN
    });

}

export const GET = withErrorHandling(getHandler, "GET /api/socialmedia/upload-media-file");
