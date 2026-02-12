import { NextRequest, NextResponse } from 'next/server';

import { withErrorHandling } from '@/lib/api-handler';
async function postHandler(request: NextRequest) {

    const apiKey = request.headers.get('x-api-key');

    if (!process.env.N8N_API_KEY) {
        console.warn('N8N_API_KEY is not set');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (apiKey !== process.env.N8N_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: true });

}

export const POST = withErrorHandling(postHandler, "POST /api/n8n/auth");
