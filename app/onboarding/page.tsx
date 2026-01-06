"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Star, ArrowRight, Eye, EyeOff } from "lucide-react";
import { countries } from "@/lib/countries";
import ReCAPTCHA from "react-google-recaptcha";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlans } from "@/hooks/use-plans";
import { RazorpayButton } from "@/components/razorpay-button";
import { formatPrice } from "@/lib/plans";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { plans, isLoading: plansLoading } = usePlans();

  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<"business" | "individual">("business");
  const [isDetecting, setIsDetecting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const [form, setForm] = useState({
    email: "",
    name: "",
    organisationName: "",
    mobile: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    enquiryText: "",
    taxNumber: "",
  });

  // Get plan from Clerk metadata and sync user
  useEffect(() => {
    const syncUserAndPlan = async () => {
      if (isLoaded && user) {
        // Sync user to database first
        try {
          await fetch("/api/user/sync");
        } catch (error) {
          console.error("Error syncing user:", error);
        }

        // Get plan from metadata
        const metadata = user.unsafeMetadata;
        const planId = metadata.selectedPlanId as number;

        if (planId) {
          setSelectedPlanId(planId);
        }

        // Pre-fill email
        if (user.primaryEmailAddress?.emailAddress) {
          setForm(prev => ({ ...prev, email: user.primaryEmailAddress?.emailAddress || "" }));
        }
      }
    };

    syncUserAndPlan();
  }, [isLoaded, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSelectChange = (name: string, value: string) =>
    setForm({ ...form, [name]: value });

  // Pincode Auto-Detection
  useEffect(() => {
    const detectLocation = async () => {
      const { postalCode, country } = form;
      if (!postalCode || postalCode.length < 3) return;

      const currentCountry = countries.find(c => c.name === country);
      const countryParam = currentCountry ? `&country=${encodeURIComponent(currentCountry.name)}` : "";

      setIsDetecting(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}${countryParam}&format=json&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Campzeo/1.0 (Onboarding Pincode Detection)'
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const address = data[0].address;
            const detectedCity = address.city || address.town || address.village || address.suburb || address.municipality;
            const detectedState = address.state || address.province || address.county || address.state_district;
            const detectedCountryCode = address.country_code?.toUpperCase();

            const matchedCountry = countries.find(c => c.code === detectedCountryCode);

            setForm(prev => ({
              ...prev,
              city: detectedCity || prev.city,
              state: detectedState || prev.state,
              country: matchedCountry ? matchedCountry.name : (address.country || prev.country)
            }));
            setIsDetecting(false);
            return;
          }
        }

        // Fallback for India
        if (postalCode.length === 6 && (!country || country === "India")) {
          const resIN = await fetch(`https://api.postalpincode.in/pincode/${postalCode}`);
          const dataIN = await resIN.json();
          if (dataIN[0]?.Status === "Success") {
            const details = dataIN[0].PostOffice[0];
            setForm(prev => ({
              ...prev,
              city: details.District,
              state: details.State,
              country: "India"
            }));
          }
        }
      } catch (error) {
        console.error("Pincode detection error:", error);
      } finally {
        setIsDetecting(false);
      }
    };

    const debounce = setTimeout(detectLocation, 800);
    return () => clearTimeout(debounce);
  }, [form.postalCode, form.country]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const isFreeTrialPlan = selectedPlan?.price === 0;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA check.");
      return;
    }

    // Validation
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

    if (accountType === 'business') {
      requiredFields.organisationName = "Organisation Name";
      requiredFields.taxNumber = "GST / Tax Number";
    }

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!form[field as keyof typeof form] || form[field as keyof typeof form].trim() === "") {
        toast.error("Missing Required Field", {
          description: `${label} is required. Please fill in all fields.`,
        });
        return;
      }
    }



    const submissionForm = {
      ...form,
      organisationName: accountType === 'individual' ? form.name : form.organisationName,
      taxNumber: accountType === 'individual' ? (form.taxNumber || "N/A") : form.taxNumber,
      captchaToken
    };

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error("Invalid Email", {
        description: "Please enter a valid email address.",
      });
      return;
    }



    // Mobile validation
    if (form.mobile.length < 10) {
      toast.error("Invalid Mobile Number", {
        description: "Mobile number must be at least 10 digits.",
      });
      return;
    }

    setLoading(true);

    try {
      if (isFreeTrialPlan) {
        // FREE TRIAL: Create enquiry
        const response = await fetch("/api/enquiries", {
          method: "POST",
          body: JSON.stringify(submissionForm),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errors && Array.isArray(data.errors)) {
            toast.error("Validation Failed", {
              description: data.errors.join(", "),
            });
          } else {
            toast.error("Submission Failed", {
              description: data.message || "Failed to submit enquiry",
            });
          }
          return;
        }

        toast.success("Success!", {
          description: "Your free trial request has been submitted. Redirecting...",
        });

        setTimeout(() => {
          router.push("/pending-approval");
        }, 1500);
      } else {
        // PAID PLAN: Show payment screen
        setShowPayment(true);
        setLoading(false);
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Submission Failed", {
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
      });
    } finally {
      if (isFreeTrialPlan) {
        setLoading(false);
      }
    }
  };

  const handlePaymentSuccess = async (paymentData?: any) => {
    try {
      setLoading(true);
      toast.info("Payment successful! Creating your organization...");

      const orgName = accountType === 'individual' ? form.name : form.organisationName;

      // Create organization with payment information
      const response = await fetch("/api/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName, // API expects 'organizationName' with 'z'
          email: form.email,
          phone: form.mobile,
          address: form.address,
          city: form.city,
          state: form.state,
          country: form.country,
          postalCode: form.postalCode,
          taxNumber: accountType === 'individual' ? (form.taxNumber || "N/A") : form.taxNumber,
          plan: selectedPlan?.name || "PROFESSIONAL",
          planId: selectedPlanId,
          paymentData: paymentData?.payment
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create organisation");
      }

      toast.success("Welcome! Your account is ready.");
      router.push("/organisation");
    } catch (err) {
      console.error("Error after payment:", err);
      toast.error(err instanceof Error ? err.message : "Failed to complete setup");
      setShowPayment(false);
      setLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
    setShowPayment(false);
  };

  if (!isLoaded || plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-medium tracking-tight">Loading...</h2>
        </div>
      </div>
    );
  }

  // Payment step
  if (showPayment && selectedPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Complete Your Payment</h2>
              <p className="text-muted-foreground">
                You're almost there! Complete payment to activate your {selectedPlan.name} plan
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organization:</span>
                  <span className="font-medium">{form.organisationName || form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium">{selectedPlan.name}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-primary">
                    {formatPrice(selectedPlan.price, "INR")}/{selectedPlan.billingCycle || 'month'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowPayment(false)}
                disabled={loading}
              >
                Back
              </Button>
              <RazorpayButton
                plan={selectedPlan.name}
                amount={selectedPlan.price}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                className="flex-1"
                organizationName={form.organisationName || form.name}
                isSignup={true}
              >
                Pay {formatPrice(selectedPlan.price, "INR")}
              </RazorpayButton>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Panel - Branding & Testimonials */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-neutral-900 border-r border-neutral-800 flex-col justify-between p-12 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-neutral-950 -z-10" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/50 to-transparent z-0" />

        {/* Content */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="py-2 px-1 rounded-lg">
              <img src="/logo-3.png" alt="CampZeo" style={{ width: 'auto', height: '50px' }} />
            </div>
            <span className="text-3xl font-bold text-red-500">Campzeo</span>
          </Link>

          <div className="space-y-6 max-w-lg mt-20">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.1]">
              Complete your setup <br />
              <span className="text-primary">in minutes.</span>
            </h1>
            <p className="text-lg text-neutral-400 leading-relaxed">
              {isFreeTrialPlan
                ? "Submit your details for a 14-day free trial. Our team will review and approve your request within 24-48 hours."
                : "Complete your payment and get instant access to all premium features. Start managing your campaigns like a pro."}
            </p>

            <div className="flex gap-4 pt-4">
              <div className="flex items-center gap-2 text-white/90 bg-white/5 py-2 px-4 rounded-full border border-white/10 backdrop-blur-sm">
                <CheckCircle2 className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  {isFreeTrialPlan ? "14-day free trial" : "Instant access"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-white/90 bg-white/5 py-2 px-4 rounded-full border border-white/10 backdrop-blur-sm">
                <CheckCircle2 className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  {isFreeTrialPlan ? "No credit card required" : "Secure payment"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 p-6 rounded-2xl">
            <div className="flex gap-1 mb-4 text-primary">
              <Star className="size-4 fill-primary" />
              <Star className="size-4 fill-primary" />
              <Star className="size-4 fill-primary" />
              <Star className="size-4 fill-primary" />
              <Star className="size-4 fill-primary" />
            </div>
            <p className="text-lg text-neutral-200 leading-relaxed mb-4">
              &quot;Campzeo transformed how we handle our social campaigns. The automation features alone saved us 20 hours a week. It's an absolute game-changer for our marketing team.&quot;
            </p>
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-full bg-neutral-700 flex items-center justify-center text-white font-bold">
                JD
              </div>
              <div>
                <p className="font-semibold text-white">Jane Doe</p>
                <p className="text-sm text-neutral-400">Marketing Director, TechFlow</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto w-full">
        <div className="w-full max-w-xl space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {isFreeTrialPlan ? "Request Free Trial" : "Complete Your Purchase"}
            </h2>
            <p className="text-muted-foreground">
              {isFreeTrialPlan
                ? "Enter your details below to request a 14-day free trial."
                : `Enter your details to activate your ${selectedPlan?.name} plan.`}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-6">
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
                    placeholder="Acme Corp"
                    value={form.organisationName}
                    onChange={handleChange}
                    className="h-10"
                  />
                </div>
              )}
              <div className={accountType === "individual" ? "col-span-1 md:col-span-2 space-y-2" : "space-y-2"}>
                <Label htmlFor="name">Owner Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={handleChange}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number <span className="text-destructive">*</span></Label>
                <Input
                  id="mobile"
                  name="mobile"
                  placeholder="+1 (555) 000-0000"
                  value={form.mobile}
                  onChange={handleChange}
                  className="h-10"
                />
              </div>

              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="address">Address <span className="text-destructive">*</span></Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="123 Main St"
                  value={form.address}
                  onChange={handleChange}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="city"
                    name="city"
                    placeholder="New York"
                    value={form.city}
                    onChange={handleChange}
                    className="h-10 pr-10"
                  />
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
                    placeholder="NY"
                    value={form.state}
                    onChange={handleChange}
                    className="h-10 pr-10"
                  />
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
                  value={form.country}
                >
                  <SelectTrigger className="border border-gray-200 h-10">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code <span className="text-destructive">*</span></Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  placeholder="10001"
                  value={form.postalCode}
                  onChange={handleChange}
                  className="h-10"
                />
              </div>

              {accountType === "business" && (
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <Label htmlFor="taxNumber">GST / Tax Number <span className="text-destructive">*</span></Label>
                  <Input
                    id="taxNumber"
                    name="taxNumber"
                    placeholder="Tax ID or VAT Number"
                    value={form.taxNumber}
                    onChange={handleChange}
                    className="h-10"
                  />
                </div>
              )}



              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="enquiryText">Why are you interested in Campzeo? <span className="text-destructive">*</span></Label>
                <Textarea
                  id="enquiryText"
                  name="enquiryText"
                  placeholder="Share a bit about your organization's needs..."
                  className="min-h-[80px] border border-gray-200 resize-none"
                  value={form.enquiryText}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex justify-center my-4">
              <ReCAPTCHA
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                onChange={setCaptchaToken}
                theme="light"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-md transition-all hover:shadow-lg"
              disabled={loading || !captchaToken}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isFreeTrialPlan ? "Submitting Request..." : "Processing..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isFreeTrialPlan ? "Submit Free Trial Request" : "Continue to Payment"} <ArrowRight className="size-4" />
                </span>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              By continuing, you agree to our <Link href="/terms-of-service" className="underline hover:text-foreground">Terms of Service</Link> and <Link href="/privacy-policy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </p>
          </form>

          <div className="text-center pt-4">
            <span className="text-sm text-muted-foreground">Already have an account? </span>
            <Link href="/sign-in" className="text-sm font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
