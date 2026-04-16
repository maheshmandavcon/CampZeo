"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as htmlToImage from "html-to-image";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Star, ArrowRight, Sparkles, Check, Download, FileText } from "lucide-react";
import { useSignUp, useSignIn, useClerk, useUser } from "@clerk/nextjs";
import { usePlans } from "@/hooks/use-plans";
import { formatPrice } from "@/lib/plans";
import { RazorpayButton } from "@/components/razorpay-button";
import { countries } from "@/lib/countries";
import { Eye, EyeOff } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const BLOCKED_DOMAINS = new Set([
    "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
    "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
    "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf",

    "mailinator.com", "mailinator2.com", "trashmail.com",
    "trashmail.me", "trashmail.net", "trashmail.at",
    "trashmail.io", "trashmail.xyz",

    "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info",
    "grr.la", "spam4.me",

    "10minutemail.com", "10minutemail.net", "10minutemail.org",
    "10minemail.com", "tempr.email", "discard.email",

    "throwam.com", "throwaway.email", "throwam.com",
    "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",

    "tempmail.com", "tempmail.net", "tempmail.org",
    "temp-mail.org", "temp-mail.ru", "tempinbox.com",
    "tempemail.com", "tempemail.net", "fakeinbox.com",
    "fakeinbox.net", "mailnull.com", "spamex.com",
    "mailexpire.com", "spamfree24.org", "spamfree.eu",

    "sharklasers.com", "guerrillamailblock.com", "grr.la",
    "guerrillamail.info", "spam4.me", "yopmail.pp.ua",

    "maildrop.cc", "dispostable.com", "mailnesia.com",
    "spamgob.com", "mailzilla.com", "trashdevil.com",
    "trashdevil.de", "wegwerfmail.de", "wegwerfmail.net",
    "wegwerfmail.org", "spamzy.com", "spamspot.com",
]);

const BLOCKED_TLDS = new Set([
    "xyz", "gq", "ml", "cf", "tk", "ga",
]);

