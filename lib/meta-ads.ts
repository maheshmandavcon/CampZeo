import { prisma } from './prisma';

const FB_API_VERSION = 'v24.0';

/**
 * Get Facebook App ID from Admin Configuration
 */
export async function getFacebookAppId(): Promise<string | null> {
    const config = await prisma.adminPlatformConfiguration.findFirst({
        where: { key: 'FACEBOOK_CLIENT_ID' }
    });
    return config?.value || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || null;
}

export interface MetaAdAccount {
    id: string;
    name: string;
    account_id: string;
    account_status: number;
    currency: string;
    balance: string;
    amount_spent: string;
    spend_cap?: string | null;
}

export interface MetaLeadForm {
    id: string;
    name: string;
    status: string;
}

/**
 * Fetches available ad accounts for the authenticated user
 */
export async function getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/me/adaccounts?fields=name,account_id,account_status,currency,balance,amount_spent&access_token=${accessToken}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch ad accounts: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Checks the financial health and status of a specific ad account
 */
export async function checkAdAccountStatus(adAccountId: string, accessToken: string): Promise<MetaAdAccount> {
    const response = await fetch(
        `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}?fields=name,account_id,account_status,currency,balance,amount_spent,spend_cap&access_token=${accessToken}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to check ad account status: ${JSON.stringify(error)}`);
    }

    return await response.json();
}

/**
 * Creates a Lead Generation Form on a Facebook Page
 */
