import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getFacebookLeadForms, createFacebookLeadForm } from '@/lib/facebook';
import { withErrorHandling } from '@/lib/api-handler';

async function getHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const pageAccessToken = searchParams.get('pageAccessToken');

    if (!pageId || !pageAccessToken) {
        return NextResponse.json({ error: 'Missing pageId or pageAccessToken' }, { status: 400 });
    }

    const forms = await getFacebookLeadForms(pageId, pageAccessToken);
    return NextResponse.json({ success: true, forms });
}

async function postHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
        pageId,
        pageAccessToken,
        name,
        privacy_policy_url,
        privacy_policy_link_text,
        questions,
        follow_up_action_url,
        greeting,
        intro_description,
        description_format,
        contact_description,
        custom_notices,
        thank_you_headline,
        thank_you_description,
        flexible_form_delivery
    } = body;

    if (!pageId || !pageAccessToken || !name || !privacy_policy_url || !questions) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await createFacebookLeadForm(pageId, pageAccessToken, {
        name,
        privacy_policy_url,
        privacy_policy_link_text,
        questions,
        follow_up_action_url,
        greeting,
        intro_description,
        description_format,
        contact_description,
        custom_notices,
        thank_you_headline,
        thank_you_description,
        flexible_form_delivery
    });

    return NextResponse.json({ success: true, result });
}

export const GET = withErrorHandling(getHandler, "GET /api/socialmedia/facebook/lead-forms", "getHandler");
export const POST = withErrorHandling(postHandler, "POST /api/socialmedia/facebook/lead-forms", "postHandler");
