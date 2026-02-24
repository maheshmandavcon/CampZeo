import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCampaignPost } from '@/lib/send-campaign-post';
import { withErrorHandling } from '@/lib/api-handler';

/**
 * SCHEDULER FUNCTIONALITY - CURRENTLY DISABLED
 * 
 * This scheduler API is commented out to use manual sharing instead.
 * The cron job functionality for automatic post scheduling is disabled.
 * 
 * To re-enable:
 * 1. Uncomment the GET function below
 * 2. Set up a cron job to call this endpoint
 * 3. Configure CRON_SECRET environment variable
 * 
 * Scheduler API to check and send scheduled campaign posts
 * This endpoint should be called by a cron job (e.g., every 5 minutes)
 * 
 * GET /api/scheduler/campaign-posts
 */

async function schedulerHandler(request: NextRequest) {
    // 1. Check if scheduler is enabled in settings
    const jobSetting = await prisma.jobSetting.findFirst({
        where: { jobId: 'campaign-post-scheduler' }
    });

    if (!jobSetting || !jobSetting.isEnabled) {
        return NextResponse.json(
            {
                error: 'Scheduler disabled',
                message: 'Automatic scheduling is currently disabled in admin settings.'
            },
            { status: 503 }
        );
    }

    const now = new Date();
    // const frequencyMins = parseInt(jobSetting.cronExpression || "5");

    // 2. Verify the request is from a trusted source (cron job)
    const authHeader = request.headers.get('authorization');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';

    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Scheduler] Running at ${now.toISOString()}`);

    // 3. Find all scheduled posts that are due to be sent
    // Only process posts from active, non-deleted campaigns for approved organisations
    const scheduledPosts = await prisma.campaignPost.findMany({
        where: {
            isPostSent: false,
            scheduledPostTime: {
                lte: now, // Posts scheduled for now or earlier
            },
            isAttachedToCampaign: true,
            isDeleted: false,
            campaign: {
                isDeleted: false,
                startDate: { lte: now },
                endDate: { gte: now },
                organisation: {
                    isApproved: true,
                    isDeleted: false,
                }
            }
        },
        include: {
            campaign: {
                include: {
                    organisation: true,
                    contacts: true,
                },
            },
        },
    });

    console.log(`[Scheduler] Found ${scheduledPosts.length} posts from active campaigns to process`);

    // DIAGNOSTIC code removed for brevity

    const results = {
        total: scheduledPosts.length,
        processed: 0,
        failed: 0,
        errors: [] as any[],
    };

    // 4. Process each scheduled post
    for (const post of scheduledPosts) {
        try {
            console.log(`[Scheduler] Processing post ${post.id} (${post.type})`);

            // Use the shared sendCampaignPost function
            const result = await sendCampaignPost(post);

            if (result.success) {
                // Update post status
                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: { isPostSent: true }
                });

                // Create success notification
                await prisma.notification.create({
                    data: {
                        message: `Scheduled ${post.type} post sent successfully`,
                        isSuccess: true,
                        type: 'CAMPAIGN_POST',
                        platform: post.type,
                        campaignId: post.campaignId,
                        organisationId: post.campaign?.organisationId,
                        referenceId: post.id,
                    },
                });

                results.processed++;
                console.log(`[Scheduler] Post ${post.id} sent successfully`);
            } else {
                results.failed++;
                results.errors.push({
                    postId: post.id,
                    error: result.error || 'Unknown error',
                });

                // Create detailed error notification
                let errorMessage = result.error || 'Unknown error';
                if (typeof errorMessage === 'object') {
                    try {
                        const errorObj = errorMessage as any;
                        // Prefer the human-readable message, falling back to other known fields
                        errorMessage = errorObj.message ||
                            errorObj.error?.message ||
                            errorObj.error_description ||
                            JSON.stringify(errorMessage);
                    } catch (e) {
                        errorMessage = 'Technical error occurred';
                    }
                }

                // Deep sanitation: Strip technical JSON-like fragments and sensitive data
                if (typeof errorMessage === 'string') {
                    // 1. Mask tokens
                    errorMessage = errorMessage.replace(/\b[A-Za-z0-9-_]{20,}\b/g, '[TOKEN]');

                    // 2. Remove technical metadata often found in social API errors
                    errorMessage = errorMessage
                        .replace(/,?\s*"(type|code|error_subcode|error_user_msg|fbtrace_id|help_center_id|is_silent)":\s*("[^"]*"|[^,}\s]*)/g, '')
                        .replace(/\{"error":\{"message":"/g, '')
                        .replace(/"\}\}/g, '')
                        .replace(/\{\s*}/g, '')
                        .trim();

                    // Clean up any double commas or trailing commas that might remain
                    errorMessage = errorMessage.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();
                }

                // Refine message for token/credential issues
                const lowerMsg = errorMessage.toLowerCase();
                const isAuthError = lowerMsg.includes('credential') ||
                    lowerMsg.includes('token') ||
                    lowerMsg.includes('expired') ||
                    lowerMsg.includes('unauthorized');

                let displayMessage = `Failed to send scheduled ${post.type} post: ${errorMessage}`;

                if (isAuthError) {
                    displayMessage = `${post.type} access token expired or invalid. Please reconnect your ${post.type} account. You can also manually trigger and share this post from the Campaign Posts List.`;
                } else {
                    displayMessage += " You can manually trigger and share this post from the Campaign Post Lists.";
                }

                await prisma.notification.create({
                    data: {
                        message: displayMessage,
                        isSuccess: false,
                        type: 'CAMPAIGN_POST',
                        platform: post.type,
                        campaignId: post.campaignId,
                        organisationId: post.campaign?.organisationId,
                        referenceId: post.id,
                    },
                });
            }
        } catch (error) {
            console.error(`[Scheduler] Error processing post ${post.id}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Attempt to save failure reason for fallback tracing
            try {
                await prisma.campaignPost.update({
                    where: { id: post.id },
                    data: {
                        failureReason: `Scheduler Error: ${errorMessage}`.substring(0, 1000),
                        isPostSent: false
                    }
                });
            } catch (saveError) {
                console.error(`[Scheduler] Failed to save failure reason for post ${post.id}`, saveError);
            }

            results.failed++;
            results.errors.push({
                postId: post.id,
                error: errorMessage,
            });
        }
    }

    console.log(`[Scheduler] Completed. Processed: ${results.processed}, Failed: ${results.failed}`);

    // Update last run time
    await prisma.jobSetting.update({
        where: { id: jobSetting.id },
        data: { lastRunAt: now }
    });

    return NextResponse.json({
        success: true,
        timestamp: now.toISOString(),
        results,
    });
}

export const GET = withErrorHandling(schedulerHandler as any, "GET /api/scheduler/campaign-posts");