export async function createLeadGenForm(pageId: string, pageAccessToken: string, formName: string, questions: { type: string, label: string }[]) {
    // Basic form configuration
    const formConfig = {
        name: formName,
        questions: questions.map(q => ({
            type: q.type.toUpperCase(), // EMAIL, FULL_NAME, PHONE, etc.
            key: q.type.toLowerCase(),
        })),
        privacy_policy: {
            url: "https://campzeo.com/privacy", // Default privacy policy fallback
            link_text: "Privacy Policy"
        }
    };

    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/leadgen_forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...formConfig,
            access_token: pageAccessToken
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create lead form: ${JSON.stringify(error)}`);
    }

    return await response.json();
}

/**
 * Logic to boost a post (Simplified flow)
 * 1. Create a Campaign (if not exists or create new)
 * 2. Create an Ad Set (Targeting/Budget)
 * 3. Create an Ad (using creative from Post ID)
 */
export async function createBoostedAd(options: {
    adAccountId: string,
    accessToken: string,
    postId: string,
    name: string,
    budget: number,
    days: number,
    objective: 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEAD_GENERATION',
    startTime?: Date | null,
    targeting?: any,
    instagramActorId?: string | null
}) {
    // 1. Create Campaign
    const campaignRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `CampZeo Boost: ${options.name}`,
            objective: options.objective,
            status: 'PAUSED', // Start paused to let user review in Ads Manager if needed
            access_token: options.accessToken
        })
    });
    const campaign = await campaignRes.json();
    if (!campaign.id) throw new Error(`Campaign creation failed: ${JSON.stringify(campaign)}`);

    // 2. Create Ad Set
    const adSetRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/adsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `AdSet for ${options.name}`,
            campaign_id: campaign.id,
            daily_budget: options.budget * 100, // Meta uses minor units (cents)
            billing_event: 'IMPRESSIONS',
            optimization_goal: options.objective === 'OUTCOME_LEAD_GENERATION' ? 'LEAD_GENERATION' : 'POST_ENGAGEMENT',
            targeting: options.targeting || { 'geo_locations': { 'countries': ['IN', 'US'] } },
            start_time: Math.floor((options.startTime?.getTime() || Date.now()) / 1000),
            end_time: Math.floor((options.startTime?.getTime() || Date.now()) / 1000) + (options.days * 86400),
            access_token: options.accessToken
        })
    });
    const adSet = await adSetRes.json();
    if (!adSet.id) throw new Error(`AdSet creation failed: ${JSON.stringify(adSet)}`);

    // 3. Create Ad Creative
    // For Instagram, we need to use instagram_story_id and instagram_actor_id
    // For Facebook, we use object_story_id
    const creativeBody: any = {
        name: `Creative for ${options.name}`,
        access_token: options.accessToken
    };

    if (options.instagramActorId) {
        // Instagram boost requires the numeric ID and the Instagram Actor ID
        creativeBody.instagram_story_id = options.postId;
        creativeBody.instagram_actor_id = options.instagramActorId;
    } else {
        // Facebook boost uses the Page Post ID (PAGEID_POSTID or numerical)
        creativeBody.object_story_id = options.postId;
    }

    const creativeRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/adcreatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creativeBody)
    });
    const creative = await creativeRes.json();
    if (!creative.id) throw new Error(`Creative creation failed: ${JSON.stringify(creative)}`);

    // 4. Create Ad
    const adRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `Ad for ${options.name}`,
            adset_id: adSet.id,
            creative: { creative_id: creative.id },
            status: 'ACTIVE',
            access_token: options.accessToken
        })
    });
    const ad = await adRes.json();

    return {
        campaignId: campaign.id,
        adSetId: adSet.id,
        adId: ad.id
    };
}

/**
 * Fetches reach estimates for a potential boosted post
 */
export async function getReachEstimate(options: {
    adAccountId: string,
    accessToken: string,
    budget: number,
    days: number,
    objective: 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEAD_GENERATION'
}) {
    const optimizationGoal = options.objective === 'OUTCOME_LEAD_GENERATION' ? 'LEAD_GENERATION' : 'POST_ENGAGEMENT';

    const params = new URLSearchParams({
        optimization_goal: optimizationGoal,
        targeting_spec: JSON.stringify({ geo_locations: { countries: ['IN', 'US'] } }), // Include IN and US
        access_token: options.accessToken
    });

    // Use delivery_estimate for budget-based predictions as reachestimate doesn't take daily_budget directly on ad accounts
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/delivery_estimate?${params.toString()}`);

    if (!response.ok) {
        const error = await response.json();
        console.error(`[Meta Ads Reach] API Error:`, error);
        throw new Error(`Failed to fetch reach estimate: ${JSON.stringify(error)}`);
    }

    const json = await response.json();
    console.log(`[Meta Ads Reach] Raw Response:`, JSON.stringify(json, null, 2));
    const curve = json.data?.[0]?.daily_outcomes_curve || [];

    if (curve.length === 0) return null;

    const budgetCents = options.budget * 100;

    // Find the two points between which our budget falls for interpolation
    let lowerPoint = curve[0];
    let upperPoint = curve[curve.length - 1];

    for (let i = 0; i < curve.length; i++) {
        if (curve[i].spend <= budgetCents) {
            lowerPoint = curve[i];
        }
        if (curve[i].spend >= budgetCents) {
            upperPoint = curve[i];
            break;
        }
    }

    let estimatedReach = 0;

    if (lowerPoint.spend === upperPoint.spend) {
        estimatedReach = lowerPoint.reach;
    } else {
        // Linear interpolation formula: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
        const budgetDiff = budgetCents - lowerPoint.spend;
        const spendDiff = upperPoint.spend - lowerPoint.spend;
        const reachDiff = upperPoint.reach - lowerPoint.reach;
        estimatedReach = lowerPoint.reach + (budgetDiff * reachDiff / spendDiff);
    }

    // Safety: if still 0 or very low, try to return a scaled value based on the closest non-zero point
    if (!estimatedReach || estimatedReach < 5) {
        const bestPoint = [...curve].reverse().find((p: any) => p.reach > 0);
        if (bestPoint && bestPoint.spend > 0) {
            estimatedReach = Math.floor((budgetCents / bestPoint.spend) * bestPoint.reach);
        }
    }

    // LAST RESORT: Synthetic estimate if API returns zeros or extremely low values
    if (!estimatedReach || estimatedReach < 5) {
        console.log('[Meta Ads Reach] API returned insufficient data, using updated synthetic estimate');
        // Based on average CPM of $10 ($10 = 1000 impressions = ~700 reach)
        // 1000 cents = 700 reach => 1 cent = 0.7 reach
        estimatedReach = Math.floor(budgetCents * 0.7);
    }

    return {
        users_reached_min: Math.floor((estimatedReach || 0) * 0.85),
        users_reached_max: Math.floor((estimatedReach || 0) * 1.15),
    };
}

