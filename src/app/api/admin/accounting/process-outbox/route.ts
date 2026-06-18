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
    
    // Security: Only Admin and Accountant can trigger manual processing
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check role
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (!profile || !['Admin', 'Accountant'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Admin and Accountant can process accounting entries' },
        { status: 403 }
      );
    }

    // Call the accounting outbox processor
    const { data, error } = await supabase.rpc('process_accounting_outbox');

    if (error) {
      console.error('[Accounting Outbox] Manual processing failed:', error);
      return NextResponse.json(
        { 
          error: 'Failed to process accounting entries',
          details: error.message 
        },
        { status: 500 }
      );
    }

    // Count results
    const result = data as { status: string; entry_id: string }[] | null;
    const processed = result?.filter(r => r.status === 'success').length || 0;
    const errors = result?.filter(r => r.status === 'error').length || 0;
    const total = result?.length || 0;

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total,
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
 * Get status of pending accounting entries
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

    // Get count of pending entries
    const { count: pendingCount } = await supabase
      .from('pending_accounting_entries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', currentUser.tenant_id)
      .eq('status', 'pending');

    // Get count of failed entries
    const { count: failedCount } = await supabase
      .from('pending_accounting_entries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', currentUser.tenant_id)
      .eq('status', 'failed');

    // Get latest processing timestamp
    const { data: latestProcessed } = await supabase
      .from('pending_accounting_entries')
      .select('processed_at')
      .eq('tenant_id', currentUser.tenant_id)
      .not('processed_at', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      pending: pendingCount || 0,
      failed: failedCount || 0,
      last_processed_at: latestProcessed?.processed_at || null,
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
