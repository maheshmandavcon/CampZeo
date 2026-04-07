import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';
import crypto from "crypto";
import { uploadToDrive } from "@/lib/google-drive";

import { withErrorHandling } from '@/lib/api-handler';
// File size limits (in bytes)
const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const MAX_VIDEO_SIZE = 2000 * 1024 * 1024;
// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

async function postHandler(request: NextRequest) {

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
        return NextResponse.json({
            error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP, MP4, MOV, WebM"
        }, { status: 400 });
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        return NextResponse.json({
            error: `File too large. Maximum size: ${maxSizeMB}MB`
        }, { status: 400 });
    }

    const fileExtension = file.name.split('.').pop();
    const filename = `${crypto.randomUUID()}.${fileExtension}`;

    const provider = process.env.STORAGE_PROVIDER || 'custom_server';
    let url = null;

    if (provider === 'google_drive') {
        console.log('[Upload] Uploading to Google Drive...');
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        url = await uploadToDrive(buffer, filename, file.type);
    } else {
        console.log('[Upload] Redirecting to custom server upload API');
        const serverUrl = process.env.NEXT_PUBLIC_UPLOAD_SERVER_URL || 'http://103.72.220.77:5000';
        const uploadFormData = new FormData();
        uploadFormData.append('files', file);

        const uploadRes = await fetch(`${serverUrl}/api/upload`, {
            method: 'POST',
            body: uploadFormData,
        });

        if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            throw new Error(`Custom server upload failed: ${uploadRes.statusText}. ${errorText}`);
        }

        const uploadData = await uploadRes.json();
        url = uploadData.urls && uploadData.urls.length > 0 ? uploadData.urls[0] : null;

        if (!url) {
            throw new Error('[Upload] Custom server upload succeeded but no URL was returned.');
        }
    }

    console.log('[Upload] File uploaded successfully:', url);

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
        storage: process.env.STORAGE_PROVIDER || 'custom_server',
        configured: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !!process.env.BLOB_READ_WRITE_TOKEN
    });

}

export const GET = withErrorHandling(getHandler, "GET /api/socialmedia/upload-media-file");
