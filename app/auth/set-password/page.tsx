"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function SetPasswordPage() {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Real-time validation
  const isMinLength = password.length >= 8;
  const isMatch = password !== "" && password === confirmPassword;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  // If user is not logged in, redirect them
  if (!user) {
    router.push("/sign-in");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isMinLength) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!isMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // The error in the screenshot usually happens when using user.update({ password })
      // To fix it, we ensure we use the dedicated password update method.
      // If the user has no password set, updatePassword should work fine without providing currentPassword
      await user.updatePassword({ newPassword: password });

      setSuccess(true);

      // Navigate to organisation after 2 seconds
      setTimeout(() => {
        router.push("/organisation");
      }, 2000);

    } catch (err: any) {
      console.error("Failed to update password:", err);
      // More specific error handling for the "invalid parameter" error if it somehow still persists
      const errorMessage = err?.errors?.[0]?.message || "Something went wrong. Please try again.";
      if (errorMessage.includes("Password is not a valid parameter")) {
        setError("Account system error: Please contact support or try logging in again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden relative">
        {/* RED TOP BORDER */}
        <div className="absolute top-0 left-0 w-full h-[6px] bg-[#d93025]" />

        <div className="p-8 space-y-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-100">
              {success ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <Lock className="h-8 w-8 text-[#d93025]" />
              )}
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              {success ? "Password Set Successfully" : "Set Your Password"}
            </h2>
            <p className="mt-3 text-[15px] text-gray-600 leading-relaxed">
              {success
                ? "Redirecting you to your dashboard..."
                : "Welcome! Please set a permanent password for your\naccount to continue."}
            </p>
          </div>

          {!success && (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-[#d93025]" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-[#c5221f]">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="password">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 sm:text-sm transition-all"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 sm:text-sm transition-all"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              {/* REAL-TIME VALIDATION */}
              <div className="space-y-2 mt-4 text-sm">
                <div className={`flex items-center space-x-2 transition-colors duration-300 ${isMinLength ? 'text-[#1e8e3e]' : 'text-gray-400'}`}>
                  <CheckCircle2 className={`h-4 w-4 ${isMinLength ? 'block' : 'opacity-20'}`} />
                  <span>At least 8 characters long</span>
                </div>
                <div className={`flex items-center space-x-2 transition-colors duration-300 ${isMatch ? 'text-[#1e8e3e]' : 'text-gray-400'}`}>
                  <CheckCircle2 className={`h-4 w-4 ${isMatch ? 'block' : 'opacity-20'}`} />
                  <span>Passwords match</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center items-center rounded-lg border border-transparent bg-[#d93025] py-3.5 px-4 text-base font-bold text-white shadow-md hover:bg-[#c5221f] focus:outline-none focus:ring-4 focus:ring-red-100 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-8"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving password...
                  </>
                ) : (
                  "Save Password & Continue"
                )}
              </button>
            </form>
          )}

          {success && (
            <div className="text-center pb-4">
              <span className="text-sm font-medium text-green-600 animate-pulse">Your session is being updated securely...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
