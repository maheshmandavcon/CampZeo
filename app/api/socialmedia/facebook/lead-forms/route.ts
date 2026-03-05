import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getFacebookLeadForms, createFacebookLeadForm, getFacebookLeadFormDetails } from '@/lib/facebook';
import { withErrorHandling } from '@/lib/api-handler';

async function getHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const pageAccessToken = searchParams.get('pageAccessToken');
    const formId = searchParams.get('formId');

    if (!pageId || !pageAccessToken) {
        return NextResponse.json({ error: 'Missing pageId or pageAccessToken' }, { status: 400 });
    }

    // If formId is provided, fetch detailed form data
    if (formId) {
        const form = await getFacebookLeadFormDetails(formId, pageAccessToken);
        return NextResponse.json({ success: true, form });
    }

    // Otherwise, fetch all forms
    const forms = await getFacebookLeadForms(pageId, pageAccessToken);
    return NextResponse.json({ success: true, forms });
}

async function postHandler(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            pageId,
            pageAccessToken,
            name,
            privacy_policy_url,
            privacy_policy_link_text,
            questions,
            questions_description, // Extract new field
            follow_up_action_url,
            greeting,
            intro_description,
            description_format,
            contact_description,
            custom_notices,
            thank_you_headline,
            thank_you_description,
            flexible_form_delivery,
            context_card_style,
            context_card_content,
            custom_disclaimer
        } = body;

        if (!pageId || !pageAccessToken || !name || !privacy_policy_url || !questions) {
            // ... (validation logic remains the same)
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await createFacebookLeadForm(pageId, pageAccessToken, {
            name,
            privacy_policy_url,
            privacy_policy_link_text,
            questions,
            questions_description, // Pass new field
            follow_up_action_url,
            greeting,
            intro_description,
            context_card_style, // Make sure this matches FormData interface
            context_card_content,
            thank_you_headline,
            thank_you_description,
            custom_disclaimer
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error('[Lead Forms API] Error:', error);

        // Extract meaningful error message
        const errorMessage = error instanceof Error ? error.message : 'Failed to create lead form';

        return NextResponse.json({
            error: errorMessage,
            details: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}

export const GET = withErrorHandling(getHandler, "GET /api/socialmedia/facebook/lead-forms", "getHandler");
export const POST = withErrorHandling(postHandler, "POST /api/socialmedia/facebook/lead-forms", "postHandler");
