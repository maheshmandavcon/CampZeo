"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, Loader2, CheckCircle2, Star, ArrowRight, Eye, EyeOff, RotateCcw } from "lucide-react";
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

export default function Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<"business" | "individual">("business");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaRequired, setIsCaptchaRequired] = useState(true);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleResetCaptcha = () => {
    recaptchaRef.current?.reset();
    setCaptchaToken(null);
  };

  // State for handling multiple location matches
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

  useEffect(() => {
    // Only require captcha on campzeo.com
    const isProd = window.location.hostname === "campzeo.com" || window.location.hostname === "www.campzeo.com";
    setIsCaptchaRequired(isProd);
    if (!isProd) {
      setCaptchaToken("BYPASS_CAPTCHA");
    }
  }, []);

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Filtering for specific fields
    let filteredValue = value;
    if (name === "postalCode") {
      // Allow alphanumeric, spaces, and hyphens (global friendly)
      filteredValue = value.replace(/[^a-zA-Z0-9\s-]/g, "");
    } else if (name === "mobile") {
      // Allow digits, plus, parentheses, spaces, and hyphens
      filteredValue = value.replace(/[^0-9+\s\(\)-]/g, "");
    }

    setForm(prev => ({ ...prev, [name]: filteredValue }));
  };

  const handleSelectChange = (name: string, value: string) =>
    setForm(prev => ({ ...prev, [name]: value }));

  //const lastPostalRef = useRef("");

  // Pincode Auto-Detection
  useEffect(() => {
    const detectLocation = async () => {
      const { postalCode } = form;
      if (!postalCode || postalCode.length < 3) {
        setPostalOptions([]);
        return;
      }

      // Clear previous options
      setPostalOptions([]);
      setIsDetecting(true);

      try {
        // 1. Primary: Nominatim (Global) - No country constraint for maximum reach
        const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&format=json&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Campzeo/1.0 (Signup Pincode Detection)'
          }
        });

        let options: LocationOption[] = [];

        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            options = data.map((item: any) => {
              const addr = item.address;
              // Broad city detection: check city, then town, village, municipality, districts, etc.
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

        // 2. Fallback for India - if Nominatim didn't give definitive results and it looks like an Indian PIN
        if (options.length === 0 && postalCode.length === 6 && /^\d+$/.test(postalCode)) {
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
          setForm(prev => ({
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

    const debounce = setTimeout(detectLocation, 600); // Shorter debounce for responsiveness
    return () => clearTimeout(debounce);
  }, [form.postalCode]);


  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA check.");
      return;
    }

    // password: "Password",
    // confirmPassword: "Confirm Password",
    // Validation logic remains the same
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

    // if (form.password !== form.confirmPassword) {
    //   toast.error("Password Mismatch", {
    //     description: "Passwords do not match.",
    //   });
    //   return;
    // }

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

    // // Password validation
    // const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    // if (!passwordRegex.test(form.password)) {
    //   toast.error("Weak Password", {
    //     description: "Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.",
    //   });
    //   return;
    // }

    // Mobile validation
    if (form.mobile.length < 10) {
      toast.error("Invalid Mobile Number", {
        description: "Mobile number must be at least 10 digits.",
      });
      return;
    }

    setLoading(true);

    try {
      const checkRes = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim() }),
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
    } catch {
    }

    try {
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
        description: "Your enquiry has been submitted successfully. Redirecting...",
      });

      setTimeout(() => {
        router.push("/pending-approval");
      }, 1500);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Submission Failed", {
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

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
            <div className="py-2 px-1   rounded-lg">
              <img src="/logo-3.png" alt="CampZeo" style={{ width: 'auto', height: '50px' }} />
            </div>
            <span className="text-3xl font-bold text-red-500">Campzeo</span>
          </Link>

          <div className="space-y-6 max-w-lg mt-20">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.1]">
              Manage your campaigns <br />
              <span className="text-primary">like a pro.</span>
            </h1>
            <p className="text-lg text-neutral-400 leading-relaxed">
              Join thousands of organizations using Campzeo to streamline their social media presence, automate workflows, and drive real engagement.
            </p>

            <div className="flex gap-4 pt-4">
              <div className="flex items-center gap-2 text-white/90 bg-white/5 py-2 px-4 rounded-full border border-white/10 backdrop-blur-sm">
                <CheckCircle2 className="size-4 text-primary" />
                <span className="text-sm font-medium">14-day free trial</span>
              </div>
              <div className="flex items-center gap-2 text-white/90 bg-white/5 py-2 px-4 rounded-full border border-white/10 backdrop-blur-sm">
                <CheckCircle2 className="size-4 text-primary" />
                <span className="text-sm font-medium">No credit card required</span>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 ">
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
            <h2 className="text-3xl font-bold tracking-tight">Create your account</h2>
            <p className="text-muted-foreground">
              Enter your details below to get started with your free trial.
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
                  onChange={(e) => { handleChange(e); setEmailError(null); }}
                  className={`h-10 ${emailError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                />
                {emailError && <p className="text-xs text-red-500 font-medium">{emailError}</p>}
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
                <Label htmlFor="postalCode">Postal Code <span className="text-destructive">*</span></Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  placeholder="10001"
                  value={form.postalCode}
                  onChange={handleChange}
                  className="h-10"
                />

                {postalOptions.length > 0 && (
                  <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs font-medium text-primary mb-2">Multiple locations found. Please select one:</p>
                    <Select
                      onValueChange={(val) => {
                        const selected = postalOptions.find(opt => opt.display === val);
                        if (selected) {
                          setForm(prev => ({
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

              <div className="space-y-2 ">
                <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                <Select
                  name="country"

                  onValueChange={(v) => handleSelectChange("country", v)}
                  value={form.country}
                >
                  <SelectTrigger className="border border-gray-300 h-10">
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
{/* 
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={handleChange}
                    className="h-10 pr-10"
                  />
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
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must contain at least 8 characters, 1 uppercase, 1 lowercase, and 1 number.
                </p>
              </div> */}

              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="enquiryText">Why are you interested in Campzeo? <span className="text-destructive">*</span></Label>
                <Textarea
                  id="enquiryText"
                  name="enquiryText"
                  placeholder="Share a bit about your organization's needs..."
                  className="min-h-[80px] border  border-gray-200 resize-none"
                  value={form.enquiryText}
                  onChange={handleChange}
                />
              </div>
            </div>

            {isCaptchaRequired && (
              <div className="flex flex-col items-center gap-2 my-4">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                  onChange={setCaptchaToken}
                  theme="light"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetCaptcha}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 h-8"
                >
                  <RotateCcw className="size-3" />
                  Reset reCAPTCHA
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-md transition-all hover:shadow-lg"
              disabled={loading || (isCaptchaRequired && !captchaToken)}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating Account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Create Account & Submit <ArrowRight className="size-4" />
                </span>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              By creating an account, you agree to our <Link href="/terms-of-service" className="underline hover:text-foreground">Terms of Service</Link> and <Link href="/privacy-policy" className="underline hover:text-foreground">Privacy Policy</Link>.
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
