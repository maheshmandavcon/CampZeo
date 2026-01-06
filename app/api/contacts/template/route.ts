import { NextResponse } from 'next/server';

export async function GET() {
    // CSV template with headers and sample data
    const csvContent = `contactName,contactEmail,contactMobile,contactWhatsApp,campaigns
John Doe,john.doe@example.com,+1234567890,+1234567890,Campaign1
Jane Smith,jane.smith@example.com,+0987654321,+0987654321,Campaign2
Bob Johnson,bob.johnson@example.com,+1122334455,,Campaign1;Campaign2`;

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="contacts_template.csv"'
        }
    });
}
