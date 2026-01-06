import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { linkedInAccessToken: true }
        });

        if (!dbUser?.linkedInAccessToken) {
            return NextResponse.json({ error: "LinkedIn not connected" }, { status: 400 });
        }

        const accessToken = dbUser.linkedInAccessToken;

        const organizations = [];

        // 1. Fetch managed organizations
        try {
            const aclsRes = await fetch("https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "X-Restli-Protocol-Version": "2.0.0"
                }
            });

            if (aclsRes.ok) {
                const aclsData = await aclsRes.json();

                for (const element of aclsData.elements) {
                    const orgUrn = element.organizationalTarget; // e.g., urn:li:organization:12345
                    const orgId = orgUrn.split(":").pop();

                    // Fetch details
                    const orgRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "X-Restli-Protocol-Version": "2.0.0"
                        }
                    });

                    if (orgRes.ok) {
                        const orgData = await orgRes.json();

                        // Fetch followers
                        const followersRes = await fetch(`https://api.linkedin.com/v2/networkSizes/${orgUrn}?edgeType=CompanyFollowedByMember`, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "X-Restli-Protocol-Version": "2.0.0"
                            }
                        });

                        let followerCount = 0;
                        if (followersRes.ok) {
                            const followersData = await followersRes.json();
                            followerCount = followersData.firstDegreeSize || 0;
                        }

                        organizations.push({
                            id: orgUrn,
                            name: orgData.localizedName,
                            followerCount,
                            type: 'ORGANIZATION'
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Error fetching organizations:", e);
        }

        // 2. Add Personal Profile
        try {
            const profileRes = await fetch("https://api.linkedin.com/v2/me", {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (profileRes.ok) {
                const profileData = await profileRes.json();
                organizations.unshift({
                    id: `urn:li:person:${profileData.id}`,
                    name: `${profileData.localizedFirstName} ${profileData.localizedLastName} (Personal Profile)`,
                    followerCount: null,
                    type: 'PERSON'
                });
            }
        } catch (e) {
            console.error("Error fetching profile:", e);
        }

        return NextResponse.json({ organizations });

    } catch (error) {
        console.error("Error fetching LinkedIn pages:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
