"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, BarChart3, Shield, Users, ArrowRight, Globe, Layers, Zap } from "lucide-react";
import { SignInButton, SignedOut, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import { motion } from "framer-motion";
import { LandingGlowEffects } from "@/components/ui/landing glow effects";
import { useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b " style={{zIndex:"9999"}}>
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
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
                Testimonials
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
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
                  <Button variant="outline" className="cursor-pointer hover:text-red-500" onClick={() => router.push("/sign-up")}>
                    Sign Up
                  </Button>
                  <SignInButton mode="modal">
                    <Button className="cursor-pointer hover:bg-red-500/50 hover:text-red-500">Sign In</Button>
                  </SignInButton>
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
      <LandingGlowEffects />
      {/* Hero Section */}

      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>


        <div className="max-w-7xl mx-auto text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            🚀 Now with AI-powered insights
          </Badge>
          <h1 className="mb-6 max-w-5xl mx-auto text-4xl md:text-6xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            The Complete <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-600">SaaS Platform</span> for Modern Teams
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl mb-10 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            Streamline your workflow, boost productivity, and scale your business with our all-in-one platform.
            Start your free 14-day trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="cursor-pointer" size="lg" onClick={() => router.push("/sign-up")}>
              Start Free Trial
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button
              className="cursor-pointer"
              size="lg"
              variant="outline"
              onClick={() => router.push("/pricing")}
            >
              View Pricing
            </Button>
          </div>
          <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground animate-in fade-in duration-1000 delay-500">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-500" />
              14-day free trial
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-500" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-500" />
              Cancel anytime
            </div>
          </div>
        </div>
      </section>


      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 ">

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Powerful Features for Every Team</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Everything you need to manage, scale, and optimize your business operations
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-background/60 relative z-10 backdrop-blur-sm border-muted/20 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader>
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="size-6 text-primary" />
                </div>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Get deep insights into your business metrics with real-time dashboards and custom reports
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-background/60 relative z-10 backdrop-blur-sm border-muted/20 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader>
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="size-6 text-primary" />
                </div>
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Bank-level encryption, SOC 2 compliance, and advanced access controls to keep your data safe
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-background/60  relative z-10 backdrop-blur-sm border-muted/20 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader>
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="size-6 text-primary" />
                </div>
                <CardTitle>Team Collaboration</CardTitle>
                <CardDescription>
                  Work seamlessly with your team using shared workspaces, comments, and real-time updates
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Get started in minutes with our simple three-step process
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Step 1 */}
            <motion.div
              onClick={() => setActiveStep(1)}
              className="relative flex flex-col items-center text-center group cursor-pointer"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className={`size-16 rounded-2xl flex items-center justify-center mb-6 transition-colors relative z-10 ${activeStep === 1 ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"}`}>
                <Globe className={`size-8 ${activeStep === 1 ? "text-primary" : "text-primary/70"} transition-colors`} />
              </div>
              <h3 className="text-xl font-bold mb-3">1. Connect Your Accounts</h3>
              <p className="text-muted-foreground">
                Seamlessly link all your social media profiles and ad accounts in one secure dashboard.
              </p>
              {/* Connector Line (Desktop) */}
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-border/30 overflow-hidden rounded-full">
                <motion.div
                  variants={{
                    rightToLeft: { x: ["100%", "-100%"] },
                    leftToRight: { x: ["-100%", "100%"] }
                  }}
                  animate={
                    activeStep === 1 ? "leftToRight" :
                      activeStep === 2 ? "rightToLeft" : // Center outwards: Line 1 goes Left
                        "rightToLeft" // Step 3: R->L
                  }
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="w-full h-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80"
                />
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              onClick={() => setActiveStep(2)}
              className="relative flex flex-col items-center text-center group cursor-pointer"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className={`size-16 rounded-2xl flex items-center justify-center mb-6 transition-colors relative z-10 ${activeStep === 2 ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"}`}>
                <Layers className={`size-8 ${activeStep === 2 ? "text-primary" : "text-primary/70"} transition-colors`} />
              </div>
              <h3 className="text-xl font-bold mb-3">2. Create & Schedule</h3>
              <p className="text-muted-foreground">
                Use our AI-powered tools to create engaging content and schedule it for optimal times.
              </p>
              {/* Connector Line (Desktop) */}
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-border/30 overflow-hidden rounded-full">
                <motion.div
                  variants={{
                    rightToLeft: { x: ["100%", "-100%"] },
                    leftToRight: { x: ["-100%", "100%"] }
                  }}
                  animate={
                    activeStep === 1 ? "leftToRight" :
                      activeStep === 2 ? "leftToRight" : // Center outwards: Line 2 goes Right
                        "rightToLeft" // Step 3: R->L
                  }
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="w-full h-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80"
                />
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              onClick={() => setActiveStep(3)}
              className="relative flex flex-col items-center text-center group cursor-pointer"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className={`size-16 rounded-2xl flex items-center justify-center mb-6 transition-colors relative z-10 ${activeStep === 3 ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"}`}>
                <Zap className={`size-8 ${activeStep === 3 ? "text-primary" : "text-primary/70"} transition-colors`} />
              </div>
              <h3 className="text-xl font-bold mb-3">3. Analyze & Grow</h3>
              <p className="text-muted-foreground">
                Track performance with real-time analytics and optimize your strategy for growth.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Trusted by Industry Leaders</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              See what our customers have to say about their experience
            </p>
          </div>
          <AnimatedTestimonials testimonials={[
            {
              quote: "This platform has revolutionized how we manage our social media. The analytics are incredible and have helped us grow our reach by 300% in just two months.",
              name: "Sarah Johnson",
              designation: "Marketing Director at TechFlow",
              src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            },
            {
              quote: "A must-have for anyone serious about quality. One of the best investments we've made this year. The support team is also quick to respond.",
              name: "Matthew Smith",
              designation: "CEO & Founder at StartUp Inc",
              src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=3560&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            },
            {
              quote: "Simple, intuitive, and powerful. Exactly what we needed to scale our operations without hiring more staff.",
              name: "Emily Davis",
              designation: "Social Media Manager at Creative Agency",
              src: "https://images.unsplash.com/photo-1623582854588-d60de57fa33f?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            },
            {
              quote: "The AI features help me come up with content ideas instantly. It's like having a dedicated creative team available 24/7.",
              name: "Michael Brown",
              designation: "Influencer at Social Buzz",
              src: "https://images.unsplash.com/photo-1636041293178-808a6762ab39?q=80&w=3464&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            }
          ]} autoplay={true} />
        </div>
      </section>
      {/* Red CTA Section (Replaces Pricing Grid on Landing Page) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#DC2626] rounded-xl text-white p-12 md:p-16 text-center shadow-lg">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to streamline your workflow?
            </h2>
            <p className="text-white/90 text-lg md:text-xl mb-10 max-w-3xl mx-auto">
              Join thousands of teams already using Campzeo to manage their social presence. Plans start at free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="bg-white text-black hover:bg-white/50 hover:text-white transition-all duration-100 cursor-pointer text-base font-semibold h-12 px-8"
                onClick={() => router.push("/pricing")}
              >
                View Pricing Plans
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-white text-white cursor-pointer hover:bg-white/50 hover:text-red-500 text-base font-semibold h-12 px-8"
                onClick={() => router.push("/sign-up")}
              >
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand Section */}
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo-1.png" alt="Campzeo" className="h-8" />
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The all-in-one platform for modern social media management and analytics.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
                <li><Link href="/pricing" className="hover:text-primary transition-colors">Enterprise</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Resources</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Community</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Legal</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2025 Campzeo. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
              <a href="#" className="hover:text-foreground transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