export function validateEmail(email: string): {
    valid: boolean;
    error?: string;
} {
    if (!email || typeof email !== "string") {
        return { valid: false, error: "Email is required" };
    }

    const trimmed = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: "Invalid email format" };
    }

    const [localPart, domain] = trimmed.split("@");

    if (localPart.length < 2) {
        return { valid: false, error: "Invalid email address" };
    }

    const tld = domain.split(".").pop() ?? "";

    if (BLOCKED_TLDS.has(tld)) {
        return { valid: false, error: "Email domain not allowed" };
    }

    if (BLOCKED_DOMAINS.has(domain)) {
        return { valid: false, error: "Disposable email addresses are not allowed" };
    }

    const isBlockedSubdomain = [...BLOCKED_DOMAINS].some(
        (blocked) => domain.endsWith(`.${blocked}`) || domain === blocked
    );
    if (isBlockedSubdomain) {
        return { valid: false, error: "Disposable email addresses are not allowed" };
    }

    return { valid: true };
}
function PurchaseContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isLoaded, signUp, setActive } = useSignUp();
    // We use useSignIn to check if user already exists
    const { signIn } = useSignIn();
    const { plans, isLoading: plansLoading } = usePlans();
    const clerk = useClerk();
    const { user, isLoaded: userLoaded, isSignedIn } = useUser();
    const [emailError, setEmailError] = useState<string | null>(null);

    const [step, setStep] = useState<"DETAILS" | "VERIFICATION" | "PAYMENT" | "SUCCESS">("DETAILS");
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [otp, setOtp] = useState("");
    const [invoice, setInvoice] = useState<any>(null);

    const [accountType, setAccountType] = useState<"business" | "individual">("business");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);

    type LocationOption = {
        city: string;
        state: string;
        country: string;
        countryCode: string;
        display: string;
    };

    const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
    const [showLocationSelector, setShowLocationSelector] = useState(false);
    const [postalOptions, setPostalOptions] = useState<LocationOption[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [isDownloading, setIsDownloading] = useState(false);
    const invoiceRef = useRef<HTMLDivElement>(null);

    const handleDownloadInvoice = async () => {
        if (!invoiceRef.current) return;

        try {
            setIsDownloading(true);

            const dataUrl = await htmlToImage.toPng(invoiceRef.current, {
                pixelRatio: 2,
                backgroundColor: "#ffffff",
                filter: (node) => {
                    return node.getAttribute?.('data-html2canvas-ignore') !== 'true';
                }
            });

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const margin = 10;
            const contentWidth = pageWidth - margin * 2;
            const contentHeight = pageHeight - margin * 2;

            const elWidth = invoiceRef.current.offsetWidth;
            const elHeight = invoiceRef.current.offsetHeight;
            const elAspectRatio = elHeight / elWidth;

            let imgWidth = contentWidth;
            let imgHeight = contentWidth * elAspectRatio;

            if (imgHeight > contentHeight) {
                imgHeight = contentHeight;
                imgWidth = contentHeight / elAspectRatio;
            }

            const xOffset = margin + (contentWidth - imgWidth) / 2;

            pdf.addImage(dataUrl, "PNG", xOffset, margin, imgWidth, imgHeight);
            pdf.save(`invoice-${invoice?.invoiceNumber || "purchase"}.pdf`);

        } catch (error) {
            console.error("Error downloading invoice:", error);
            toast.error("Could not generate invoice. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };
    // Data for Organization Creation
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        name: "", // Owner Name
        organisationName: "",
        mobile: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        taxNumber: "",
    });

    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

    // Auto-fill email if user is signed in
    useEffect(() => {
        if (isSignedIn && user?.primaryEmailAddress?.emailAddress && !formData.email) {
            setFormData(prev => ({
                ...prev,
                email: user.primaryEmailAddress!.emailAddress
            }));
        }
    }, [isSignedIn, user, formData.email]);

    useEffect(() => {
        if (plans.length > 0 && !selectedPlanId) {
            const planIdParam = searchParams.get("planId");
            if (planIdParam) {
                // Try to find by ID first (assuming ID matches, or name matches?)
                // The plan hook returns numerical IDs mostly, but params might be strings?
                // Let's assume passed planId is the numerical ID or name?
                // Actually typical flow might be passing the ID.
                const found = plans.find(p => p.id.toString() === planIdParam || p.name === planIdParam);
                if (found) setSelectedPlanId(found.id);
            } else {
                // Default to a paid plan if available, or first one
                const professional = plans.find(p => p.name === "Professional");
                if (professional) setSelectedPlanId(professional.id);
            }
        }
    }, [plans, searchParams, selectedPlanId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let filteredValue = value;

        if (name === "postalCode") {
            filteredValue = value.replace(/[^a-zA-Z0-9\s-]/g, "");
        } else if (name === "mobile") {
            filteredValue = value.replace(/[^0-9+\s\(\)-]/g, "");
        }

        setFormData(prev => ({ ...prev, [name]: filteredValue }));

        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    // Pincode Auto-Detection
    useEffect(() => {
        const detectLocation = async () => {
            const { postalCode, country } = formData;
            if (!postalCode || postalCode.length < 3) {
                setPostalOptions([]);
                return;
            }

            setPostalOptions([]);
            setIsDetecting(true);

            try {
                const currentCountry = countries.find(c => c.name === country);
                const countryParam = currentCountry ? `&country=${encodeURIComponent(currentCountry.name)}` : "";

                // 1. Primary: Nominatim (Global)
                const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}${countryParam}&format=json&addressdetails=1`;
                const res = await fetch(url, {
                    headers: {
                        'Accept-Language': 'en-US,en;q=0.9',
                        'User-Agent': 'Campzeo/1.0 (Purchase Pincode Detection)'
                    }
                });

                let options: LocationOption[] = [];

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        options = data.map((item: any) => {
                            const addr = item.address;
                            const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || addr.district || addr.suburb || addr.state_district || "";
                            const state = addr.state || addr.province || addr.county || "";
                            const detectedCountryCode = addr.country_code?.toUpperCase();
                            const matchedCountry = countries.find(c => c.code === detectedCountryCode);

                            return {
                                city,
                                state,
                                country: matchedCountry ? matchedCountry.name : (addr.country || ""),
                                countryCode: detectedCountryCode,
                                display: `${city}${city && state ? ', ' : ''}${state}${(city || state) && (addr.country) ? ', ' : ''}${addr.country || (matchedCountry ? matchedCountry.name : '')}`
                            };
                        }).filter((opt: any) => opt.city && opt.state);
                    }
                }

                if (options.length === 0 && postalCode.length === 6 && (!country || country === "India") && /^\d+$/.test(postalCode)) {
                    const resIN = await fetch(`https://api.postalpincode.in/pincode/${postalCode}`);
                    const dataIN = await resIN.json();
                    if (dataIN[0]?.Status === "Success") {
                        const offices = dataIN[0].PostOffice;
                        options = Array.from(new Set(offices.map((o: any) => `${o.District}|${o.State}`)))
                            .map(loc => {
                                const [district, state] = (loc as string).split('|');
                                return {
                                    city: district,
                                    state: state,
                                    country: "India",
                                    countryCode: "IN",
                                    display: `${district}, ${state}, India`
                                };
                            });
                    }
                }

                // 3. Apply results
                if (options.length === 1) {
                    const opt = options[0];
                    setFormData(prev => ({
                        ...prev,
                        city: opt.city,
                        state: opt.state,
                        country: opt.country || prev.country
                    }));
                } else if (options.length > 1) {
                    setPostalOptions(options);
                }
            } catch (error) {
                console.error("Pincode detection error:", error);
            } finally {
                setIsDetecting(false);
            }
        };

        const debounce = setTimeout(detectLocation, 600);
        return () => clearTimeout(debounce);
    }, [formData.postalCode, formData.country]);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        // 1. Check required fields
        const requiredFields: Record<string, string> = {
            email: "Email",
            name: "Owner Name",
            mobile: "Mobile Number",
            address: "Address",
            city: "City",
            state: "State",
            country: "Country",
            postalCode: "Postal Code",
        };

        if (!isSignedIn) {
            requiredFields.password = "Password";
            requiredFields.confirmPassword = "Confirm Password";
        }

        if (accountType === 'business') {
            requiredFields.organisationName = "Organisation Name";
            requiredFields.taxNumber = "GST / Tax Number";
        }

        Object.entries(requiredFields).forEach(([field, label]) => {
            const val = formData[field as keyof typeof formData];
            if (!val || (typeof val === 'string' && val.trim() === "")) {
                newErrors[field] = `${label} is required`;
            }
        });

        // 2. Email validation
        const emailValidation = validateEmail(formData.email);
        if (formData.email && !emailValidation.valid) {
            newErrors.email = emailValidation.error || "Invalid email format";
        }

        // 3. Mobile validation
        const digits = formData.mobile.replace(/\D/g, '');
        if (formData.mobile && (digits.length < 10 || digits.length > 15)) {
            newErrors.mobile = "Mobile Number must contain 10-15 digits";
        }

        // 4. Password validation
        if (!isSignedIn) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            if (formData.password && !passwordRegex.test(formData.password)) {
                newErrors.password = "Min 8 chars, 1 uppercase, 1 lowercase, 1 number";
            }
            if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = "Passwords do not match";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle Initial Sign Up
    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error("Validation Failed", {
                description: "Please fill in all required fields correctly.",
            });
            return;
        }

        setLoading(true);

        try {
            // Check email availability before proceeding
            const checkRes = await fetch('/api/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email.trim() }),
            });
            const checkData = await checkRes.json();
            if (checkData.isSuccess && checkData.exists) {
                setEmailError(checkData.message);

                toast.error("Email Already In Use", {

                    description: checkData.message,
                });
                setLoading(false);
                return;
            }

            // We bypass Clerk sign up and email verification during checkout entirely.
            // The Clerk user and database records will be generated in bulk
            // post successful Razorpay payment, just like the admin convert-enquiry flow.
            setStep("PAYMENT");
        } catch (err: any) {
            console.error("Navigation error:", err);
            toast.error("An error occurred moving to payment.");
        } finally {
            setLoading(false);
        }
    };

    // Handle Verification
    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;
        setVerifying(true);

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code: otp,
            });

            if (completeSignUp.status !== "complete") {
                console.log(JSON.stringify(completeSignUp, null, 2));
                toast.error("Verification invalid.");
            } else {
                if (completeSignUp.createdSessionId) {
                    await setActive({ session: completeSignUp.createdSessionId });
                    toast.success("Account verified!");
                    // Move to Payment step
                    setStep("PAYMENT");
                }
            }
        } catch (err: any) {
            console.error("Verification error:", err);

            // Handle "already verified" error gracefully
            if (err.errors?.[0]?.code === "verification_already_verified") {
                // It's already verified, check if we can complete
                if (signUp.status === "complete" && signUp.createdSessionId) {
                    await setActive({ session: signUp.createdSessionId });
                    setStep("PAYMENT");
                    return;
                }
            }

            toast.error(err.errors?.[0]?.message || "Verification failed");
        } finally {
            setVerifying(false);
        }
    };

    // Handle Organisation Creation (After Payment or for Free Trial)
    const createOrganisation = async (paymentData?: any) => {
        try {
            // We need to re-fetch plan details
            const selectedPlan = plans.find(p => p.id === selectedPlanId);

            const response = await fetch("/api/organisations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organizationName: accountType === 'individual' ? formData.name : formData.organisationName,
                    email: formData.email,
                    password: formData.password,
                    ownerName: formData.name,
                    phone: formData.mobile,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    country: formData.country,
                    postalCode: formData.postalCode,
                    taxNumber: accountType === 'individual' ? (formData.taxNumber || "N/A") : formData.taxNumber,
                    plan: selectedPlan?.name || "FREE_TRIAL",
                    planId: selectedPlanId,
                    paymentData
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create organisation");
            }

            if (data.invoice) {
                setInvoice(data.invoice);
            }

            if (!isSignedIn && formData.email && formData.password && signIn) {
                try {
                    const result = await signIn.create({
                        identifier: formData.email,
                        password: formData.password,
                    });
                    if (result.status === "complete") {
                        await clerk.setActive({ session: result.createdSessionId });
                    }
                } catch (signInErr) {
                    console.error("Auto sign-in failed:", signInErr);
                }
            }

            toast.success("Account created successfully!");
            setStep("SUCCESS");

        } catch (err: any) {
            console.error("Org creation error:", err);
            toast.error(err.message || "Failed to setup organisation.");
        }
    };

    // Skip payment for free trial or 0 price
    useEffect(() => {
        if (step === "PAYMENT" && plans.length > 0 && selectedPlanId) {
            const plan = plans.find(p => p.id === selectedPlanId);
            if (plan && plan.price === 0) {
                // Auto create for free plan
                createOrganisation();
            }
        }
    }, [step, plans, selectedPlanId]);


    const selectedPlan = plans.find(p => p.id === selectedPlanId);

    return (
        <div className="min-h-screen w-full flex bg-background">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-neutral-900 border-r border-neutral-800 flex-col justify-between p-12 overflow-hidden">
                {/* Background Gradients */}
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-neutral-950 -z-10" />
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <Link href="/" className="flex items-center gap-2 mb-8">
                        <div className="bg-white p-1 rounded">
                            <img src="/logo-1.png" alt="CampZeo" className="h-8" />
                        </div>
                    </Link>

                    <div className="space-y-6 max-w-lg mt-20">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.1]">
                            Start your journey <br />
                            <span className="text-primary">with Campzeo.</span>
                        </h1>
                        <p className="text-lg text-neutral-400 leading-relaxed">
                            Professional tools for social media management, analytics, and growth.
                        </p>
                        {selectedPlan && (
                            <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                                <h3 className="text-xl font-semibold text-white mb-2">Selected Plan: {selectedPlan.name}</h3>
                                <div className="text-3xl font-bold text-primary mb-4">{formatPrice(selectedPlan.price, "INR")}<span className="text-sm text-neutral-400 font-normal">/{selectedPlan.billingCycle || 'month'}</span></div>
                                <ul className="space-y-2">
                                    {selectedPlan.features.slice(0, 4).map((f, i) => (
                                        <li key={i} className="flex gap-2 text-sm text-neutral-300">
                                            <CheckCircle2 className="size-4 text-primary shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div ref={invoiceRef} className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto w-full">
                <div className="w-full max-w-xl space-y-8">

                    {/* Header */}
                    <div className="space-y-2 text-center">
                        <h2 className="text-3xl font-bold tracking-tight">
                            {step === "DETAILS" && "Create your account"}
                            {step === "VERIFICATION" && "Verify your email"}
                            {step === "PAYMENT" && "Complete Payment"}
                            {step === "SUCCESS" && "Welcome to CampZeo!"}
                        </h2>
                        <p className="text-muted-foreground">
                            {step === "DETAILS" && "Enter your details to get started."}
                            {step === "VERIFICATION" && `We sent a code to ${formData.email}`}
                            {step === "PAYMENT" && "Securely complete your purchase."}
                            {step === "SUCCESS" && "Your account has been set up successfully."}
                        </p>
                    </div>

                    {step === "DETAILS" && (
                        <form onSubmit={handleSignUp} className="space-y-6">
                            <div className="space-y-2">
                                <Label>Account Type</Label>
                                <Tabs
                                    defaultValue="business"
                                    className="w-full"
                                    onValueChange={(v) => setAccountType(v as "business" | "individual")}
                                >
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="business">Business</TabsTrigger>
                                        <TabsTrigger value="individual">Individual</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {accountType === "business" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="organisationName">Organisation Name <span className="text-destructive">*</span></Label>
                                        <Input
                                            id="organisationName"
                                            name="organisationName"
                                            value={formData.organisationName}
                                            onChange={handleChange}
                                            placeholder="Acme Inc."
                                            className={`h-10 ${errors.organisationName ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                        />
                                        {errors.organisationName && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.organisationName}</p>}
                                    </div>
                                )}
                                <div className={accountType === "individual" ? "col-span-1 md:col-span-2 space-y-2" : "space-y-2"}>
                                    <Label htmlFor="name">Owner Name <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="John Doe"
                                        className={`h-10 ${errors.name ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                    />
                                    {errors.name && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => { handleChange(e); setEmailError(null); }}
                                        placeholder="john@example.com"
                                        className={`h-10 ${(emailError || errors.email) ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                    />
                                    {(emailError || errors.email) && <p className="text-red-500 text-xs font-medium px-1 mt-1">{emailError || errors.email}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mobile">Mobile <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="mobile"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        placeholder="+1 234 567 8900"
                                        className={`h-10 ${errors.mobile ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                    />
                                    {errors.mobile && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.mobile}</p>}
                                </div>

                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <Label htmlFor="address">Address <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="address"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className={`h-10 ${errors.address ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                    />
                                    {errors.address && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.address}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="postalCode">Postal Code <span className="text-destructive">*</span></Label>
                                        <Input
                                            id="postalCode"
                                            name="postalCode"
                                            value={formData.postalCode}
                                            onChange={handleChange}
                                            className={`h-10 ${errors.postalCode ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                        />
                                        {errors.postalCode && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.postalCode}</p>}

                                        {postalOptions.length > 0 && (
                                            <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                                <p className="text-xs font-medium text-primary mb-2">Multiple locations found. Please select one:</p>
                                                <Select
                                                    onValueChange={(val) => {
                                                        const selected = postalOptions.find(opt => opt.display === val);
                                                        if (selected) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                city: selected.city,
                                                                state: selected.state,
                                                                country: selected.country
                                                            }));
                                                            setPostalOptions([]);
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-9 text-xs bg-background">
                                                        <SelectValue placeholder="Select correct location..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {postalOptions.map((opt, idx) => (
                                                            <SelectItem key={idx} value={opt.display} className="text-xs">
                                                                {opt.display}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                                        <div className="relative">
                                            <Input
                                                id="city"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleChange}
                                                className={`h-10 pr-10 ${errors.city ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                            />
                                            {errors.city && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.city}</p>}
                                            {isDetecting && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
                                        <div className="relative">
                                            <Input
                                                id="state"
                                                name="state"
                                                value={formData.state}
                                                onChange={handleChange}
                                                className={`h-10 pr-10 ${errors.state ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                            />
                                            {errors.state && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.state}</p>}
                                            {isDetecting && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                                        <Select
                                            name="country"
                                            onValueChange={(v) => handleSelectChange("country", v)}
                                            value={formData.country}
                                        >
                                            <SelectTrigger className={`border h-10 ${errors.country ? 'border-red-500 ring-red-500 ring-1' : 'border-gray-200'}`}>
                                                <SelectValue placeholder="Select Country" />
                                            </SelectTrigger>
                                            {errors.country && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.country}</p>}
                                            <SelectContent>
                                                {countries.map((c) => (
                                                    <SelectItem key={c.code} value={c.name}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                </div>

                                {accountType === "business" && (
                                    <div className="col-span-1 md:col-span-2 space-y-2">
                                        <Label htmlFor="taxNumber">Tax Number / GST <span className="text-destructive">*</span></Label>
                                        <Input
                                            id="taxNumber"
                                            name="taxNumber"
                                            value={formData.taxNumber}
                                            onChange={handleChange}
                                            placeholder="GSTIN/TAX ID"
                                            className={`h-10 ${errors.taxNumber ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                        />
                                        {errors.taxNumber && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.taxNumber}</p>}
                                    </div>
                                )}

                                {!isSignedIn && (
                                    <>
                                        <div className="col-span-1 md:col-span-2 space-y-2">
                                            <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                                            <div className="relative">
                                                <Input
                                                    id="password"
                                                    name="password"
                                                    type={showPassword ? "text" : "password"}
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    className={`h-10 pr-10 ${errors.password ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {errors.password && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.password}</p>}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="col-span-1 md:col-span-2 space-y-2">
                                            <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                                            <div className="relative">
                                                <Input
                                                    id="confirmPassword"
                                                    name="confirmPassword"
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    className={`h-10 pr-10 ${errors.confirmPassword ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {errors.confirmPassword && <p className="text-red-500 text-xs font-medium px-1 mt-1">{errors.confirmPassword}</p>}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Min 8 chars, 1 uppercase, 1 lowercase, 1 number.</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <Button type="submit" className="w-full" size="lg" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : "Continue"}
                            </Button>

                            {!isSignedIn && (
                                <p className="text-xs text-center text-muted-foreground">
                                    Already have an account? <Link href="/sign-in" className="underline">Sign In</Link>
                                </p>
                            )}
                        </form>
                    )}

                    {step === "VERIFICATION" && (
                        <form onSubmit={handleVerification} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="otp">Verification Code</Label>
                                <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" className="text-center text-2xl tracking-widest letter-spacing-2" maxLength={6} />
                            </div>
                            <Button type="submit" className="w-full" size="lg" disabled={verifying}>
                                {verifying ? <Loader2 className="animate-spin" /> : "Verify Account"}
                            </Button>
                        </form>
                    )}

                    {step === "PAYMENT" && selectedPlan && selectedPlan.price > 0 && (
                        <div className="space-y-6">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="font-semibold">Plan Amount</span>
                                        <span className="text-xl font-bold">{formatPrice(selectedPlan.price, "INR")}</span>
                                    </div>
                                    <div className="text-sm text-neutral-500 mb-6">
                                        You are purchasing the <strong>{selectedPlan.name}</strong> plan for <strong>{formData.organisationName}</strong>.
                                    </div>

                                    <RazorpayButton
                                        plan={selectedPlan.name}
                                        amount={selectedPlan.price}
                                        organizationName={formData.organisationName || formData.name}
                                        isSignup={true} // Important to redirect correctly or handle flow
                                        prefillName={formData.name}
                                        prefillEmail={formData.email}
                                        onSuccess={createOrganisation}
                                        className="w-full h-12 text-lg"
                                    >
                                        Pay Securely with Razorpay
                                    </RazorpayButton>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {step === "PAYMENT" && (!selectedPlan || selectedPlan.price === 0) && (
                        <div className="flex flex-col items-center space-y-4">
                            <Loader2 className="size-10 animate-spin text-primary" />
                            <p>Setting up your free account...</p>
                        </div>
                    )}


                    {step === "SUCCESS" && (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                            <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
                                <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center">
                                    <Check className="h-8 w-8 text-green-600" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold tracking-tight">Payment Successful!</h3>
                                    <p className="text-muted-foreground max-w-sm mx-auto">
                                        Your account is ready. Organization <strong>{formData.organisationName || formData.name}</strong> has been created.
                                    </p>
                                </div>
                            </div>

                            {invoice && (
                                <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border overflow-hidden" ref={invoiceRef}>
                                    <div className="p-8 md:p-12">
                                        <div className=" mx-auto relative">
                                            {/* Status Watermark */}
                                            {invoice.status !== 'PAID' && (
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-10 border-4 border-red-500 text-red-500 text-9xl font-black uppercase p-4 rounded-xl whitespace-nowrap z-0">
                                                    {invoice.status}
                                                </div>
                                            )}

                                            {/* Header Section */}
                                            <div className="flex justify-between items-start mb-12 relative z-10">
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            src="/logo-1.png"
                                                            alt="CampZeo"
                                                            className="h-12 w-auto object-contain"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="text-sm text-slate-500 max-w-[200px]">
                                                        <p>123 Innovation Drive</p>
                                                        <p>Tech City, TC 90210</p>
                                                        <p>support@campzeo.com</p>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <h1 className="text-4xl font-light text-slate-300 tracking-widest uppercase mb-2">Invoice</h1>
                                                    <p className="font-mono text-lg font-medium text-slate-700">#{invoice.invoiceNumber}</p>
                                                    <div className="mt-4">
                                                        <span className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${invoice.status === 'PAID' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                                            invoice.status === 'PENDING' ? 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/20' :
                                                                'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                                                            }`}>
                                                            {invoice.status || 'PAID'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <hr className="border-slate-100 mb-12" />

                                            {/* Client & Dates Grid */}
                                            <div className="grid grid-cols-2 gap-12 mb-12 relative z-10 text-left">
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Bill To</h3>
                                                    <div className="text-slate-900 font-bold text-lg mb-1">{formData.organisationName || formData.name}</div>
                                                    <div className="text-slate-600 text-sm space-y-1">
                                                        {formData.address ? <p>{formData.address}</p> : <p className="text-slate-400 italic">No address provided</p>}
                                                        {(formData.city || formData.state || formData.postalCode) && (
                                                            <p>{[formData.city, formData.state, formData.postalCode].filter(Boolean).join(', ')}</p>
                                                        )}
                                                        {formData.country && <p>{formData.country}</p>}
                                                        {formData.email && <p className="text-indigo-600 mt-2">{formData.email}</p>}
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                                        <span className="text-slate-500 text-sm">Invoice Date</span>
                                                        <span className="font-medium text-slate-900">{new Date(invoice.invoiceDate || Date.now()).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                                        <span className="text-slate-500 text-sm">Due Date</span>
                                                        <span className="font-medium text-slate-900">{new Date(invoice.dueDate || Date.now()).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                                        <span className="text-slate-500 text-sm">Payment Method</span>
                                                        <span className="font-medium capitalize text-slate-900">Razorpay</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Line Items Table */}
                                            <div className="mb-12 relative z-10">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-y border-slate-200">
                                                            <th className="py-4 pl-4 text-left font-semibold text-slate-700 text-sm uppercase tracking-wide w-2/3">Description</th>
                                                            <th className="py-4 pr-4 text-right font-semibold text-slate-700 text-sm uppercase tracking-wide w-1/3">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        <tr>
                                                            <td className="py-6 pl-4 text-left">
                                                                <p className="font-bold text-slate-900">{invoice.description || "Subscription Plan"}</p>
                                                                <p className="text-sm text-slate-500 mt-1">
                                                                    Premium Subscription Plan
                                                                </p>
                                                            </td>
                                                            <td className="py-6 pr-4 text-right font-mono text-slate-700">
                                                                {formatPrice(Number(invoice.amount), invoice.currency)}
                                                            </td>
                                                        </tr>
                                                        {Number(invoice.taxAmount) > 0 && (
                                                            <tr>
                                                                <td className="py-6 pl-4 text-left">
                                                                    <p className="font-medium text-slate-900">Tax / VAT</p>
                                                                </td>
                                                                <td className="py-6 pr-4 text-right font-mono text-slate-700">
                                                                    {formatPrice(Number(invoice.taxAmount), invoice.currency)}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Totals Section */}
                                            <div className="flex justify-end mb-16 relative z-10">
                                                <div className="w-full max-w-xs space-y-3">
                                                    <div className="flex justify-between text-slate-600 text-sm">
                                                        <span>Subtotal</span>
                                                        <span className="font-mono">{formatPrice(Number(invoice.amount) - Number(invoice.taxAmount || 0), invoice.currency)}</span>
                                                    </div>
                                                    {Number(invoice.taxAmount) > 0 && (
                                                        <div className="flex justify-between text-slate-600 text-sm">
                                                            <span>Tax</span>
                                                            <span className="font-mono">{formatPrice(Number(invoice.taxAmount), invoice.currency)}</span>
                                                        </div>
                                                    )}
                                                    {Number(invoice.discountAmount) > 0 && (
                                                        <div className="flex justify-between text-slate-600 text-sm">
                                                            <span>Discount</span>
                                                            <span className="font-mono text-green-600">-{formatPrice(Number(invoice.discountAmount), invoice.currency)}</span>
                                                        </div>
                                                    )}
                                                    <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-end">
                                                        <span className="font-bold text-slate-900">Total</span>
                                                        <span className="font-bold text-2xl text-indigo-600 font-mono">
                                                            {formatPrice(Number(invoice.amount) - Number(invoice.discountAmount || 0), invoice.currency)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div className="bg-slate-50 rounded-lg p-6 text-center break-inside-avoid relative z-10">
                                                <p className="text-slate-600 font-medium mb-1">Thank you for your business!</p>
                                                <p className="text-slate-500 text-sm">If you have any questions concerning this invoice, please contact support@campzeo.com</p>
                                            </div>

                                            <div className="mt-8 text-center relative z-10">
                                                <p className="text-xs text-slate-300">Generated by CampZeo Platform</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-4 print:hidden pt-4" data-html2canvas-ignore="true">
                                <Button className="flex-1 h-12 text-base font-semibold shadow-lg shadow-primary/20" size="lg" onClick={() => router.push('/organisation')}>
                                    Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                                {invoice && (
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-12 text-base font-semibold"
                                        size="lg"
                                        onClick={handleDownloadInvoice}
                                        disabled={isDownloading}
                                    >
                                        <Download className="mr-2 h-5 w-5" />
                                        {isDownloading ? "Generating..." : "Download Invoice"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}



                </div>
            </div>
        </div>
    );
}

export default function PurchasePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <PurchaseContent />
        </Suspense>
    )
}
