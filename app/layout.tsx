import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/CookieConsent";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CampZeo - Social Media Management Platform",
  description: "Social Media Management Platform - Streamline your social media with powerful tools and insights. Manage Facebook, Instagram, LinkedIn, Twitter, YouTube, and TikTok all in one place.",
  keywords: ["social media management", "content scheduling", "social media analytics", "multi-platform posting", "campzeo"],
  authors: [{ name: "CampZeo" }],
  creator: "CampZeo",
  publisher: "CampZeo",
  icons: {
    icon: '/logo-3.png',
    shortcut: '/logo-3.png',
    apple: '/logo-3.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://campzeo.com',
    title: 'CampZeo - Social Media Management Platform',
    description: 'Streamline your social media management with powerful tools and insights. Manage all your social platforms in one place.',
    siteName: 'CampZeo',
    images: [
      {
        url: '/logo-3.png',
        width: 1200,
        height: 630,
        alt: 'CampZeo Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CampZeo - Social Media Management Platform',
    description: 'Streamline your social media management with powerful tools and insights.',
    images: ['/logo-3.png'],
  },
  verification: {
    google: "XBN_xJq_snQ0FMBdDjF-bPnK65zRpNrqTU4FQiPSBII",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClerkProvider
          signInFallbackRedirectUrl="/onboarding"
          signUpFallbackRedirectUrl="/onboarding"
        >
          {children}
          <Toaster />
          <CookieConsent />
        </ClerkProvider>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XHEXP4D7RE"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            
            // Set default consent to 'denied'
            gtag('consent', 'default', {
              'analytics_storage': 'denied',
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied'
            });

            gtag('js', new Date());

            gtag('config', 'G-XHEXP4D7RE');
          `}
        </Script>
      </body>
    </html>
  );
}
