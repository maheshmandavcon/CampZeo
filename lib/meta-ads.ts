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
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/me/adaccounts?fields=name,account_id,account_status,currency,balance&access_token=${accessToken}`);

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
    const response = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}?fields=name,account_id,account_status,currency,balance&access_token=${accessToken}`);

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
    objective: 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEAD_GENERATION'
}) {
    // 1. Create Campaign
    const campaignRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `CampZeo Boost: ${options.name}`,
            objective: options.objective,
            status: 'PAUSED', // Start paused to let user review in Ads Manager if needed, or ACTIVE
            access_token: options.accessToken
        })
    });
    const campaign = await campaignRes.json();
    if (!campaign.id) throw new Error(`Campaign creation failed: ${JSON.stringify(campaign)}`);

    // 2. Create Ad Set
    // Using a broad relative targeting for simplicity in MVP
    const adSetRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/adsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `AdSet for ${options.name}`,
            campaign_id: campaign.id,
            daily_budget: options.budget * 100, // Meta uses minor units (cents)
            billing_event: 'IMPRESSIONS',
            optimization_goal: options.objective === 'OUTCOME_LEAD_GENERATION' ? 'LEAD_GENERATION' : 'POST_ENGAGEMENT',
            targeting: { 'geo_locations': { 'countries': ['US'] } }, // Default targeting, should be customizable later
            start_time: Math.floor(Date.now() / 1000),
            end_time: Math.floor(Date.now() / 1000) + (options.days * 86400),
            access_token: options.accessToken
        })
    });
    const adSet = await adSetRes.json();
    if (!adSet.id) throw new Error(`AdSet creation failed: ${JSON.stringify(adSet)}`);

    // 3. Create Ad Creative (pointing to the Page Post)
    const creativeRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${options.adAccountId}/adcreatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `Creative for ${options.name}`,
            object_story_id: options.postId,
            access_token: options.accessToken
        })
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
        targeting_spec: JSON.stringify({ geo_locations: { countries: ['US'] } }), // Default to US
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
    // Find point in curve closest to our budget
    const match = curve.find((p: any) => p.spend >= budgetCents) || curve[curve.length - 1];

    return {
        users_reached_min: Math.floor(match.reach * 0.8),
        users_reached_max: Math.floor(match.reach * 1.2),
    };
}
