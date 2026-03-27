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
            include: { plan: true },
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
  if (dbUser.role === "ADMIN_USER" && !isImpersonating) {
    redirect("/admin");
  }

  const organisation = dbUser.organisation;
  const subscription = organisation?.subscriptions?.[0];
  const now = new Date();

  // Check organisation status - skip these checks when admin is impersonating
  if (!isImpersonating && organisation) {
    if (organisation.isDeleted) {
      redirect("/suspended");
    }

    if (!organisation.isApproved) {
      redirect("/pending-approval");
    }

    // Check for trial/subscription validity
    const isTrialValid = organisation.isTrial && organisation.trialEndDate && new Date(organisation.trialEndDate) > now;
    const hasActiveSubscription = subscription &&
      (subscription.status === 'COMPLETED' || subscription.status === 'active' || subscription.status === 'ACTIVE') &&
      (!subscription.endDate || new Date(subscription.endDate) > now);

    if (!isTrialValid && !hasActiveSubscription) {
      redirect("/select-plan");
    }
  }

  let expiryData = null;
  if (organisation) {
    if (organisation.isTrial && organisation.trialEndDate) {
      const trialEndDate = new Date(organisation.trialEndDate);
      const msDiff = trialEndDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 3 && daysRemaining >= 0) {
        expiryData = {
          daysRemaining,
          planName: "Free Trial",
          expiryDate: organisation.trialEndDate.toISOString(),
          type: 'trial' as const
        };
      }
    } else if (subscription && subscription.endDate) {
      const endDate = new Date(subscription.endDate);
      const msDiff = endDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 3 && daysRemaining >= 0 &&
        (subscription.status === 'COMPLETED' || subscription.status === 'active' || subscription.status === 'ACTIVE')) {
        expiryData = {
          daysRemaining,
          planName: subscription.plan?.name || "Paid Plan",
          expiryDate: subscription.endDate.toISOString(),
          type: 'subscription' as const
        };
      }
    }
  }

  const hasSocialTokens = !!(
    dbUser.facebookAccessToken ||
    dbUser.instagramAccessToken ||
    dbUser.linkedInAccessToken ||
    dbUser.pinterestAccessToken ||
    dbUser.youtubeAccessToken ||
    dbUser.facebookPageAccessToken
  );

  return (
    <OrganisationLayoutWrapper
      isImpersonating={isImpersonating}
      hasSocialTokens={hasSocialTokens}
      expiryData={expiryData}
    >
      {children}
    </OrganisationLayoutWrapper>
  );
}
