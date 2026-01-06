import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, subject, message, captchaToken } = body;

        if (!captchaToken) {
            return NextResponse.json(
                { error: "CAPTCHA verification failed" },
                { status: 400 }
            );
        }

        const captchaVerification = await fetch(
            `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
            { method: "POST" }
        );
        const captchaData = await captchaVerification.json();

        if (!captchaData.success) {
            return NextResponse.json(
                { error: "CAPTCHA verification failed" },
                { status: 400 }
            );
        }

        if (!name || !email || !subject || !message) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f8f9fa; padding: 20px; border-bottom: 1px solid #e0e0e0;">
                    <h2 style="margin: 0; color: #333;">New Contact Form Submission</h2>
                </div>
                <div style="padding: 20px;">
                    <p><strong>From:</strong> ${name} (${email})</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <div style="margin-top: 20px; padding: 15px; background-color: #fdfdfd; border-left: 4px solid #0070f3; color: #555;">
                        <p style="margin: 0; white-space: pre-wrap;">${message}</p>
                    </div>
                </div>
                <div style="padding: 15px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #777;">
                    <p style="margin: 0;">Sent via Campzeo Contact Form</p>
                </div>
            </div>
        `;

        // Send to office email
        const successOffice = await sendEmail({
            to: "surya@mandavconsultancy.com",
            subject: `Contact Form: ${subject}`,
            html: html,
            replyTo: email
        });



        if (successOffice) {
            return NextResponse.json({ success: true, message: "Message sent successfully" });
        } else {
            return NextResponse.json(
                { error: "Failed to send message via email service" },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Error in contact API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
