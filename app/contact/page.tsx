"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Send, ArrowLeft, Loader2, MessageSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReCAPTCHA from "react-google-recaptcha";
import { LandingGlowEffects } from "@/components/ui/landing glow effects";

export default function ContactPage() {
    const [loading, setLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!captchaToken) {
            toast.error("Please complete the CAPTCHA check.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, captchaToken }),
            });

            if (!response.ok) throw new Error("Failed to send message");

            toast.success("Message sent successfully! We will get back to you soon.");
            setFormData({ name: "", email: "", subject: "", message: "" });
            setCaptchaToken(null);
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-black text-foreground selection:bg-primary/10 overflow-x-hidden">
            {/* Dynamic Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Navigation */}
            <header className="fixed top-0 w-full bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <Link href="/" className="flex items-center gap-2 group">
                                <div className="relative">
                                    <img src="/logo-1.png" alt="Campzeo" className="h-9 transition-transform duration-300 group-hover:scale-110" />
                                    <div className="absolute -inset-1 bg-primary/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <Link href="/">
                                <Button variant="ghost" size="sm" className="rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                                    <ArrowLeft className="size-4 mr-2" />
                                    Back to Home
                                </Button>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </header>

            <main className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative">
                <LandingGlowEffects />
                <div className="max-w-7xl mx-auto relative z-10">
                    {/* Hero Section */}
                    <div className="text-center mb-16 space-y-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-2"
                        >
                            <Sparkles className="size-3" />
                            Support Center
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-5xl md:text-6xl font-black tracking-tight"
                        >
                            Let's build something <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-red-500 to-primary/80 animate-gradient">together.</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed"
                        >
                            Whether you have a question about features, pricing, or anything else, our team is ready to answer all your questions.
                        </motion.p>
                    </div>

                    <div className="grid lg:grid-cols-5 gap-12 items-start">
                        {/* Contact Details Column */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.7, delay: 0.3 }}
                            className="lg:col-span-2 space-y-6"
                        >
                            <div className="space-y-4">
                                <h3 className="text-2xl font-bold">Contact Information</h3>
                                <p className="text-muted-foreground">Prefer to reach out directly? Use one of the methods below.</p>
                            </div>

                            <div className="grid gap-4">
                                <ContactCard
                                    icon={Mail}
                                    title="Email Us"
                                    value="office@campzeo.com"
                                    description="We usually reply within 2-4 hours."
                                    delay={0.4}
                                />
                                <ContactCard
                                    icon={Phone}
                                    title="Call Us"
                                    value="+95 55 000-0000"
                                    description="Mon-Fri from 9am to 6pm IST."
                                    delay={0.5}
                                />
                                <ContactCard
                                    icon={MapPin}
                                    title="Our Presence"
                                    value="Worldwide Support"
                                    description="Remote-first team helping brands globally."
                                    delay={0.6}
                                />
                            </div>

                            {/* Social or Badge Area */}
                            <div className="pt-6 border-t border-gray-100 dark:border-white/5 mt-8">
                                <div className="flex items-center gap-4">
                                    <img src="/logo-1.png" alt="Trusted" className="h-6 grayscale opacity-50" />
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Global Support for Modern Brands</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Form Column */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: 0.4 }}
                            className="lg:col-span-3"
                        >
                            <Card className="border relative z-10 border-gray-100 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-none bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl overflow-hidden rounded-3xl">
                                <CardContent className="p-8 md:p-10">
                                    <div className="mb-10">
                                        <h3 className="text-2xl font-bold flex items-center gap-3">
                                            <MessageSquare className="size-6 text-primary" />
                                            Send a Message
                                        </h3>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                                                <Input
                                                    name="name"
                                                    placeholder="John Doe"
                                                    required
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    className="h-12 bg-white dark:bg-black/20 border-gray-100 dark:border-white/10 rounded-xl focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                                                <Input
                                                    name="email"
                                                    type="email"
                                                    placeholder="john@example.com"
                                                    required
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    className="h-12 bg-white dark:bg-black/20 border-gray-100 dark:border-white/10 rounded-xl focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Subject</label>
                                            <Input
                                                name="subject"
                                                placeholder="How can we help you?"
                                                required
                                                value={formData.subject}
                                                onChange={handleChange}
                                                className="h-12 bg-white dark:bg-black/20 border-gray-100 dark:border-white/10 rounded-xl focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Message Details</label>
                                            <Textarea
                                                name="message"
                                                placeholder="Tell us what you're thinking..."
                                                className="min-h-[160px] bg-white dark:bg-black/20 border-gray-100 dark:border-white/10 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all py-4 resize-none text-sm"
                                                required
                                                value={formData.message}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div className="flex justify-center">
                                            <ReCAPTCHA
                                                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                                                onChange={setCaptchaToken}
                                                theme="light" // or "dark" depending on your UI preference
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-[0.98]"
                                            disabled={loading || !captchaToken}
                                        >
                                            {loading ? (
                                                <Loader2 className="size-5 animate-spin mr-2" />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span>Send Message</span>
                                                    <Send className="size-4" />
                                                </div>
                                            )}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </main>

            <footer className="py-12 border-t border-gray-100 dark:border-white/5 bg-white/30 dark:bg-zinc-900/30">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-sm font-medium text-muted-foreground">© 2025 Campzeo. Crafted for modern creators.</p>
                </div>
            </footer>
        </div>
    );
}

function ContactCard({ icon: Icon, title, value, description, delay }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className="group"
        >
            <Card className="border border-gray-100 dark:border-white/5 bg-white dark:bg-zinc-900/20 hover:border-primary/20 transition-all duration-300 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5">
                <CardContent className="p-6">
                    <div className="flex gap-4">
                        <div className="size-12 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                            <Icon className="size-6 text-primary group-hover:text-white transition-colors" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">{title}</h4>
                            <p className="text-lg font-bold">{value}</p>
                            <p className="text-sm text-muted-foreground/80">{description}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
