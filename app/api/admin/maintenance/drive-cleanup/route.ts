import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { cleanupPendingFiles } from '@/lib/google-drive';
import { withErrorHandling, ApiError } from '@/lib/api-handler';
import { logInfo, logWarning } from '@/lib/audit-logger';

/**
 * GET /api/admin/maintenance/drive-cleanup
 * Manually trigger cleanup of orphaned 'pending' files in Google Drive.
 * Expected to be called by a cron job or an admin.
 */
async function maintenanceHandler(req: NextRequest) {
  console.log('[DRIVE_MAINTENANCE] Received maintenance trigger');
  const user = await currentUser();
  if (!user) {
    console.warn('[DRIVE_MAINTENANCE] Unauthorized attempt (no user)');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is an admin
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { role: true }
  });

  if (dbUser?.role !== 'ADMIN_USER') {
    await logWarning("Unauthorized maintenance attempt", { userId: user.id, action: "drive-cleanup" });
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const maxAgeParam = searchParams.get('maxAge');
  // If maxAge=0, we force cleanup regardless of age
  const maxAgeHours = parseInt(maxAgeParam || '24', 10);
  
  console.log(`[DRIVE_MAINTENANCE] Starting cleanup. Param maxAge: ${maxAgeParam}, applied hours: ${maxAgeHours}`);

  console.log(`[Maintenance] Starting Google Drive cleanup (maxAge: ${maxAgeHours}h)...`);
  
  const result = await cleanupPendingFiles(maxAgeHours);

  await logInfo("Google Drive maintenance cleanup completed", { 
    adminId: user.id, 
    deleted: result.deleted, 
    errors: result.errors 
  });

  return NextResponse.json({
    success: true,
    message: `Cleanup completed: ${result.deleted} files deleted, ${result.errors} errors.`,
    stats: result
  });
}

export const GET = withErrorHandling(maintenanceHandler, "GET /api/admin/maintenance/drive-cleanup");
