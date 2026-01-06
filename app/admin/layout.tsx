import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  console.log("=== ADMIN LAYOUT - Access Check ===");
  console.log("Clerk User ID:", user.id);
  console.log("DB User Role:", dbUser?.role);
  console.log("Is Admin:", dbUser?.role === "ADMIN_USER");
  console.log("===================================");

  // If user doesn't exist in DB or is not admin, redirect
  if (!dbUser || dbUser.role !== "ADMIN_USER") {
    console.log("🔀 Not admin, redirecting to /organisation");
    redirect("/organisation");
  }

  return <>{children}</>;
}
