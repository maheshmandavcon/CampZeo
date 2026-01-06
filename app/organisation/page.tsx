"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  CreditCard,
  Megaphone,
  Contact,
  Loader2,
  LayoutDashboard,
  Calendar
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import CalendarView from "./_components/CalendarView";

interface User {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  organisation?: {
    name: string;
    isTrial: boolean;
    trialEndDate: string | null;
    subscriptions?: {
      plan?: {
        name: string;
        usageLimits?: string;
      };
    }[];
  };
}

interface Notification {
  id: number;
  message: string;
  type: string | null;
  platform: string | null;
  category: string | null;
  isRead: boolean;
  isSuccess: boolean;
  createdAt: string;
}

interface UsageMetric {
  current: number;
  limit: number;
  percentage: number;
  isNearLimit: boolean;
}

interface UsageData {
  campaigns: UsageMetric;
  contacts: UsageMetric;
  users: UsageMetric;
  platforms: UsageMetric;
  postsThisMonth: UsageMetric;
}

export default function OrganisationDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch User & Organisation Details
        const userRes = await fetch("/api/user/me");
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        } else {
          console.error("Failed to fetch user");
          toast.error("Failed to load user profile");
        }

        // 2. Fetch Usage Details (which includes campaigns, contacts, users counts)
        try {
          const usageRes = await fetch("/api/subscription/usage");
          if (usageRes.ok) {
            const usageData = await usageRes.json();
            if (usageData.usage) {
              setUsage(usageData.usage);
            }
          }
        } catch (usageError) {
          console.error("Error fetching usage data:", usageError);
        }

        // 3. Fetch Recent Notifications
        try {
          const notifRes = await fetch("/api/notifications?limit=5");
          if (notifRes.ok) {
            const notifData = await notifRes.json();
            if (notifData.data?.notifications) {
              setNotifications(notifData.data.notifications);
            }
          }
        } catch (notifError) {
          console.error("Error fetching notifications:", notifError);
        }

        // 4. Fetch Scheduled Posts for Calendar
        try {
          const postsRes = await fetch("/api/scheduled-posts");
          if (postsRes.ok) {
            const data = await postsRes.json();
            if (data.posts) {
              setScheduledPosts(data.posts);
            }
          }
        } catch (postsError) {
          console.error('Error fetching posts:', postsError);
        }

      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleManageBilling = () => {
    router.push("/organisation/billing");
  };

  const getUserInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const orgName = user?.organisation?.name || "Your Organisation";
  const latestSubscription = user?.organisation?.subscriptions?.[0];
  const planName = latestSubscription?.plan?.name || "Free";
  const isTrial = user?.organisation?.isTrial || false;

  return (
    <div className="p-6">
      <div className=" mx-auto space-y-6">

        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="dashboard" className="gap-2 cursor-pointer">
                <LayoutDashboard className="size-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2 cursor-pointer">
                <Calendar className="size-4" />
                Calendar
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Welcome Section */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Welcome back, {orgName}</h2>
              <p className="text-muted-foreground mt-1">
                Here's what's happening with your account today
              </p>
            </div>

            {/* Plan Status Banner */}
            <Card
              className="bg-primary text-primary-foreground transition-opacity"
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-primary-foreground">{planName} Plan</h3>
                      <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                        {isTrial ? "Trial Period" : "Active"}
                      </Badge>
                    </div>
                    <p className="text-primary-foreground/80">
                      {isTrial && user?.organisation?.trialEndDate
                        ? `Trial ends on ${new Date(user.organisation.trialEndDate).toLocaleDateString()}`
                        : "Your subscription is active."}
                    </p>
                  </div>
                  <Button onClick={handleManageBilling} variant="secondary" className="bg-white cursor-pointer text-primary hover:bg-white/90">
                    <CreditCard className="size-4 mr-2" />
                    Manage Billing
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card
                className="cursor-pointer hover:bg-red-50/50 transition-colors"
                onClick={() => router.push("/organisation/campaigns")}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                  <Megaphone className="size-8 bg-red-500 p-2 rounded-full text-white " />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usage?.campaigns.current || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active marketing campaigns
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-orange-50/50 transition-colors"
                onClick={() => router.push("/organisation/contacts")}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                  <Contact className="size-8 bg-orange-500 p-2 rounded-full text-white " />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usage?.contacts.current || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Audience reach
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-yellow-50/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Team Size</CardTitle>
                  <Users className="size-8 bg-yellow-400 p-2 rounded-full text-white " />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usage?.users.current || 1}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active team members
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs Content (Inner Dashboard Tabs) */}
            <Tabs defaultValue="activity" className="space-y-4">
              <TabsList>
                <TabsTrigger className="cursor-pointer" value="activity">Recent Activity</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="team">Team Members</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="usage">Usage Details</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                      Latest actions in your workspace
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {notifications.length > 0 ? (
                      <div className="space-y-4">
                        {notifications.map((notif) => (
                          <div key={notif.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push('/organisation/notifications')}>
                            <div className={`p-2 rounded-full mt-1 ${notif.isSuccess ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                              <Megaphone className="size-4" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium leading-none">{notif.message}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(notif.createdAt)}
                                </p>
                                {notif.platform && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 capitalize">
                                    {notif.platform.toLowerCase()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <p>No recent activity to show yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>
                          Manage your team members and their roles
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {user && (
                        <div className="flex items-center justify-between py-3 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{getUserInitials(user.firstName, user.lastName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {[user.firstName, user.lastName].filter(Boolean).join(" ") || "User"}
                              </p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{user.role.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="usage" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Usage Details</CardTitle>
                    <CardDescription>
                      Detailed breakdown of your usage and limits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {usage ? (
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Monthly Posts</span>
                            <span className="text-sm text-muted-foreground">{usage.postsThisMonth.current} / {usage.postsThisMonth.limit}</span>
                          </div>
                          <Progress value={usage.postsThisMonth.percentage} className={usage.postsThisMonth.isNearLimit ? "bg-red-100" : ""} />
                        </div>

                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Total Contacts</span>
                            <span className="text-sm text-muted-foreground">{usage.contacts.current} / {usage.contacts.limit}</span>
                          </div>
                          <Progress value={usage.contacts.percentage} />
                        </div>

                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Campaigns</span>
                            <span className="text-sm text-muted-foreground">{usage.campaigns.current} / {usage.campaigns.limit}</span>
                          </div>
                          <Progress value={usage.campaigns.percentage} />
                        </div>

                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Platform Connections</span>
                            <span className="text-sm text-muted-foreground">{usage.platforms.current} / {usage.platforms.limit}</span>
                          </div>
                          <Progress value={usage.platforms.percentage} />
                        </div>

                        {usage.postsThisMonth.isNearLimit && (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            You've used {usage.postsThisMonth.percentage}% of your monthly post limit. Consider upgrading for more.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-muted/50 rounded-lg text-sm text-center text-muted-foreground">
                        Loading usage metrics...
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="calendar" className="h-full">
            <CalendarView posts={scheduledPosts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
