"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, Lock, Eye, Users, Share2 } from "lucide-react";
import Link from "next/link";
import { Header } from '@/components/Header';

export default function PrivacyPolicyPage() {
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
            <Shield className="size-12 text-primary" />
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>

          <p className="text-muted-foreground text-lg mb-2">
            Last Updated: December 4, 2025
          </p>

          <p className="text-muted-foreground">
            At Campzeo, we take your privacy seriously. This policy describes how we collect, use, and protect your personal information.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Information We Collect */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Eye className="size-6 text-primary" />
                <CardTitle>Information We Collect</CardTitle>
              </div>
              <CardDescription>
                We collect information that you provide directly to us and information automatically collected when you use our services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Personal Information</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Name and email address</li>
                  <li>Organization details</li>
                  <li>Payment information (processed securely through third-party providers)</li>
                  <li>Profile information and preferences</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Usage Information</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Device information and IP address</li>
                  <li>Browser type and operating system</li>
                  <li>Pages visited and features used</li>
                  <li>Time and date of access</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lock className="size-6 text-primary" />
                <CardTitle>How We Use Your Information</CardTitle>
              </div>
              <CardDescription>
                We use the information we collect to provide, maintain, and improve our services.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To provide and maintain our platform services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To process your transactions and send related information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To send you technical notices, updates, and support messages</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To respond to your comments and questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To analyze usage patterns and improve our services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To detect, prevent, and address technical issues and security threats</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Social Media Integration and Google User Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Share2 className="size-6 text-primary" />
                <CardTitle>Social Media Integration & Google User Data</CardTitle>
              </div>
              <CardDescription>
                How we handle your social media data, including YouTube API Services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Connected Social Media Accounts</h3>
                <p className="text-muted-foreground mb-3">
                  When you connect your social media accounts (Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok) to Campzeo, we:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Access only the permissions you explicitly grant during the authorization process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Store access tokens securely to enable posting and content management on your behalf</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Retrieve basic profile information and analytics data to display in your dashboard</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Never post content without your explicit action or scheduled approval</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Allow you to disconnect any social media account at any time from your settings</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Google & YouTube Data</h3>
                <p className="text-muted-foreground mb-3">
                  Campzeo uses YouTube API Services. By using our YouTube integration, you agree to be bound by the <Link href="https://www.youtube.com/t/terms" className="text-primary hover:underline" target="_blank">YouTube Terms of Service</Link> and the <Link href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank">Google Privacy Policy</Link>.
                </p>
                <p className="text-muted-foreground mb-2">
                  In addition to our general data practices, for YouTube data:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>We access your YouTube channel information to allow you to select channels for posting.</li>
                  <li>We upload video files you provide directly to your selected YouTube channel.</li>
                  <li>We employ the data only to provide the video scheduling and uploading features of Campzeo.</li>
                  <li>We do not share your Google user data with third parties (e.g., AI models, advertising networks) except as necessary to provide the service or comply with the law.</li>
                  <li>You can revoke Campzeo's access to your data via the <Link href="https://security.google.com/settings/security/permissions" className="text-primary hover:underline" target="_blank">Google Security Settings</Link> page.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Meta (Facebook, Instagram) Data</h3>
                <p className="text-muted-foreground mb-2">
                  When you connect your Facebook or Instagram accounts, we process data in accordance with the <Link href="https://www.facebook.com/privacy/policy" className="text-primary hover:underline" target="_blank">Meta Privacy Policy</Link>.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>We access your basic profile information and Page insights to display analytics.</li>
                  <li>We collect data necessary to publish posts, stories, and reels on your behalf.</li>
                  <li>You can manage your off-Facebook activity and permissions in your <Link href="https://www.facebook.com/settings" className="text-primary hover:underline" target="_blank">Facebook Settings</Link>.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">LinkedIn Data</h3>
                <p className="text-muted-foreground mb-2">
                  Our integration with LinkedIn adheres to the <Link href="https://www.linkedin.com/legal/privacy-policy" className="text-primary hover:underline" target="_blank">LinkedIn Privacy Policy</Link>.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>We access your profile and organization page data to enable content management.</li>
                  <li>We do not store your LinkedIn connections or private messages.</li>
                  <li>You can revoke access at any time via your <Link href="https://www.linkedin.com/psettings/permitted-services" className="text-primary hover:underline" target="_blank">LinkedIn Settings</Link>.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Pinterest Data</h3>
                <p className="text-muted-foreground mb-2">
                  For Pinterest integration:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Pinterest data is handled according to the <Link href="https://policy.pinterest.com/en/privacy-policy" className="text-primary hover:underline" target="_blank">Pinterest Privacy Policy</Link>.</li>
                  <li>We only access necessary permissions to upload video/image content and view public analytics.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Data We Collect from Social Media</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Public profile information (name, profile picture, username)</li>
                  <li>Post engagement metrics (likes, comments, shares, views)</li>
                  <li>Audience demographics and insights (when available)</li>
                  <li>Content you create and schedule through our platform</li>
                </ul>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> We do not sell your social media data to third parties. Your social media credentials and access tokens are encrypted and stored securely. We only use this data to provide the social media management features you've requested.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Sharing and Disclosure */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="size-6 text-primary" />
                <CardTitle>Data Sharing and Disclosure</CardTitle>
              </div>
              <CardDescription>
                We do not sell your personal information. We may share your information only in the following circumstances.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>With your consent:</strong> We may share information when you give us explicit permission</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Service providers:</strong> We work with third-party service providers who perform services on our behalf (payment processing, analytics, hosting)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Legal requirements:</strong> We may disclose information if required by law or to protect our rights and safety</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card>
            <CardHeader>
              <CardTitle>Data Security</CardTitle>
              <CardDescription>
                We implement appropriate technical and organizational measures to protect your personal information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Encryption of data in transit and at rest</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Regular security audits and updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Access controls and authentication measures</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Secure backup and disaster recovery procedures</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card>
            <CardHeader>
              <CardTitle>Your Rights and Choices</CardTitle>
              <CardDescription>
                You have certain rights regarding your personal information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Access:</strong> Request a copy of the personal information we hold about you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Correction:</strong> Request correction of inaccurate or incomplete information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Deletion:</strong> Request deletion of your personal information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Opt-out:</strong> Unsubscribe from marketing communications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Data portability:</strong> Request a copy of your data in a portable format</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Cookies and Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Cookies and Tracking Technologies</CardTitle>
              <CardDescription>
                We use cookies and similar technologies to improve your experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3">
                We use cookies for:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Authentication and security</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Preferences and settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Analytics and performance monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Advertising and marketing (with your consent)</span>
                </li>
              </ul>
              <p className="text-muted-foreground mt-3">
                You can control cookies through your browser settings.
              </p>
            </CardContent>
          </Card>

          {/* Children's Privacy */}
          <Card>
            <CardHeader>
              <CardTitle>Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Privacy Policy */}
          <Card>
            <CardHeader>
              <CardTitle>Changes to This Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last Updated" date. We encourage you to review this privacy policy periodically for any changes.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
              <CardDescription>
                If you have any questions about this privacy policy or our data practices, please contact us.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Email:</strong> privacy@campzeo.com</p>
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
          <h2 className="mb-4">Your Privacy Matters</h2>
          <p className="text-muted-foreground mb-6">
            We're committed to protecting your data and being transparent about our practices.
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
