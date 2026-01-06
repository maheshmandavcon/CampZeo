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
            <MouseGlow smoothX={smoothX} smoothY={smoothY} />
            <FloatingIcons />
        </div>
    );
};

const MouseGlow = ({ smoothX, smoothY }: { smoothX: any, smoothY: any }) => {
    const style = {
        background: useMotionTemplate`radial-gradient(120px circle at ${smoothX}px ${smoothY}px, rgba(220, 38, 38, 0.4), transparent 100%)`,
    };

    return (
        <motion.div
            className="absolute inset-0 opacity-0 transition-opacity duration-1000"
            style={style}
            animate={{ opacity: 1 }}
        />
    );
};

const FloatingIcons = () => {
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[120px] h-[120px] text-blue-600 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.971.956-2.971 3.594v.376h3.428l-.581 3.667h-2.847v7.98c3.072-.789 5.245-3.415 5.245-6.321 0-3.673-2.927-6.65-6.538-6.65-3.611 0-6.539 2.977-6.539 6.650 0 2.905 2.173 5.532 5.245 6.321z" />
                </svg>
            ),
            delay: 0,
            duration: 40,
        },
        {
            // Instagram
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[100px] h-[100px] text-pink-600 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
            ),
            delay: 2,
            duration: 45,
        },
        {
            // LinkedIn
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[110px] h-[110px] text-blue-700 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" />
                </svg>
            ),
            delay: 4,
            duration: 120,
        },
        {
            // YouTube
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[130px] h-[130px] text-red-600 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
            ),
            delay: 1,
            duration: 60,
        },
        {
            // Pinterest
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[115px] h-[115px] text-red-500 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.65 0-5.789 2.738-5.789 5.57 0 1.103.425 2.286.953 2.922.105.126.12.238.089.43-.095.393-.308 1.256-.35 1.432-.055.234-.186.284-.428.172-1.598-.745-2.597-3.048-2.597-4.904 0-3.991 2.903-7.653 8.375-7.653 4.399 0 7.821 3.134 7.821 7.33 0 4.373-2.754 7.893-6.574 7.893-1.284 0-2.492-.666-2.905-1.453 0 0-.636 2.418-.79 3.011-.286 1.096-1.058 2.467-1.583 3.328 1.192.366 2.454.566 3.766.566 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
                </svg>
            ),
            delay: 3,
            duration: 50,
        },
        {
            // WhatsApp
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[105px] h-[105px] text-green-500 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 4.876 1.213 5.578c.149.697 2.105 3.21 5.1 4.517 2.995 1.306 4.215 1.048 4.981.974.766-.075 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
            ),
            delay: 1.5,
            duration: 42,
        },
        {
            // Facebook
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[120px] h-[120px] text-blue-600 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.971.956-2.971 3.594v.376h3.428l-.581 3.667h-2.847v7.98c3.072-.789 5.245-3.415 5.245-6.321 0-3.673-2.927-6.65-6.538-6.65-3.611 0-6.539 2.977-6.539 6.650 0 2.905 2.173 5.532 5.245 6.321z" />
                </svg>
            ),
            delay: 0,
            duration: 56,
        },
        {
            // Instagram
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[100px] h-[100px] text-pink-600 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
            ),
            delay: 2,
            duration: 80,
        },
        {
            // LinkedIn
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[110px] h-[110px] text-blue-700 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" />
                </svg>
            ),
            delay: 4,
            duration: 90,
        },
        {
            // YouTube
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[130px] h-[130px] text-red-600 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
            ),
            delay: 1,
            duration: 95,
        },
        {
            // Pinterest
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[115px] h-[115px] text-red-500 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.65 0-5.789 2.738-5.789 5.57 0 1.103.425 2.286.953 2.922.105.126.12.238.089.43-.095.393-.308 1.256-.35 1.432-.055.234-.186.284-.428.172-1.598-.745-2.597-3.048-2.597-4.904 0-3.991 2.903-7.653 8.375-7.653 4.399 0 7.821 3.134 7.821 7.33 0 4.373-2.754 7.893-6.574 7.893-1.284 0-2.492-.666-2.905-1.453 0 0-.636 2.418-.79 3.011-.286 1.096-1.058 2.467-1.583 3.328 1.192.366 2.454.566 3.766.566 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
                </svg>
            ),
            delay: 3,
            duration: 26,
        },
        {
            // WhatsApp
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-[105px] h-[105px] text-green-500 opacity-100 dark:opacity-10 blur-sm">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 4.876 1.213 5.578c.149.697 2.105 3.21 5.1 4.517 2.995 1.306 4.215 1.048 4.981.974.766-.075 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
            ),
            delay: 1.5,
            duration: 85,
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
                opacity: [0.1, 0.3, 0.1], // Pulse opacity
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
