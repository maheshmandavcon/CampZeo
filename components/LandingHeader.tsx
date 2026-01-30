"use client";

import { Button } from "@/components/ui/button";
import { SignInButton, SignedOut, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export function LandingHeader() {
    const router = useRouter();

    return (
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b " style={{ zIndex: "9999" }}>
            <div className=" mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-2">
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
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <Link href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">
                            Features
                        </Link>
                        <Link href="/#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
                            Testimonials
                        </Link>
                        <Link href="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                            How It Works
                        </Link>
                        <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                            Pricing
                        </Link>
                        <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                            Contact Us
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <SignedOut>
                            <div className="flex  items-center gap-3">
                                  {/* <Button variant="outline" className="cursor-pointer hover:text-red-500" onClick={() => router.push("/sign-up")}></Button> */}
                                <Button variant="outline" className="cursor-pointer hover:text-red-500" onClick={() => router.push("/coming-soon")}>
                                    Sign Up
                                </Button>
                                <Button variant="outline" className="cursor-pointer bg-red-600 text-white hover:bg-red-500/50 hover:text-white" onClick={() => router.push("/coming-soon")}>
                                    Sign In
                                </Button>
                                {/* <SignInButton mode="modal">
                                    <Button className="cursor-pointer hover:bg-red-500/50 hover:text-red-500">Sign In</Button>
                                </SignInButton> */}
                            </div>
                        </SignedOut>
                        <SignedIn>
                            <UserButton afterSignOutUrl="/" />
                            <Link href="/organisation">
                                <Button variant="outline">Dashboard</Button>
                            </Link>
                        </SignedIn>
                    </div>
                </div>
            </div>
        </nav>
    );
}
