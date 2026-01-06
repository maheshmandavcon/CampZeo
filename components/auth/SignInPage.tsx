/**
 * Sign In Page Component
 * 
 * This component handles user sign-in with Clerk.
 * After sign-in, users are redirected based on their role.
 */

import { SignIn } from "@clerk/clerk-react";
import { Activity } from "lucide-react";

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="size-8 text-primary" />
            <span className="text-2xl font-bold">SaaSify</span>
          </div>
          <h2 className="text-xl">Sign in to your account</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        {/* Clerk Sign In Component */}
        <div className="flex justify-center">
          <SignIn 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-lg",
              }
            }}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            afterSignInUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}
