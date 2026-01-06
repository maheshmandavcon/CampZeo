"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Upload, Facebook, Instagram, Linkedin, Youtube, CheckCircle2, XCircle, Mail, Smartphone, MessageSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Schema for profile form
const profileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  mobile: z.string().min(10, "Mobile number must be at least 10 characters").optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface SettingsClientProps {
  userData: {
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
    email: string;
    facebookConnected: boolean;
    instagramConnected: boolean;
    linkedInConnected: boolean;
    linkedInAuthUrn: string | null;
    youtubeConnected: boolean;
    pinterestConnected: boolean;
    emailConnected: boolean;
    smsConnected: boolean;
    whatsappConnected: boolean;
  };
  assignedPlatforms: string[];
  isImpersonating?: boolean;
}

export function SettingsClient({ userData, assignedPlatforms, isImpersonating = false }: SettingsClientProps) {
  const { user, isLoaded } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkedInDialog, setShowLinkedInDialog] = useState(false);
  const [showInstagramDialog, setShowInstagramDialog] = useState(false);
  const [linkedInPages, setLinkedInPages] = useState<any[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [showFacebookPostsDialog, setShowFacebookPostsDialog] = useState(false);
  const [facebookPosts, setFacebookPosts] = useState<any[]>([]);
  const [loadingFacebookPosts, setLoadingFacebookPosts] = useState(false);

  const handleViewFacebookPosts = async () => {
    setShowFacebookPostsDialog(true);
    setLoadingFacebookPosts(true);
    try {
      const res = await fetch("/api/socialmedia/facebook/posts");
      if (res.ok) {
        const data = await res.json();
        setFacebookPosts(data.posts || []);
      } else {
        toast.error("Failed to fetch posts");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch posts");
    } finally {
      setLoadingFacebookPosts(false);
    }
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      mobile: userData.mobile || "",
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsUpdating(true);
    try {
      // Update local DB
      const response = await fetch("/api/user/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      // Update Clerk user
      if (user) {
        await user.update({
          firstName: data.firstName,
          lastName: data.lastName,
        });
      }

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      if (user) {
        await user.setProfileImage({ file });
        toast.success("Avatar updated successfully");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    if (['EMAIL', 'SMS', 'WHATSAPP'].includes(platform)) {
      toast.info(`To enable ${platform} (via Twilio), please contact support.`);
      return;
    }

    // Show Instagram connection method dialog
    if (platform === 'INSTAGRAM') {
      setShowInstagramDialog(true);
      return;
    }

    try {
      const res = await fetch(`/api/socialmedia/auth-url?platform=${platform}`);
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
      toast.error(`Failed to initiate connection for ${platform}`);
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      const res = await fetch("/api/socialmedia/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform })
      });

      if (res.ok) {
        toast.success(`Disconnected ${platform} successfully`);
        window.location.reload();
      } else {
        toast.error("Failed to disconnect");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to disconnect");
    }
  };

  const handleConfigureLinkedIn = async () => {
    setShowLinkedInDialog(true);
    setLoadingPages(true);
    try {
      const res = await fetch("/api/socialmedia/linkedin/pages");
      if (res.ok) {
        const data = await res.json();
        setLinkedInPages(data.organizations || []);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch LinkedIn pages");
    } finally {
      setLoadingPages(false);
    }
  };

  const handleSelectPage = async (urn: string) => {
    try {
      const res = await fetch("/api/user/linkedin-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urn })
      });

      if (res.ok) {
        toast.success("LinkedIn page updated");
        setShowLinkedInDialog(false);
        window.location.reload();
      } else {
        toast.error("Failed to update page");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update page");
    }
  };

  const [socialStatus, setSocialStatus] = useState<any>(null);

  useEffect(() => {
    const fetchSocialStatus = async () => {
      try {
        // Proactively attempt refresh when entering settings
        await fetch("/api/socialmedia/refresh", { method: "POST" }).catch(e => console.warn("Auto-refresh failed", e));

        const res = await fetch("/api/user/social-status");
        if (res.ok) {
          const data = await res.json();
          setSocialStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch social status", error);
      }
    };
    fetchSocialStatus();
  }, []);

  const platforms = [
    {
      id: "FACEBOOK",
      name: "Facebook",
      icon: Facebook,
      color: "text-blue",
      connected: userData.facebookConnected,
      accountName: socialStatus?.facebook?.name,
      description: "Connect your Facebook Page to share posts and view analytics.",
    },
    {
      id: "INSTAGRAM",
      name: "Instagram",
      icon: Instagram,
      color: "text-pink-600",
      connected: userData.instagramConnected,
      accountName: socialStatus?.instagram?.name,
      description: "Connect your Instagram Business account for posting and insights.",
    },
    {
      id: "LINKEDIN",
      name: "LinkedIn",
      icon: Linkedin,
      color: "text-blue",
      connected: userData.linkedInConnected,
      accountName: socialStatus?.linkedin?.name,
      followerCount: socialStatus?.linkedin?.followerCount,
      description: "Share updates to your LinkedIn personal profile or company page.",
    },
    {
      id: "YOUTUBE",
      name: "YouTube",
      icon: Youtube,
      color: "text-red-500",
      connected: userData.youtubeConnected,
      accountName: socialStatus?.youtube?.name,
      description: "Upload videos and manage your YouTube channel.",
    },
    {
      id: "PINTEREST",
      name: "Pinterest",
      icon: CheckCircle2,
      color: "text-red-500",
      connected: userData.pinterestConnected,
      accountName: socialStatus?.pinterest?.name,
      description: "Pin your visual content to Pinterest boards.",
    }
    // {
    //   id: "EMAIL",
    //   name: "Email (Twilio SendGrid)",
    //   icon: Mail,
    //   color: "text-slate-600",
    //   connected: userData.emailConnected,
    //   accountName: null,
    //   description: "Send emails via Twilio SendGrid.",
    // },
    // {
    //   id: "SMS",
    //   name: "SMS (Twilio)",
    //   icon: Smartphone,
    //   color: "text-red-500",
    //   connected: userData.smsConnected,
    //   accountName: null,
    //   description: "Send SMS messages via Twilio.",
    // },
    // {
    //   id: "WHATSAPP",
    //   name: "WhatsApp (Twilio)",
    //   icon: MessageSquare,
    //   color: "text-green",
    //   connected: userData.whatsappConnected,
    //   accountName: null,
    //   description: "Send WhatsApp messages via Twilio.",
    // }
  ];

  const filteredPlatforms = platforms.filter(platform => {
    // 1. If impersonating, show all assigned platforms (including EMAIL, SMS, WHATSAPP)
    if (isImpersonating) {
      return assignedPlatforms.includes(platform.id);
    }

    // 2. Normal flow: Exclude EMAIL, SMS, WHATSAPP from the list entirely
    if (['EMAIL', 'SMS', 'WHATSAPP'].includes(platform.id)) {
      return false;
    }

    // 3. Only show platforms that are assigned to the organisation
    return assignedPlatforms.includes(platform.id);
  });

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account settings and social connections.</p>
      </div>

      <Tabs defaultValue="social" className="space-y-4">
        <TabsList>
          {/* <TabsTrigger value="profile">Profile</TabsTrigger> */}
          <TabsTrigger value="social">Social Accounts</TabsTrigger>
        </TabsList>

        {/* <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and profile picture.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="relative" disabled={isUploading}>
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Change Avatar
                      <input
                        type="file"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, GIF or PNG. Max 5MB.</p>
                  </div>
                </div>
              </div>

              <Separator />

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" {...form.register("firstName")} />
                    {form.formState.errors.firstName && (
                      <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" {...form.register("lastName")} />
                    {form.formState.errors.lastName && (
                      <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={userData.email} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <Input id="mobile" {...form.register("mobile")} placeholder="+1 234 567 890" />
                    {form.formState.errors.mobile && (
                      <p className="text-sm text-red-500">{form.formState.errors.mobile.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent> */}

        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Connect your social media accounts to enable posting and analytics.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredPlatforms.length > 0 ? (
                  filteredPlatforms.map((platform) => (
                    <div key={platform.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full bg-muted ${platform.color}`}>
                          <platform.icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-medium">{platform.name}</h3>
                          <p className="text-sm text-muted-foreground">{platform.description}</p>
                          {platform.connected && platform.accountName && (
                            <p className="text-xs text-green-600 font-medium mt-1">
                              Connected as: {platform.accountName}
                              {(platform as any).followerCount !== undefined && (platform as any).followerCount !== null && (
                                <span> • {(platform as any).followerCount} followers</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        {['EMAIL', 'SMS', 'WHATSAPP'].includes(platform.id) ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Authorized
                          </Badge>
                        ) : platform.connected ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Connected
                            </Badge>
                            {!isImpersonating && (
                              <Button variant="ghost" size="sm" className="text-red-500 cursor-pointer hover:text-red-600 hover:bg-red-50" onClick={() => handleDisconnect(platform.id)}>
                                Disconnect
                              </Button>
                            )}
                          </div>
                        ) : (
                          !isImpersonating ? (
                            <Button className="cursor-pointer" variant="outline" onClick={() => handleConnect(platform.id)}>
                              Connect
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">
                              Disconnected
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No social platforms are assigned to your organisation. Please contact your administrator.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* LinkedIn Page Selection Dialog */}
      {/* <Dialog open={showLinkedInDialog} onOpenChange={setShowLinkedInDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Select LinkedIn Page</DialogTitle>
                <DialogDescription>
                    Choose the LinkedIn profile or company page you want to post to.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {loadingPages ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : linkedInPages.length > 0 ? (
                    linkedInPages.map((page) => (
                        <div 
                            key={page.id} 
                            className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer ${userData.linkedInAuthUrn === page.id ? 'bg-muted border-primary' : ''}`}
                            onClick={() => handleSelectPage(page.id)}
                        >
                            <div>
                                <p className="">{page.name}</p>
                                {page.followerCount !== null && (
                                    <p className="text-xs text-muted-foreground">{page.followerCount} followers</p>
                                )}
                                {page.type === 'PERSON' && (
                                    <Badge variant="outline "  className="mt-1 bg-gree">Personal Profile</Badge>
                                )}
                            </div>
                            {userData.linkedInAuthUrn === page.id && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                        </div>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground p-4">No pages found.</p>
                )}
            </div>
        </DialogContent>
      </Dialog> */}

      {/* Facebook Posts Dialog */}
      <Dialog open={showFacebookPostsDialog} onOpenChange={setShowFacebookPostsDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent Facebook Posts</DialogTitle>
            <DialogDescription>
              Recent content published to your connected Page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingFacebookPosts ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : facebookPosts.length > 0 ? (
              facebookPosts.map((post: any) => (
                <div key={post.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <p className="text-xs text-muted-foreground">{new Date(post.created_time).toLocaleString()}</p>
                    <a href={post.permalink_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                      View on Facebook
                    </a>
                  </div>
                  {post.full_picture && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.full_picture} alt="Post media" className="object-cover w-full h-full" />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{post.message || "(No caption)"}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                    <span>👍 {post.likes?.summary?.total_count || 0} Likes</span>
                    <span>💬 {post.comments?.summary?.total_count || 0} Comments</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground p-4">No recent posts found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram Connection Method Dialog */}
      <Dialog open={showInstagramDialog} onOpenChange={setShowInstagramDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Instagram</DialogTitle>
            <DialogDescription>
              Choose how you want to connect your Instagram account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Option 1: Via Facebook (Business Account) */}
            <div
              className="flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer hover:border-primary hover:bg-accent transition-colors"
              onClick={async () => {
                setShowInstagramDialog(false);
                try {
                  const res = await fetch(`/api/socialmedia/auth-url?platform=INSTAGRAM`);
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                } catch (error) {
                  toast.error('Failed to connect');
                }
              }}
            >
              <div className="p-2 rounded-full bg-blue-100">
                <Facebook className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Via Facebook (Recommended)</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect your Instagram Business or Creator account through Facebook.
                  Enables posting, Reels, and analytics.
                </p>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Full Features
                  </Badge>
                </div>
              </div>
            </div>

            {/* Option 2: Instagram Basic Display (Limited) */}
            <div
              className="flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer hover:border-primary hover:bg-accent transition-colors opacity-60"
              onClick={() => {
                toast.info('Instagram Basic Display is coming soon. Please use Facebook connection for now.');
              }}
            >
              <div className="p-2 rounded-full bg-pink-100">
                <Instagram className="h-6 w-6 text-pink-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Instagram Basic Display</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect personal Instagram account. Limited to viewing posts and profile info only.
                </p>
                <div className="mt-2">
                  <Badge variant="outline" className="text-xs">
                    Coming Soon
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> To post content and use Reels, you need an Instagram Business or Creator account connected via Facebook.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
