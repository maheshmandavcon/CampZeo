import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { logError, logWarning, logInfo } from '@/lib/audit-logger';

interface CSVRow {
    contactName?: string;
    contactEmail?: string;
    contactMobile?: string;
    contactWhatsApp?: string;
    campaigns?: string; // Comma-separated campaign names or IDs
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

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation (basic - adjust as needed)
const phoneRegex = /^\+?[\d\s\-()]+$/;

function validateEmail(email: string): boolean {
    return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
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
            }
        });

        rows.push(row);
    }

    return rows;
}

export async function POST(request: NextRequest) {
    try {
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

        // Get existing contacts to check for duplicates
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
        }> = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2; // +2 because of header row and 0-indexing
            let hasError = false;

            // Validate required fields (at least one contact method)
            if (!row.contactName && !row.contactEmail && !row.contactMobile) {
                result.errors.push({
                    row: rowNumber,
                    field: 'general',
                    message: 'At least one of name, email, or mobile is required',
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
                organisationId: dbUser.organisationId
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
    } catch (error: any) {
        console.error('Error importing contacts:', error);
        await logError("Failed to import contacts", { userId: "unknown" }, error);
        return NextResponse.json(
            { error: 'Failed to import contacts' },
            { status: 500 }
        );
    }
}
