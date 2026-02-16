
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncLeadToDatabase } from '@/lib/meta-ads';

/**
 * Meta Webhook Handler
 * 1. GET: Verification for initial setup
 * 2. POST: Lead notifications
 */

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Use environment variable or default fallback for verification
    const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'campzeo_verify_token_2024';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Meta Webhook] Verification successful');
        return new NextResponse(challenge, { status: 200 });
    }

    console.warn('[Meta Webhook] Verification failed');
    return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json();
        
        // Ensure it's a leadgen change
        if (payload.object !== 'page') return NextResponse.json({ ok: true });

        for (const entry of payload.entry) {
            const pageId = entry.id;
            
            // Find the organisation associated with this Facebook Page
            const user = await prisma.user.findFirst({
                where: { facebookPageId: pageId },
                select: { organisationId: true, facebookPageAccessToken: true }
            });

            if (!user || !user.organisationId || !user.facebookPageAccessToken) {
                console.error(`[Meta Webhook] No connected user/org found for Page ID: ${pageId}`);
                continue;
            }

            for (const change of entry.changes) {
                if (change.field === 'leadgen') {
                    const leadId = change.value.leadgen_id;
                    const formId = change.value.form_id;

                    console.log(`[Meta Webhook] Processing new lead ${leadId} for Page ${pageId}`);
                    
                    try {
                        await syncLeadToDatabase(
                            user.organisationId, 
                            leadId, 
                            user.facebookPageAccessToken,
                            formId
                        );
                    } catch (syncError) {
                        console.error(`[Meta Webhook] Failed to sync lead ${leadId}:`, syncError);
                        // We don't want to fail the whole webhook request, but we log the error
                    }
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Meta Webhook] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
