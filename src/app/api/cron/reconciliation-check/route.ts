import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Daily reconciliation check — Phase 29.5
 *
 * Trigger: Vercel Cron 4 AM daily.
 * Logic:
 *   1. Loop every active tenant
 *   2. Run get_reconciliation_report() for last 7 days
 *   3. Find MAJOR_DIFF rows (>= 1% mismatch)
 *   4. Capture Sentry message with tenant_id + diff details
 *   5. Return aggregate summary
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Reconciliation Cron] CRON_SECRET env var not set.');
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    console.warn('[Reconciliation Cron] Unauthorized trigger attempt.');
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  console.log('[Reconciliation Cron] Starting daily reconciliation check...');

  try {
    const supabase = getAdminClient();

    // Get all active tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active');

    if (tenantsErr) {
      throw new Error(`Failed to fetch tenants: ${tenantsErr.message}`);
    }

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fromStr = sevenDaysAgo.toISOString().slice(0, 10);
    const toStr = today.toISOString().slice(0, 10);

    let totalChecked = 0;
    let totalMatches = 0;
    let totalMinor = 0;
    let totalMajor = 0;
    const majorAlerts: any[] = [];

    for (const tenant of tenants || []) {
      try {
        const { data: rows, error } = await supabase.rpc('get_reconciliation_report', {
          p_tenant_id: tenant.id,
          p_from_date: fromStr,
          p_to_date: toStr,
        });

        if (error) {
          // Skip tenant on RPC error but log; security_definer in SQL handles permission
          // The check may fail if tenant doesn't have HQ context — that's fine, fall through.
          console.warn(`[Reconciliation Cron] RPC failed for tenant ${tenant.name}: ${error.message}`);
          continue;
        }

        for (const row of (rows as any[]) || []) {
          totalChecked++;
          if (row.status === 'MATCH') totalMatches++;
          else if (row.status === 'MINOR_DIFF') totalMinor++;
          else if (row.status === 'MAJOR_DIFF') {
            totalMajor++;
            majorAlerts.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              category: row.category,
              category_label: row.category_label,
              legacy: row.legacy_amount,
              ledger: row.ledger_amount,
              diff: row.diff_amount,
              diff_percent: row.diff_percent,
            });
          }
        }
      } catch (innerErr: any) {
        console.error(`[Reconciliation Cron] Tenant ${tenant.name} failed:`, innerErr?.message);
        Sentry.captureException(innerErr, { tags: { tenant_id: tenant.id, tenant_name: tenant.name } });
      }
    }

    // Send Sentry alert if any major mismatches found
    if (majorAlerts.length > 0) {
      Sentry.captureMessage(
        `[Accounting Reconciliation] ${majorAlerts.length} MAJOR_DIFF mismatches found in past 7 days (period ${fromStr} → ${toStr})`,
        {
          level: 'warning',
          extra: { period: { from: fromStr, to: toStr }, mismatches: majorAlerts },
        }
      );
      console.warn(`[Reconciliation Cron] ${majorAlerts.length} MAJOR mismatches sent to Sentry`);
    }

    const summary = {
      success: true,
      period: { from: fromStr, to: toStr },
      tenants_checked: (tenants || []).length,
      total_indicators: totalChecked,
      matches: totalMatches,
      minor_diffs: totalMinor,
      major_diffs: totalMajor,
      match_rate_percent: totalChecked > 0 ? Number(((totalMatches / totalChecked) * 100).toFixed(2)) : 0,
      major_alerts_sent: majorAlerts.length,
    };

    console.log('[Reconciliation Cron] Finished:', JSON.stringify(summary));
    return NextResponse.json(summary);

  } catch (globalErr: any) {
    console.error('[Reconciliation Cron] Critical exception:', globalErr);
    Sentry.captureException(globalErr);
    return NextResponse.json(
      { success: false, error: globalErr?.message || 'Reconciliation cron failed.' },
      { status: 500 }
    );
  }
}
