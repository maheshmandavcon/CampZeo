"use client";

import { SignIn } from "@clerk/nextjs";
import { Header } from "@/components/Header";

export default function Page() {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4">
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "shadow-xl border-muted/20 bg-background",
              footerAction: "hidden", // Hides the "Sign up" link
            }
          }}
          fallbackRedirectUrl="/auth/after-signin"
          signUpFallbackRedirectUrl="/auth/after-signin"
        />
      </main>

      <footer className="py-8 border-t bg-background text-center text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2025 Campzeo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
