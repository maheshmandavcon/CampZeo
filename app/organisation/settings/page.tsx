import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./_components/settings-client";
import { getImpersonatedOrganisationId } from "@/lib/admin-impersonation";

export default async function SettingsPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { organisationId: true, role: true, firstName: true, lastName: true, mobile: true, email: true, facebookAccessToken: true, instagramAccessToken: true, linkedInAccessToken: true, linkedInAuthUrn: true, youtubeAccessToken: true, pinterestAccessToken: true }
  });

  if (!dbUser) {
    redirect("/onboarding");
  }

  let effectiveOrganisationId = dbUser.organisationId;
  let isImpersonating = false;

  // Check for admin impersonation
  if (dbUser.role === 'ADMIN_USER') {
    const impersonatedId = await getImpersonatedOrganisationId();
    if (impersonatedId) {
      effectiveOrganisationId = impersonatedId;
      isImpersonating = true;
    }
  }

  if (!effectiveOrganisationId) {
    redirect("/onboarding");
  }

  // Fetch the organisation
  const organisation = await prisma.organisation.findUnique({
    where: { id: effectiveOrganisationId },
    include: {
      organisationPlatforms: true
    }
  });

  // If impersonating, we need to show the connections of the target organisation
  // We'll pick the first user of that organisation to show their connection status
  let connectionSource = dbUser;
  if (isImpersonating) {
    const targetUser = await prisma.user.findFirst({
      where: { organisationId: effectiveOrganisationId },
      select: { facebookAccessToken: true, instagramAccessToken: true, linkedInAccessToken: true, linkedInAuthUrn: true, youtubeAccessToken: true, pinterestAccessToken: true }
    });
    if (targetUser) {
      connectionSource = { ...dbUser, ...targetUser };
    }
  }

  const userData = {
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    mobile: dbUser.mobile,
    email: dbUser.email,
    facebookConnected: !!connectionSource.facebookAccessToken,
    instagramConnected: !!connectionSource.instagramAccessToken,
    linkedInConnected: !!connectionSource.linkedInAccessToken,
    linkedInAuthUrn: connectionSource.linkedInAuthUrn,
    youtubeConnected: !!connectionSource.youtubeAccessToken,
    pinterestConnected: !!connectionSource.pinterestAccessToken,
    emailConnected: organisation?.organisationPlatforms.some((p: any) => p.platform === 'EMAIL') ?? false,
    smsConnected: organisation?.organisationPlatforms.some((p: any) => p.platform === 'SMS') ?? false,
    whatsappConnected: organisation?.organisationPlatforms.some((p: any) => p.platform === 'WHATSAPP') ?? false,
  };

  const assignedPlatforms = organisation?.organisationPlatforms.map((p: any) => p.platform) || [];

  return (
    <div className="p-6">
      <div className=" mx-auto space-y-6">
        <SettingsClient
          userData={userData}
          assignedPlatforms={assignedPlatforms}
          isImpersonating={isImpersonating}
        />
      </div>
    </div>
  );
}

