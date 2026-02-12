import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { 
    getFacebookPages, 
    getLeadForms, 
    getLeadsForForm, 
    subscribeAppToPage,
    syncLeadToDatabase 
} from "@/lib/meta-ads";
import { logError, logInfo } from "@/lib/audit-logger";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: {
                organisationId: true,
                facebookAccessToken: true
            }
        });

        if (!user || !user.facebookAccessToken) {
            return NextResponse.json({ error: "Facebook not connected" }, { status: 400 });
        }

        const orgId = user.organisationId;
        if (!orgId) return NextResponse.json({ error: "No organisation found" }, { status: 404 });

        // 1. Get all pages
        const pages = await getFacebookPages(user.facebookAccessToken);
        let leadsSynced = 0;

        for (const page of pages) {
            const pageAccessToken = page.access_token;
            const pageId = page.id;

            try {
                // 2. Subscribe to real-time leads (Webhook)
                try {
                    await subscribeAppToPage(pageId, pageAccessToken);
                    // Store the page ID and token in the user record
                    await prisma.user.update({
                        where: { clerkId: userId },
                        data: {
                            facebookPageId: pageId,
                            facebookPageAccessToken: pageAccessToken
                        }
                    });
                } catch (subError) {
                    console.warn(`[Sync] Non-blocking subscription error for page ${pageId}:`, subError);
                }

                // 3. Get forms for this page
                const forms = await getLeadForms(pageId, pageAccessToken);

                for (const form of forms) {
                    try {
                        // 4. Get leads for this form
                        const leads = await getLeadsForForm(form.id, pageAccessToken);

                        for (const leadData of leads) {
                            try {
                                // 5. Sync lead to database using unified logic
                                await syncLeadToDatabase(orgId, leadData.id, pageAccessToken, form.id);
                                leadsSynced++;
                            } catch (leadError) {
                                console.error(`Error syncing lead ${leadData.id}:`, leadError);
                            }
                        }
                    } catch (formError) {
                        console.error(`Error fetching leads for form ${form.id}:`, formError);
                    }
                }
            } catch (pageError) {
                console.error(`Error fetching forms for page ${pageId}:`, pageError);
            }
        }

        await logInfo("Leads synced manually", { userId, leadsSynced });
        return NextResponse.json({ success: true, leadsSynced });
    } catch (error) {
        await logError("Error syncing leads", { error: error instanceof Error ? error.message : "Unknown error" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}


