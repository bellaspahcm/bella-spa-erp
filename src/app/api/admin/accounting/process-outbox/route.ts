import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

/**
 * Manual Accounting Outbox Processing
 * 
 * Allows accountants to manually trigger processing of pending accounting entries
 * instead of waiting for the cron job (which runs every 15 minutes).
 * 
 * POST /api/admin/accounting/process-outbox
 * 
 * Security:
 * - Requires authenticated user
 * - Requires Admin or Accountant role
 * 
 * Returns:
 * - processed: number of entries processed
 * - errors: number of entries that failed
 * - total: total pending entries found
 */
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    
    // Security: Only Admin can trigger manual processing
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check role
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can process accounting entries' },
        { status: 403 }
      );
    }

    // Trigger the accounting worker cron endpoint
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Server configuration error: CRON_SECRET not set' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    
    const cronUrl = `${baseUrl}/api/cron/accounting-worker`;

    console.log('[Accounting Outbox] Triggering manual processing via', cronUrl);

    // Call the cron endpoint with authorization
    const response = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Accounting Outbox] Manual processing failed:', result);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to trigger accounting worker',
          details: result,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      processed: result.processed || 0,
      successCount: result.successCount || 0,
      failureCount: result.failureCount || 0,
      deadLetterCount: result.deadLetterCount || 0,
      timestamp: new Date().toISOString(),
      triggered_by: currentUser.id,
    });
  } catch (error) {
    console.error('[Accounting Outbox] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get status of accounting outbox
 * 
 * GET /api/admin/accounting/process-outbox
 */
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.tenant_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get count of pending entries in accounting_outbox
    const { count: pendingCount } = await supabase
      .from('accounting_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', currentUser.tenant_id)
      .eq('status', 'PENDING');

    // Get count of failed entries (within retry limit)
    const { count: failedCount } = await supabase
      .from('accounting_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', currentUser.tenant_id)
      .eq('status', 'RETRYING');

    // Get count of dead-lettered entries (permanently failed)
    const { count: deadCount } = await supabase
      .from('accounting_outbox')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', currentUser.tenant_id)
      .eq('status', 'DEAD');

    // Get latest processed timestamp from accounting_worker_runs
    const { data: latestRun } = await supabase
      .from('accounting_worker_runs')
      .select('finished_at')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      pending: pendingCount || 0,
      retrying: failedCount || 0,
      dead: deadCount || 0,
      total: (pendingCount || 0) + (failedCount || 0),
      last_processed_at: latestRun?.finished_at || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Accounting Outbox] Status check failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
