
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SocialNormalizerService } from '@/lib/social-normalizer';

import { withErrorHandling } from '@/lib/api-handler';
const CRON_SECRET = process.env.CRON_SECRET;

async function getHandler(req: Request) {

        const authHeader = req.headers.get('authorization');


        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            if (process.env.NODE_ENV === 'production') {
                // return new NextResponse('Unauthorized', { status: 401 });
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

        let totalSuccesses = 0;
        let totalFailures = 0;
        const details: any[] = [];

        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value) {
                // Cast to any to access the dynamic properties returned by the service
                const val = r.value as any;
                if (val.totalSuccess !== undefined) {
                    totalSuccesses += val.totalSuccess;
                    totalFailures += val.totalFailed;
                    details.push({
                        user: val.userId,
                        success: val.totalSuccess,
                        failed: val.totalFailed
                    });
                }
            } else if (r.status === 'rejected') {
                console.error('[Scheduler] User sync failed fatally:', r.reason);
            }
        });

        console.log(`[Scheduler] Job Complete. Total Items Synced: ${totalSuccesses}, Failed: ${totalFailures}`);
        console.log('[Scheduler] Details:', JSON.stringify(details));

        return NextResponse.json({
            success: true,
            processed_users: users.length,
            total_items_synced: totalSuccesses,
            total_items_failed: totalFailures,
            details
        });

    
}

export const GET = withErrorHandling(getHandler, "GET /api/scheduler/social-metrics");
