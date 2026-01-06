import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from '@/lib/audit-logger';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone number validation (basic - digits, spaces, hyphens, parentheses, plus)
const PHONE_REGEX = /^[\d\s\-\+\(\)]+$/;

// Password validation: at least 8 characters, 1 uppercase, 1 lowercase, 1 number
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(req: Request) {
    try {
        const data = await req.json();

        if (!data.captchaToken) {
            return NextResponse.json({
                success: false,
                message: "CAPTCHA verification failed",
                errors: ["Please complete the CAPTCHA check"]
            }, { status: 400 });
        }

        const captchaVerification = await fetch(
            `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${data.captchaToken}`,
            { method: "POST" }
        );
        const captchaData = await captchaVerification.json();

        if (!captchaData.success) {
            return NextResponse.json({
                success: false,
                message: "CAPTCHA verification failed",
                errors: ["Invalid CAPTCHA"]
            }, { status: 400 });
        }

        // Remove captchaToken from data so it doesn't cause issues with Prisma/Validation
        delete data.captchaToken;

        // Validation errors array
        const errors: string[] = [];

        // 1. Validate required fields
        if (!data.name || data.name.trim() === '') {
            errors.push("Name is required");
        }
        if (!data.email || data.email.trim() === '') {
            errors.push("Email is required");
        }
        if (!data.organisationName || data.organisationName.trim() === '') {
            errors.push("Organisation name is required");
        }
        if (!data.mobile || data.mobile.trim() === '') {
            errors.push("Mobile number is required");
        }
        if (!data.address || data.address.trim() === '') {
            errors.push("Address is required");
        }
        if (!data.city || data.city.trim() === '') {
            errors.push("City is required");
        }
        if (!data.state || data.state.trim() === '') {
            errors.push("State is required");
        }
        if (!data.country || data.country.trim() === '') {
            errors.push("Country is required");
        }
        if (!data.postalCode || data.postalCode.trim() === '') {
            errors.push("Postal code is required");
        }
        if (!data.taxNumber || data.taxNumber.trim() === '') {
            errors.push("Tax number is required");
        }
        if (!data.enquiryText || data.enquiryText.trim() === '') {
            errors.push("Enquiry text is required");
        }

        // 2. Validate email format
        if (data.email && !EMAIL_REGEX.test(data.email.trim())) {
            errors.push("Invalid email format");
        }

        // 3. Validate password strength
        if (data.password && !PASSWORD_REGEX.test(data.password)) {
            errors.push("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number");
        }

        // 4. Validate name length
        if (data.name && data.name.trim().length < 2) {
            errors.push("Name must be at least 2 characters long");
        }
        if (data.name && data.name.trim().length > 100) {
            errors.push("Name must be less than 100 characters");
        }

        // 5. Validate organisation name length
        if (data.organisationName && data.organisationName.trim().length > 200) {
            errors.push("Organisation name must be less than 200 characters");
        }


        // 7. Validate mobile number format
        if (data.mobile && data.mobile.trim() !== '') {
            if (!PHONE_REGEX.test(data.mobile.trim())) {
                errors.push("Invalid mobile number format");
            }
            if (data.mobile.trim().length < 10 || data.mobile.trim().length > 20) {
                errors.push("Mobile number must be between 10 and 20 characters");
            }
        }

        // 8. Validate address length
        if (data.address && data.address.trim().length > 500) {
            errors.push("Address must be less than 500 characters");
        }

        // 9. Validate city length
        if (data.city && data.city.trim().length > 100) {
            errors.push("City must be less than 100 characters");
        }

        // 10. Validate state length
        if (data.state && data.state.trim().length > 100) {
            errors.push("State must be less than 100 characters");
        }

        // 11. Validate country length
        if (data.country && data.country.trim().length > 100) {
            errors.push("Country must be less than 100 characters");
        }

        // 12. Validate postal code length
        if (data.postalCode && (data.postalCode.trim().length < 3 || data.postalCode.trim().length > 10)) {
            errors.push("Postal code must be between 3 and 10 characters");
        }

        // 13. Validate tax number length
        if (data.taxNumber && data.taxNumber.trim().length > 50) {
            errors.push("Tax number must be less than 50 characters");
        }

        // 14. Validate enquiry text length (if provided)
        if (data.enquiryText && data.enquiryText.trim().length > 1000) {
            errors.push("Enquiry text must be less than 1000 characters");
        }

        // 15. Check for duplicate email
        if (data.email && EMAIL_REGEX.test(data.email.trim())) {
            const existingEnquiry = await prisma.enquiry.findFirst({
                where: {
                    email: data.email.trim().toLowerCase(),
                    isConverted: false
                }
            });
            if (existingEnquiry) {
                errors.push("An enquiry with this email already exists");
            }
        }

        // If there are validation errors, return them
        if (errors.length > 0) {
            return NextResponse.json({
                success: false,
                errors: errors,
                message: "Validation failed"
            }, { status: 400 });
        }

        // Create enquiry with validated data
        const enquiry = await prisma.enquiry.create({
            data: {
                name: data.name.trim(),
                organisationName: data.organisationName.trim(),
                mobile: data.mobile.trim(),
                email: data.email.trim().toLowerCase(),
                password: data.password,
                address: data.address.trim(),
                city: data.city.trim(),
                state: data.state.trim(),
                country: data.country.trim(),
                postalCode: data.postalCode.trim(),
                enquiryText: data.enquiryText?.trim() || null,
                taxNumber: data.taxNumber.trim()
            },
        });

        await logInfo("Enquiry created", { email: data.email, organisationName: data.organisationName });
        return NextResponse.json({ success: true, enquiry });
    } catch (error: any) {
        console.error("Enquiry creation error:", error);
        await logError("Failed to create enquiry", { userId: "Unknown" }, error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to create enquiry",
            message: "An error occurred while creating your enquiry"
        }, { status: 500 });
    }
}
