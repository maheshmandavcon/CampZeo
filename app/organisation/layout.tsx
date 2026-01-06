import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OrganisationLayoutWrapper } from "./_components/organisation-layout-wrapper";
import { isAdminImpersonating } from "@/lib/admin-impersonation";

export default async function OrganisationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check for admin impersonation cookie early
  const isImpersonating = await isAdminImpersonating();

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    include: {
      organisation: {
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  // If user doesn't exist in DB, redirect to onboarding
  if (!dbUser) {
    redirect("/onboarding");
  }

  // If user doesn't have an organisation, redirect to onboarding (skip for admins)
  if (!dbUser.organisationId && dbUser.role !== 'ADMIN_USER') {
    redirect("/onboarding");
  }

  // If user is admin and NOT impersonating, redirect to admin dashboard
  // When impersonating, allow admin to access organization routes
  if (dbUser.role === "ADMIN_USER" && !isImpersonating) {
    redirect("/admin");
  }

  // Check organisation status - skip these checks when admin is impersonating
  if (!isImpersonating) {
    if (dbUser.organisation && dbUser.organisation.isDeleted) {
      redirect("/suspended");
    }

    if (dbUser.organisation && !dbUser.organisation.isApproved) {
      redirect("/pending-approval");
    }

    // Check for trial/subscription validity
    const organisation = dbUser.organisation;
    const subscription = organisation?.subscriptions?.[0];
    const now = new Date();

    // Check if trial is valid
    const isTrialValid = organisation?.isTrial && organisation?.trialEndDate && organisation.trialEndDate > now;

    // Check if has active subscription
    // Assuming 'COMPLETED' or 'active' statuses indicate a valid paid subscription
    // And checking endDate if it exists
    const hasActiveSubscription = subscription &&
      (subscription.status === 'COMPLETED' || subscription.status === 'active' || subscription.status === 'ACTIVE') &&
      (!subscription.endDate || subscription.endDate > now);

    if (!isTrialValid && !hasActiveSubscription) {
      redirect("/select-plan");
    }
  }

  return <OrganisationLayoutWrapper isImpersonating={isImpersonating}>{children}</OrganisationLayoutWrapper>;
}
