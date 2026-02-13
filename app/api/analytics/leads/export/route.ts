import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";
import { getFacebookLeads, FacebookLead } from "@/lib/facebook";
import { withErrorHandling } from "@/lib/api-handler";
import * as XLSX from 'xlsx';

async function getHandler(req: NextRequest) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let orgId = -1;
    const impersonatedOrgId = await getImpersonatedOrganisationId();

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
    });

    if (!dbUser || !dbUser.organisationId) {
        return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
    }

    orgId = (dbUser.role === 'ADMIN_USER' && impersonatedOrgId) ? impersonatedOrgId : dbUser.organisationId;

    const { searchParams } = new URL(req.url);
    const boostedPostId = searchParams.get('boosted_post_id');
    const format = searchParams.get('format') || 'csv';

    if (!boostedPostId) {
        return NextResponse.json({ error: "Missing boosted_post_id" }, { status: 400 });
    }

    const fbToken = dbUser.facebookPageAccessToken || dbUser.facebookAccessToken;
    if (!fbToken) {
        return NextResponse.json({ error: "Facebook not connected" }, { status: 400 });
    }

    const leads = await getFacebookLeads(boostedPostId, fbToken);

    // Format leads for export
    const exportData = leads.map(lead => {
        const row: any = {
            'Lead ID': lead.id,
            'Timestamp': lead.created_time,
            'Ad Set Name': lead.adset_name || 'N/A',
            'Ad Name': lead.ad_name || 'N/A',
        };

        // Extract field data
        lead.field_data.forEach(field => {
            row[field.name] = field.values.join(', ');
        });

        return row;
    });

    if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Leads');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="leads_export_${boostedPostId}_${new Date().toISOString().split('T')[0]}.xlsx"`,
            },
        });
    } else {
        // CSV
        const ws = XLSX.utils.json_to_sheet(exportData);
        const csv = XLSX.utils.sheet_to_csv(ws);

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="leads_export_${boostedPostId}_${new Date().toISOString().split('T')[0]}.csv"`,
            },
        });
    }
}

export const GET = withErrorHandling(getHandler, "GET /api/analytics/leads/export", "getHandler");
