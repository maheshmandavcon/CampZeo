import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getFacebookPages, getFacebookLeadForms, getFacebookLeads } from "@/lib/facebook";
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
                // 2. Get forms for this page
                const forms = await getFacebookLeadForms(pageId, pageAccessToken);

                for (const form of forms) {
                    try {
                        // 3. Get leads for this form
                        const leads = await getFacebookLeads(form.id, pageAccessToken);

                        for (const leadData of leads) {
                            // Normalize lead data fields (Meta returns field_data as an array)
                            const normalizedData: any = {};
                            if (leadData.field_data) {
                                leadData.field_data.forEach((field: any) => {
                                    normalizedData[field.name] = field.values[0];
                                });
                            }

                            // 4. Upsert lead
                            await prisma.lead.upsert({
                                where: { metaLeadId: leadData.id },
                                update: {
                                    data: normalizedData,
                                    updatedAt: new Date(),
                                    createdAt: new Date(leadData.created_time)
                                },
                                create: {
                                    organisationId: orgId,
                                    metaLeadId: leadData.id,
                                    formId: form.id,
                                    data: normalizedData,
                                    status: "NEW",
                                    createdAt: new Date(leadData.created_time)
                                }
                            });
                            leadsSynced++;
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
