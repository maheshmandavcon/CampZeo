/**
 * Sign Up Page Component
 * 
 * This component handles new user registration with Clerk.
 * Users can select their role (Organisation by default, Admin must be assigned).
 */

import { SignUp } from "@clerk/clerk-react";
import { Activity } from "lucide-react";

export function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="size-8 text-primary" />
            <span className="text-2xl font-bold">SaaSify</span>
          </div>
          <h2 className="text-xl">Create your account</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Get started with your free trial today.
          </p>
        </div>

        {/* Clerk Sign Up Component */}
        <div className="flex justify-center">
          <SignUp
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-lg",
              }
            }}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            afterSignUpUrl="/onboarding"
          />
        </div>
      </div>
    </div>
  );
}
