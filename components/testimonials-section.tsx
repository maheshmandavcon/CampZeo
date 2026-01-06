"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
    {
        content: "This platform has revolutionized how we manage our social media. The analytics are incredible.",
        author: "Sarah Johnson",
        role: "Marketing Director",
        company: "TechFlow",
        rating: 5,
        type: "review",
        span: "md:col-span-1",
      src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    {
        content: "A must-have for anyone serious about quality. One of the best investments we've made this year.",
        author: "Matthew Smith",
        role: "CEO & Founder",
        company: "StartUp Inc",
        rating: 5,
        type: "quote",
        span: "md:col-span-2",
        src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=3560&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
        content: "Simple, intuitive, and powerful. Exactly what we needed to scale our operations.",
        author: "Emily Davis",
        role: "Social Media Manager",
        company: "Creative Agency",
        rating: 5,
        type: "review",
        span: "md:col-span-1",
              src: "https://images.unsplash.com/photo-1623582854588-d60de57fa33f?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

    },
    {
        content: "Support is top-notch and the features keep getting better. Highly recommended!",
        author: "David Wilson",
        role: "CEO",
        company: "Growth Co",
        rating: 5,
        type: "review",
        span: "md:col-span-1",
              src: "https://images.unsplash.com/photo-1636041293178-808a6762ab39?q=80&w=3464&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

    },
    {
        content: "Professional, creative, and detail-oriented. This changed the game for me.",
        author: "Jessica Lee",
        role: "Content Creator",
        company: "Viral Studios",
        rating: 5,
        type: "quote",
        span: "md:col-span-1",
              src: "https://images.unsplash.com/photo-1624561172888-ac93c696e10c?q=80&w=2592&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

    },
    {
        content: "The AI features help me come up with content ideas instantly. It's like having a dedicated creative team.",
        author: "Michael Brown",
        role: "Influencer",
        company: "Social Buzz",
        rating: 5,
        type: "review",
        span: "md:col-span-2",
              src: "https://images.unsplash.com/photo-1636041293178-808a6762ab39?q=80&w=3464&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

    },
];

export function TestimonialsSection() {
    return (
        <section id="testimonials" className="relative py-24 overflow-hidden">
            {/* Background - Dark Red/Zinc Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
                {/* Subtle Abstract Shapes/Glow */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-800/10 rounded-full blur-3xl opacity-50" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold mb-4 text-white tracking-tight">
                        Trusted by Industry Leaders
                    </h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
                        Join thousands of potential teams who are streaming their workflow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto">
                    {testimonials.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className={cn(
                                "relative group overflow-hidden rounded-3xl p-8 transition-all duration-300",
                                "bg-white/5 backdrop-blur-md border border-white/10 hover:border-red-500/30 hover:bg-white/10",
                                item.span
                            )}
                        >
                            <div className="relative z-10 flex flex-col h-full justify-between gap-6">

                                {/* Header: Quote Icon or Stars */}
                                <div className="flex justify-between items-start">
                                    {item.type === 'quote' ? (
                                        <Quote className="size-10 text-red-500/80 fill-red-500/20" />
                                    ) : (
                                        <div className="flex gap-1">
                                            {[...Array(item.rating)].map((_, i) => (
                                                <Star key={i} className="size-4 text-yellow-500 fill-yellow-500" />
                                            ))}
                                        </div>
                                    )}
                                </div>


                                {/* Content */}
                                <div className="">
                                    <p className={cn(
                                        "text-zinc-100 font-medium leading-relaxed",
                                        item.type === 'quote' ? "text-2xl md:text-3xl" : "text-lg"
                                    )}>
                                        "{item.content}"
                                    </p>
                                </div>

                                {/* Author Info */}
                                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                                    <Avatar className="size-10 border border-white/10">
                                        <AvatarImage src={`/avatars/${index + 1}.png`} />
                                        <AvatarFallback className="bg-red-900/30 text-red-200 text-xs">
                                            {item.author.split(' ').map(n => n[0]).join('')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="text-white font-semibold text-sm">{item.author}</h4>
                                        <p className="text-zinc-400 text-xs">{item.role}, {item.company}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Gradient Blob on Hover */}
                            <div className="absolute -inset-2 bg-gradient-to-r from-red-600/20 to-orange-600/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10" />

                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
