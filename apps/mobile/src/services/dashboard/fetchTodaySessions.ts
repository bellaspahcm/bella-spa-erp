/**
 * Fetch today's sessions for dashboard
 * Uses RPC for server-side filtering (security and performance)
 */

import { isTechnicianRole } from '../../lib/shared-utils';
import { getMobileSupabase } from '../../lib/supabase';

export interface TodaySession {
  id: string;
  bookingId: string;
  status: string;
  assignedTime: string | null;
  customerName: string;
  babyName: string | null;
  packageName: string | null;
  completedSessions: number;
  totalSessions: number;
  ktvName: string | null;
}

/**
 * Fetch today's sessions
 * 
 * KTV: only their assigned sessions (filtered server-side via RPC)
 * Admin/Manager: all sessions
 * 
 * ✅ Week 3 Fix: Removed insecure client-side fallback filter
 * RPC: rpc_mobile_today_sessions(p_tenant_id, p_today, p_ktv_id)
 * 
 * @throws Error if RPC call fails
 */
export async function fetchTodaySessions(params: {
  tenantId: string;
  userId: string;
  role: string;
}): Promise<TodaySession[]> {
  const supabase = getMobileSupabase();
  const { tenantId, userId, role } = params;
  const today = getTodayLocal();

  // Use RPC with server-side filtering
  const ktvId = isTechnicianRole(role) ? userId : null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'rpc_mobile_today_sessions',
    {
      p_tenant_id: tenantId,
      p_today: today,
      p_ktv_id: ktvId,
    },
  );

  if (rpcError) {
    // ✅ No fallback - throw error to force proper error handling in UI
    throw new Error(`Failed to fetch sessions: ${rpcError.message}`);
  }

  if (!rpcData) {
    return [];
  }

  // Map RPC result to TodaySession interface
  return (rpcData as RpcRow[]).map((row) => ({
    id: row.session_id,
    bookingId: row.booking_id,
    status: row.status,
    assignedTime: row.assigned_time,
    customerName: row.customer_name ?? 'Khách',
    babyName: row.baby_name,
    packageName: row.package_name,
    completedSessions: row.completed_sessions ?? 0,
    totalSessions: row.total_sessions ?? 0,
    ktvName: row.ktv_name,
  }));
}

// ── Types ────────────────────────────────────────────────────────────
type RpcRow = {
  session_id: string;
  booking_id: string;
  status: string;
  assigned_time: string | null;
  customer_name: string | null;
  baby_name: string | null;
  ktv_name: string | null;
  package_name: string | null;
  completed_sessions: number | null;
  total_sessions: number | null;
};

function getTodayLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
