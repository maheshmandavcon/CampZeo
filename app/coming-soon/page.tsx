"use client";

import { Button } from "@/components/ui/button";
import { LandingHeader } from "@/components/LandingHeader";
import { LandingGlowEffects } from "@/components/ui/landing glow effects";
import { Construction, ArrowRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ComingSoonPage() {
    return (
        <div className="min-h-screen bg-[#fafafa] text-foreground selection:bg-primary/10 overflow-x-hidden">
            {/* Dynamic Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <LandingHeader />

            <main className="flex flex-col items-center justify-center min-h-screen px-4 pt-20">
                <LandingGlowEffects />

                <div className="max-w-3xl mx-auto text-center space-y-8 z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex justify-center mb-8"
                    >
                        <div className="p-6 rounded-3xl bg-white shadow-2xl shadow-primary/10 border border-slate-100">
                            <Construction className="size-20 text-primary" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                            We're Building Something <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-indigo-500 to-primary animate-gradient">Extraordinary</span>
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            Our application is currently under development and coming soon.
                            We're crafting an experience that will redefine how you manage your campaigns.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                    >
                        <Link href="/contact" className="w-full sm:w-auto">
                            <Button size="lg" className="w-full sm:w-auto h-14 px-8 rounded-full text-lg font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                                Contact Us for Query
                                <MessageSquare className="ml-2 size-5" />
                            </Button>
                        </Link>

                        <Link href="/" className="w-full sm:w-auto">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 rounded-full text-lg font-bold border-2 hover:bg-slate-50 transition-all">
                                Back to Home
                                <ArrowRight className="ml-2 size-5" />
                            </Button>
                        </Link>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-sm text-muted-foreground pt-12"
                    >
                        Interested in early access? <Link href="/contact" className="text-primary font-bold hover:underline">Get in touch</Link>
                    </motion.p>
                </div>
            </main>

            <footer className="py-8 text-center text-sm text-muted-foreground border-t border-slate-100 bg-white/50 backdrop-blur-sm fixed bottom-0 w-full z-0">
                <p>© 2026 Campzeo. All rights reserved.</p>
            </footer>
        </div>
    );
}
