"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";

export const LandingGlowEffects = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth out the mouse movement
    const springConfig = { damping: 20, stiffness: 200 };
    const smoothX = useSpring(mouseX, springConfig);
    const smoothY = useSpring(mouseY, springConfig);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            mouseX.set(e.clientX - rect.left);
            mouseY.set(e.clientY - rect.top);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [mouseX, mouseY]);

    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">

            <FloatingIcons />
        </div>
    );
};


const FloatingIcons = () => {
    const [dimensions, setDimensions] = useState({ width: 1300, height: 800 });

    useEffect(() => {
        if (typeof window !== "undefined") {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight
            });

            const handleResize = () => {
                setDimensions({
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            };

            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    const icons = [
        {
            // Facebook
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[120px] h-[120px] text-blue-600 blur-xs">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
            ),
            delay: 0,
            duration: 40,
        },
        {
            // Instagram
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[100px] h-[100px] text-pink-600 blur-xs">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
            ),
            delay: 2,
            duration: 45,
        },
        {
            // LinkedIn
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[110px] h-[110px] text-blue-700 blur-xs">
                    <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" />
                </svg>
            ),
            delay: 4,
            duration: 120,
        },
        {
            // YouTube
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[130px] h-[130px] text-red-600 blur-xs">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
            ),
            delay: 1,
            duration: 60,
        },
        {
            // Pinterest
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[115px] h-[115px] text-red-500 blur-xs">
                    <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.65 0-5.789 2.738-5.789 5.57 0 1.103.425 2.286.953 2.922.105.126.12.238.089.43-.095.393-.308 1.256-.35 1.432-.055.234-.186.284-.428.172-1.598-.745-2.597-3.048-2.597-4.904 0-3.991 2.903-7.653 8.375-7.653 4.399 0 7.821 3.134 7.821 7.33 0 4.373-2.754 7.893-6.574 7.893-1.284 0-2.492-.666-2.905-1.453 0 0-.636 2.418-.79 3.011-.286 1.096-1.058 2.467-1.583 3.328 1.192.366 2.454.566 3.766.566 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
                </svg>
            ),
            delay: 3,
            duration: 50,
        },
        {
            // WhatsApp
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[105px] h-[105px] text-green-500 blur-xs">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
            ),
            delay: 1.5,
            duration: 42,
        },
        {
            // Email
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[110px] h-[110px] text-gray-400 blur-xs">
                    <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                </svg>
            ),
            delay: 5,
            duration: 55,
        },
        {
            // SMS
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[100px] h-[100px] text-blue-400 blur-xs">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            ),
            delay: 6,
            duration: 48,
        },
    ];

    return (
        <div className="absolute w-full inset-0 overflow-hidden pointer-events-none">
            {icons.map((item, index) => (
                <FloatingIcon
                    key={index}
                    icon={item.icon}
                    delay={item.delay}
                    duration={item.duration}
                    containerWidth={dimensions.width}
                    containerHeight={dimensions.height}
                />
            ))}
        </div>
    );
};

const FloatingIcon = ({ icon, delay, duration, containerWidth, containerHeight }: { icon: React.ReactNode, delay: number, duration: number, containerWidth: number, containerHeight: number }) => {
    // Generate random positions
    // We want the icons to float around the whole screen but stay mostly within bounds
    // We'll use a set of keyframes to create a "random walk" feel

    const generateRandomPath = () => {
        const points = [];
        const numPoints = 8; // Number of keyframes in one cycle

        for (let i = 0; i < numPoints; i++) {
            // Keep within 10% to 90% of screen to avoid getting stuck on edges too much
            // but allow some off-screen drift for realism if desired
            points.push({
                x: Math.random() * (containerWidth * 0.8) + (containerWidth * 0.1),
                y: Math.random() * (containerHeight * 0.8) + (containerHeight * 0.1),
                scale: 0.8 + Math.random() * 0.4, // Scale between 0.8 and 1.2
                rotate: Math.random() * 360 - 180, // Random rotation
            });
        }
        return points;
    };

    const [path, setPath] = useState<any[]>([]);

    useEffect(() => {
        setPath(generateRandomPath());
    }, [containerWidth, containerHeight]);

    return (
        <motion.div
            className="absolute top-0 left-0"
            initial={{ opacity: 0, scale: 0 }}
            animate={{
                opacity: [0.6, 0.8, 0.6], // Pulse opacity around 0.8
                x: path.map(p => p.x),
                y: path.map(p => p.y),
                scale: path.map(p => p.scale),
                rotate: path.map(p => p.rotate),
            }}
            transition={{
                duration: duration,
                repeat: Infinity,
                ease: "linear",
                delay: delay,
                opacity: {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }}
        >
            {icon}
        </motion.div>
    );
};
