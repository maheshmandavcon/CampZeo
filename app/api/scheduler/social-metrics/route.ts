
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SocialNormalizerService } from '@/lib/social-normalizer';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');

        
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            if (process.env.NODE_ENV === 'production') {
            }
        }

        console.log('[Scheduler] Starting Social Metrics Sync Job...');

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { facebookPageAccessToken: { not: null } },
                    { instagramAccessToken: { not: null } },
                    { linkedInAccessToken: { not: null } },
                    { youtubeAccessToken: { not: null } },
                    { pinterestAccessToken: { not: null } },
                ],
                isApproved: true,
                organisationId: { not: null } // Must belong to an organisation
            },
            select: {
                clerkId: true
            }
        });

        console.log(`[Scheduler] Found ${users.length} users with connected accounts.`);


        const results = await Promise.allSettled(
            users.map(user => SocialNormalizerService.syncUserMetrics(user.clerkId))
        );

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        console.log(`[Scheduler] Job Complete. Success: ${successes}, Failures: ${failures}`);

        return NextResponse.json({
            success: true,
            processed: users.length,
            successes,
            failures
        });

    } catch (error: any) {
        console.error('[Scheduler] Critical Error:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
