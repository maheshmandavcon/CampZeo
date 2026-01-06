"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ArrowLeft, AlertCircle, CheckCircle, XCircle, Scale } from "lucide-react";
import Link from "next/link";
import { Header } from '@/components/Header';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <Link href="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 size-4" />
              Back to Home
            </Button>
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <FileText className="size-12 text-primary" />
            <h1 className="text-4xl font-bold">Terms of Service</h1>
          </div>

          <p className="text-muted-foreground text-lg mb-2">
            Last Updated: December 4, 2025
          </p>

          <p className="text-muted-foreground">
            Please read these Terms of Service carefully before using Campzeo. By accessing or using our service, you agree to be bound by these terms.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Acceptance of Terms */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle className="size-6 text-primary" />
                <CardTitle>Acceptance of Terms</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                By creating an account or using Campzeo ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Service.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.
              </p>
            </CardContent>
          </Card>

          {/* Description of Service */}
          <Card>
            <CardHeader>
              <CardTitle>Description of Service</CardTitle>
              <CardDescription>
                Campzeo provides social media management tools and services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Campzeo is a social media management platform that allows you to:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Connect and manage multiple social media accounts (Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Schedule and publish content across platforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Analyze engagement metrics and audience insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Collaborate with team members on content creation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Access analytics and reporting features</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* User Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>User Accounts and Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Account Creation</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You must provide accurate and complete information when creating an account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You are responsible for maintaining the confidentiality of your account credentials</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You must be at least 13 years old to use our Service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You are responsible for all activities that occur under your account</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Account Security</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Notify us immediately of any unauthorized use of your account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>We are not liable for any loss or damage arising from your failure to maintain account security</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Acceptable Use */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Scale className="size-6 text-primary" />
                <CardTitle>Acceptable Use Policy</CardTitle>
              </div>
              <CardDescription>
                You agree to use our Service in compliance with all applicable laws and regulations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="size-5 text-green-500" />
                  You May:
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Use the Service for lawful business and personal purposes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Create and share content that you own or have rights to</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Collaborate with team members within your organization</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <XCircle className="size-5 text-red-500" />
                  You May Not:
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Violate any laws or regulations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Post spam, malicious content, or engage in fraudulent activities</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Infringe on intellectual property rights of others</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Attempt to gain unauthorized access to our systems or other users' accounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Use automated systems to access the Service without permission</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Reverse engineer, decompile, or disassemble any part of the Service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>Share your account credentials with unauthorized third parties</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Integration */}
          <Card>
            <CardHeader>
              <CardTitle>Social Media Platform Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                When you connect your social media accounts to Campzeo:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>You grant us permission to access and post content on your behalf as authorized</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>You remain responsible for all content posted through our Service</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    You must comply with each platform's terms of service and community guidelines. specifically:
                    <ul className="list-disc list-inside mt-2 ml-2 space-y-1">
                      <li><strong>YouTube:</strong> <Link href="https://www.youtube.com/t/terms" className="text-primary hover:underline" target="_blank">Terms of Service</Link> & <Link href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank">Google Privacy Policy</Link></li>
                      <li><strong>Meta (FB/Insta):</strong> <Link href="https://www.facebook.com/terms.php" className="text-primary hover:underline" target="_blank">Terms of Service</Link></li>
                      <li><strong>LinkedIn:</strong> <Link href="https://www.linkedin.com/legal/user-agreement" className="text-primary hover:underline" target="_blank">User Agreement</Link></li>
                      <li><strong>Pinterest:</strong> <Link href="https://policy.pinterest.com/en/terms-of-service" className="text-primary hover:underline" target="_blank">Terms of Service</Link></li>
                    </ul>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>We are not responsible for actions taken by social media platforms against your accounts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>You can revoke access at any time through your account settings</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Subscription and Payment */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription and Payment Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Billing</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Subscription fees are billed in advance on a monthly or annual basis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>All fees are in Indian Rupees (INR) unless otherwise stated</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Payment is due immediately upon subscription or renewal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>We accept payment through our authorized payment processors</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Refunds and Cancellation</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You may cancel your subscription at any time from your account settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Cancellations take effect at the end of the current billing period</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>No refunds are provided for partial months or unused portions of the Service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>We reserve the right to offer refunds on a case-by-case basis</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Free Trial</h3>
                <p className="text-muted-foreground">
                  We offer a 14-day free trial for new users. No credit card is required for the trial. After the trial period, you must subscribe to a paid plan to continue using the Service.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle>Intellectual Property Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Our Content</h3>
                <p className="text-muted-foreground">
                  The Service, including its original content, features, and functionality, is owned by Campzeo and is protected by international copyright, trademark, and other intellectual property laws.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Your Content</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You retain all rights to content you create and upload to the Service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You grant us a license to use, store, and display your content solely to provide the Service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>You represent that you have all necessary rights to the content you upload</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="size-6 text-primary" />
                <CardTitle>Limitation of Liability</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CAMPZEO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p>
                Our total liability to you for any claims arising from or related to the Service shall not exceed the amount you paid us in the 12 months prior to the claim.
              </p>
            </CardContent>
          </Card>

          {/* Disclaimer of Warranties */}
          <Card>
            <CardHeader>
              <CardTitle>Disclaimer of Warranties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p>
                We do not warrant that:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>The Service will be uninterrupted, timely, secure, or error-free</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>The results obtained from using the Service will be accurate or reliable</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Any errors in the Service will be corrected</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card>
            <CardHeader>
              <CardTitle>Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                We reserve the right to suspend or terminate your account and access to the Service at our sole discretion, without notice, for conduct that we believe:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Violates these Terms or our policies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Harms other users or the Service</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Exposes us to legal liability</span>
                </li>
              </ul>
              <p>
                Upon termination, your right to use the Service will immediately cease. All provisions of these Terms that should survive termination shall survive, including ownership provisions, warranty disclaimers, and limitations of liability.
              </p>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card>
            <CardHeader>
              <CardTitle>Governing Law and Dispute Resolution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in accordance with Indian arbitration laws, except that either party may seek injunctive relief in court.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Service */}
          <Card>
            <CardHeader>
              <CardTitle>Changes to the Service</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p>
                We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) at any time, with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
              <CardDescription>
                If you have any questions about these Terms of Service, please contact us.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Email:</strong> legal@campzeo.com</p>
                <p><strong>Support:</strong> support@campzeo.com</p>
                <p className="text-sm mt-4">
                  We will respond to your inquiry within 48 hours.
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            By using Campzeo, you agree to these Terms of Service.
          </p>
          <Link href="/">
            <Button size="lg">
              Back to Home
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
