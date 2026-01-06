
"use client"
import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star } from "lucide-react"

export function TestimonialCarousel() {
    const testimonials = [
        {
            name: "Sarah Johnson",
            role: "Marketing Director",
            company: "TechFlow",
            content: "This platform has revolutionized how we manage our social media. The analytics are incredible.",
            initials: "SJ",
                  src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"

        },
        {
            name: "Michael Chen",
            role: "Founder",
            company: "StartUp Inc",
            content: "The best investment we've made this year. It saves us hours every week.",
            initials: "MC",
        src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=3560&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    
        },
        {
            name: "Emily Davis",
            role: "Social Media Manager",
            company: "Creative Agency",
            content: "Simple, intuitive, and powerful. Exactly what we needed to scale our operations.",
            initials: "ED",
              src: "https://images.unsplash.com/photo-1623582854588-d60de57fa33f?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        },
        {
            name: "David Wilson",
            role: "CEO",
            company: "Growth Co",
            content: "Support is top-notch and the features keep getting better. Highly recommended!",
            initials: "DW",
              src: "https://images.unsplash.com/photo-1636041293178-808a6762ab39?q=80&w=3464&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        },
        {
            name: "Jessica Lee",
            role: "Content Creator",
            company: "Viral Studios",
            content: "I love the new AI features. They help me come up with content ideas instantly.",
            initials: "JL",
              src: "https://images.unsplash.com/photo-1624561172888-ac93c696e10c?q=80&w=2592&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

        }
    ]

    return (
        <Carousel
            opts={{
                align: "start",
                loop: true,
            }}
            className="w-full max-w-7xl mx-auto"
        >
            
            <CarouselContent>
                {testimonials.map((testimonial, index) => (
                    <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3 pl-4">
                        <div className="p-1 h-full">
                            <Card className="h-full border-muted/20 bg-muted/70 hover:bg-muted/40 transition-colors">
                                <CardContent className="flex flex-col p-6 h-full">
                                    <div className="flex gap-1 mb-4 text-yellow-500">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className="size-4 fill-current" />
                                        ))}
                                    </div>
                                    <p className="text-muted-foreground flex-1 mb-6">"{testimonial.content}"</p>
                                    <div className="flex items-center gap-3 mt-auto">
                                        <Avatar>
                                            <AvatarImage src={`/avatars/${index + 1}.png`} alt={testimonial.name} />
                                            <AvatarFallback>{testimonial.initials}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-semibold text-sm">{testimonial.name}</div>
                                            <div className="text-xs text-muted-foreground">{testimonial.role}, {testimonial.company}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
        </Carousel>
    )
}
