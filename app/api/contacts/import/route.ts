import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

import { withErrorHandling } from '@/lib/api-handler';
interface CSVRow {
    contactName?: string;
    contactEmail?: string;
    contactMobile?: string;
    contactWhatsApp?: string;
    campaigns?: string; // Comma-separated campaign names or IDs
    createdAt?: string;
}

interface ValidationError {
    row: number;
    field: string;
    message: string;
    data: CSVRow;
}

interface ImportResult {
    success: number;
    failed: number;
    duplicates: number;
    errors: ValidationError[];
}

const TEMPLATE_HEADERS = ['contactname', 'contactemail', 'contactmobile', 'contactwhatsapp', 'campaigns'];

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation (basic - adjust as needed)
const phoneRegex = /^\+[1-9]\d{0,2}[\d\s\-().]*$/;

function validateCSVFormat(csvText: string): { valid: boolean; message: string } {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        return { valid: false, message: 'CSV file is empty' };
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase().replace(/[\r"]/g, ''));

    const missingHeaders = TEMPLATE_HEADERS.filter(th => !headers.includes(th));
    if (missingHeaders.length > 0) {
        return {
            valid: false,
            message: `Wrong CSV format. Missing required columns: ${missingHeaders.join(', ')}. Please download and use the template CSV.`
        };
    }

    const extraHeaders = headers.filter(h => !TEMPLATE_HEADERS.includes(h));
    if (extraHeaders.length > 0) {
        return {
            valid: false,
            message: `Wrong CSV format. Unexpected columns found: ${extraHeaders.join(', ')}. Please download and use the template CSV.`
        };
    }

    return { valid: true, message: '' };
}

function validateEmail(email: string): boolean {
    return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return phoneRegex.test(phone) && digits.length >= 10 && digits.length <= 15;
}

function parseCSV(csvText: string): CSVRow[] {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v: string) => v.trim());
        const row: CSVRow = {};

        headers.forEach((header, index) => {
            const value = values[index] || '';

            // Map common header variations
            if (header.includes('name')) {
                row.contactName = value;
            } else if (header.includes('email')) {
                row.contactEmail = value;
            } else if (header.includes('mobile') || header.includes('phone')) {
                row.contactMobile = value;
            } else if (header.includes('whatsapp')) {
                row.contactWhatsApp = value;
            } else if (header.includes('campaign')) {
                row.campaigns = value;
            } else if (header.includes('createdat') || header.includes('date')) {
                row.createdAt = value;
            }
        });

        rows.push(row);
    }

    return rows;
}

async function postHandler(request: NextRequest) {

    const user = await currentUser();
    if (!user) {
        await logWarning("Unauthorized access attempt to import contacts", { action: "import-contacts" });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { organisationId: true }
    });

    if (!dbUser?.organisationId) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const csvText = await file.text();

    const formatValidation = validateCSVFormat(csvText);
    if (!formatValidation.valid) {
        return NextResponse.json({ error: formatValidation.message }, { status: 400 });
    }

    const rows = parseCSV(csvText);

    if (rows.length === 0) {
        return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    const result: ImportResult = {
        success: 0,
        failed: 0,
        duplicates: 0,
        errors: []
    };

    const existingContacts = await prisma.contact.findMany({
        where: { organisationId: dbUser.organisationId },
        select: { contactEmail: true, contactMobile: true }
    });

    const existingEmails = new Set(
        existingContacts.map((c: any) => c.contactEmail?.toLowerCase()).filter(Boolean)
    );
    const existingMobiles = new Set(
        existingContacts.map((c: any) => c.contactMobile).filter(Boolean)
    );

    // Validate and prepare contacts for import
    const validContacts: Array<{
        contactName: string | null;
        contactEmail: string | null;
        contactMobile: string | null;
        contactWhatsApp: string | null;
        organisationId: number;
        createdAt?: Date;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // +2 because of header row and 0-indexing
        let hasError = false;

        if (!row.contactName || !row.contactName.trim()) {
            result.errors.push({
                row: rowNumber,
                field: 'contactName',
                message: 'Contact name is required',
                data: row
            });
            result.failed++;
            continue;
        }

        if (!row.contactMobile || !row.contactMobile.trim()) {
            result.errors.push({
                row: rowNumber,
                field: 'contactMobile',
                message: 'Mobile number is required',
                data: row
            });
            result.failed++;
            continue;
        }

        // Validate email format
        if (row.contactEmail && !validateEmail(row.contactEmail)) {
            result.errors.push({
                row: rowNumber,
                field: 'contactEmail',
                message: 'Invalid email format',
                data: row
            });
            hasError = true;
        }

        // Validate phone format
        if (row.contactMobile && !validatePhone(row.contactMobile)) {
            result.errors.push({
                row: rowNumber,
                field: 'contactMobile',
                message: 'Invalid phone number format',
                data: row
            });
            hasError = true;
        }

        if (row.contactWhatsApp && !validatePhone(row.contactWhatsApp)) {
            result.errors.push({
                row: rowNumber,
                field: 'contactWhatsApp',
                message: 'Invalid WhatsApp number format',
                data: row
            });
            hasError = true;
        }

        // Check for duplicates
        const isDuplicateEmail = row.contactEmail &&
            existingEmails.has(row.contactEmail.toLowerCase());
        const isDuplicateMobile = row.contactMobile &&
            existingMobiles.has(row.contactMobile);

        if (isDuplicateEmail || isDuplicateMobile) {
            result.errors.push({
                row: rowNumber,
                field: isDuplicateEmail ? 'contactEmail' : 'contactMobile',
                message: 'Duplicate contact already exists',
                data: row
            });
            result.duplicates++;
            continue;
        }

        if (hasError) {
            result.failed++;
            continue;
        }

        // Add to valid contacts
        validContacts.push({
            contactName: row.contactName || null,
            contactEmail: row.contactEmail || null,
            contactMobile: row.contactMobile || null,
            contactWhatsApp: row.contactWhatsApp || null,
            organisationId: dbUser.organisationId,
            ...(row.createdAt && { createdAt: new Date(row.createdAt) })
        });
    }

    // Bulk insert valid contacts
    if (validContacts.length > 0) {
        // Process in chunks of 100 to avoid overwhelming the database
        const chunkSize = 100;
        for (let i = 0; i < validContacts.length; i += chunkSize) {
            const chunk = validContacts.slice(i, i + chunkSize);
            await prisma.contact.createMany({
                data: chunk,
                skipDuplicates: true
            });
        }
        result.success = validContacts.length;
    }

    await logInfo("Contacts imported", { success: result.success, failed: result.failed, duplicates: result.duplicates, importedBy: user.id });
    return NextResponse.json(result);

}

export const POST = withErrorHandling(postHandler, "POST /api/contacts/import");
