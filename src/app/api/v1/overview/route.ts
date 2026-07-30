/**
 * Overview API - v1
 * 
 * Health check & Partner integration overview endpoint.
 * Validates API key, records request in api_request_logs, and returns system status.
 * 
 * @module api/v1/overview
 */

import { success } from '@/lib/api/response';
import { withSandbox, getSandboxAwareSupabaseClient } from '@/lib/middleware/sandbox.middleware';

/**
 * GET /api/v1/overview
 * Overview & connection test endpoint for authenticated partner
 */
export const GET = withSandbox(
  async (req, { partner, sandbox }) => {
    const supabase = getSandboxAwareSupabaseClient(req);
    const tenantId = partner.tenant_id;
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const monthStart = today.substring(0, 7) + '-01';
    const [y, m] = monthStart.split('-').map(Number);
    const monthEnd = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    // Fetch counts and metrics from database
    const [custRes, apptRes, techRes, staffRes, revRes, expRes] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('session_logs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('assigned_date', today),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'ktv'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('role', 'ktv'),
      supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', monthStart).lt('received_date', monthEnd).eq('tenant_id', tenantId),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart).lt('expense_date', monthEnd).eq('tenant_id', tenantId)
    ]);

    const customer_count = custRes.count ?? 0;
    const appointment_count = apptRes.count ?? 0;
    const technician_count = techRes.count ?? 0;
    const staff_count = staffRes.count ?? 0;
    
    const monthly_revenue = (revRes.data || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const monthly_expenses = (expRes.data || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return success(req, {
      status: 'active',
      partner_id: partner.partner_id,
      partner_name: partner.partner_name,
      tenant_id: partner.tenant_id,
      environment: sandbox.environment,
      allowed_scopes: partner.allowed_scopes,
      timestamp: new Date().toISOString(),
      customer_count,
      appointment_count,
      technician_count,
      staff_count,
      monthly_revenue,
      monthly_expenses
    });
  }
);

/**
 * POST /api/v1/overview
 * Connection ping endpoint (supports POST requests)
 */
export const POST = withSandbox(
  async (req, { partner, sandbox }) => {
    const supabase = getSandboxAwareSupabaseClient(req);
    const tenantId = partner.tenant_id;
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const monthStart = today.substring(0, 7) + '-01';
    const [y, m] = monthStart.split('-').map(Number);
    const monthEnd = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    // Fetch counts and metrics from database
    const [custRes, apptRes, techRes, staffRes, revRes, expRes] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('session_logs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('assigned_date', today),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'ktv'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('role', 'ktv'),
      supabase.from('revenue').select('amount').eq('status', 'confirmed').gte('received_date', monthStart).lt('received_date', monthEnd).eq('tenant_id', tenantId),
      supabase.from('expenses').select('amount').gte('expense_date', monthStart).lt('expense_date', monthEnd).eq('tenant_id', tenantId)
    ]);

    const customer_count = custRes.count ?? 0;
    const appointment_count = apptRes.count ?? 0;
    const technician_count = techRes.count ?? 0;
    const staff_count = staffRes.count ?? 0;
    
    const monthly_revenue = (revRes.data || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const monthly_expenses = (expRes.data || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return success(req, {
      status: 'active',
      partner_id: partner.partner_id,
      partner_name: partner.partner_name,
      tenant_id: partner.tenant_id,
      environment: sandbox.environment,
      allowed_scopes: partner.allowed_scopes,
      timestamp: new Date().toISOString(),
      customer_count,
      appointment_count,
      technician_count,
      staff_count,
      monthly_revenue,
      monthly_expenses
    });
  }
);
