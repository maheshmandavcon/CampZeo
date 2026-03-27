import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
      include: { organisation: true },
    });

    if (!dbUser) {
      return NextResponse.redirect(new URL('/sign-up', req.url));
    }

    if (dbUser.organisation) {
      return NextResponse.redirect(new URL('/organisation', req.url));
    }

    return NextResponse.redirect(new URL('/sign-up', req.url));
  } catch (error) {
    console.error('Error in after-signin redirect:', error);
    return NextResponse.redirect(new URL('/sign-up', req.url));
  }
}