/**
 * Subscribe Page to App Webhooks
 */
export async function subscribeAppToPage(pageId: string, accessToken: string) {
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/subscribed_apps`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            subscribed_fields: ['leadgen'],
            access_token: accessToken
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to subscribe app to page: ${JSON.stringify(error)}`);
    }

    return await response.json();
}

/**
 * Fetch detailed lead information from Lead ID
 */
export async function fetchMetaLeadDetails(leadId: string, accessToken: string) {
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${leadId}?fields=created_time,id,ad_id,form_id,field_data&access_token=${accessToken}`);

    if (!response.ok) {
        const error = await response.json();
        console.error(`[Meta Lead Fetch] Error:`, error);
        throw new Error(`Failed to fetch lead details: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    // Normalize field_data to a simple object
    const normalizedData: Record<string, string> = {};
    if (data.field_data && Array.isArray(data.field_data)) {
        data.field_data.forEach((field: { name: string, values: string[] }) => {
            normalizedData[field.name] = field.values[0] || '';
        });
    }

    return {
        ...data,
        normalizedData
    };
}

/**
 * Fetch all Facebook Pages the user manages
 */
export async function getFacebookPages(userAccessToken: string) {
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/me/accounts?fields=id,name,access_token,category,instagram_business_account&access_token=${userAccessToken}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch pages: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Fetches existing lead generation forms for a Facebook Page
 */
export async function getLeadForms(pageId: string, pageAccessToken: string): Promise<MetaLeadForm[]> {
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/leadgen_forms?fields=id,name,status&access_token=${pageAccessToken}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch lead forms: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Fetches leads for a specific form
 */
export async function getLeadsForForm(formId: string, pageAccessToken: string): Promise<any[]> {
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?fields=id,created_time,field_data&access_token=${pageAccessToken}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch leads: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Deletes a Campaign and its associated AdSets/Ads
 */
export async function deleteCampaign(campaignId: string, accessToken: string) {
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${campaignId}?access_token=${accessToken}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to delete campaign: ${JSON.stringify(error)}`);
    }

    return await response.json();
}

/**
 * Syncs a Meta lead to the local database
 * Note: Requires the 'Lead' model in schema.prisma
 */
export async function syncLeadToDatabase(organisationId: number, leadId: string, pageAccessToken: string, formId?: string) {
    try {
        const leadDetails = await fetchMetaLeadDetails(leadId, pageAccessToken);
        
        // Map common fields
        const email = leadDetails.normalizedData['email'] || leadDetails.normalizedData['work_email'] || '';
        const fullName = leadDetails.normalizedData['full_name'] || '';
        const phone = leadDetails.normalizedData['phone_number'] || '';

        // Upsert the Lead
        const lead = await prisma.lead.upsert({
            where: { metaLeadId: leadId },
            update: {
                data: leadDetails.normalizedData,
                updatedAt: new Date()
            },
            create: {
                organisationId,
                metaLeadId: leadId,
                formId: formId || leadDetails.form_id || '',
                data: leadDetails.normalizedData,
                status: 'NEW',
                createdAt: new Date(leadDetails.created_time || Date.now()),
            }
        });

        // Also create/update a Contact for the organization
        if (email || phone) {
            // Find existing contact by email or phone within the same organization
            const existingContact = await prisma.contact.findFirst({
                where: {
                    organisationId,
                    OR: [
                        email ? { contactEmail: email } : {},
                        phone ? { contactMobile: phone } : {}
                    ].filter(cond => Object.keys(cond).length > 0)
                }
            });

            if (existingContact) {
                await prisma.contact.update({
                    where: { id: existingContact.id },
                    data: {
                        contactName: fullName || existingContact.contactName,
                        contactMobile: phone || existingContact.contactMobile,
                        contactEmail: email || existingContact.contactEmail
                    }
                });
            } else {
                await prisma.contact.create({
                    data: {
                        organisationId,
                        contactName: fullName,
                        contactEmail: email,
                        contactMobile: phone,
                    }
                });
            }
        }


        return lead;
    } catch (error) {
        console.error(`[Meta Lead Sync] Error for lead ${leadId}:`, error);
        throw error;
    }
}


