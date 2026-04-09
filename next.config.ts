import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '*.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
      },
      {
        protocol: 'https',
        hostname: '*.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: '*.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pinimg.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.campzeo.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
    ],
  },
  experimental: {
    middlewareClientMaxBodySize: '1024mb',
  },
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key" },
        ]
      }
    ]
  }
};

export default nextConfig;
