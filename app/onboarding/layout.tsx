import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get user from database with organization and subscription details
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    include: { 
      organisation: {
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        }
      }
    },
  });

  // Log user role information
  console.log("=== ONBOARDING LAYOUT - User Role Check ===");
  console.log("Clerk User ID:", user.id);
  console.log("Database User Role:", dbUser?.role);
  console.log("Has Organisation:", !!dbUser?.organisationId);
  console.log("Has Active Subscription:", !!dbUser?.organisation?.subscriptions?.[0]);
  console.log("==========================================");

  // SCENARIO 1: Admin users - redirect to admin dashboard
  if (dbUser?.role === "ADMIN_USER") {
    console.log("🔀 Admin user - Redirecting to /admin");
    redirect("/admin");
  }

  // SCENARIO 2: Users with organization AND active subscription - redirect to organisation page
  if (dbUser?.organisationId && dbUser?.organisation?.subscriptions?.[0]) {
    console.log("🔀 User has organization with subscription - Redirecting to /organisation");
    redirect("/organisation");
  }

  // SCENARIO 3: Users with organization but NO subscription (from enquiry) - allow onboarding
  // SCENARIO 4: New users - allow onboarding
  console.log("📝 User needs onboarding - Showing onboarding page");

  return <>{children}</>;
}
