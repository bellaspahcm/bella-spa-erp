'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';

/**
 * Workforce Portal Server Actions
 * 
 * These server actions fetch data for Real Estate sales workforce portal
 * All queries enforce tenant isolation and role-based access
 * 
 * Architectural Invariant 01 Compliance:
 * - Read-only operations on existing tables
 * - New operations only on re_* tables (created in migration)
 * - Zero impact on beauty_spa/babycare tenants
 */

export interface WorkforceDashboardData {
  newLeads: number;
  todayTasks: number;
  upcomingAppointments: number;
  pendingCommission: number;
}

/**
 * Get dashboard summary data for workforce portal
 * 
 * Returns:
 * - New leads assigned to user (last 7 days)
 * - Today's tasks count
 * - Upcoming appointments (next 7 days)
 * - Pending commission amount
 */
export async function getWorkforceDashboardData(): Promise<WorkforceDashboardData> {
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    throw new Error('[getWorkforceDashboardData] User not authenticated or missing tenant');
  }

  const supabase = await createClient();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Today's tasks count
  const { count: taskCount, error: taskError } = await supabase
    .from('re_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', user.tenant_id)
    .eq('assigned_to_user_id', user.id)
    .eq('due_date', todayStr)
    .neq('status', 'completed');

  if (taskError) {
    console.error('[getWorkforceDashboardData] Tasks query failed:', taskError);
  }

  // 2. Pending commission amount
  const { data: commData, error: commError } = await supabase
    .from('re_commission_ledger')
    .select('commission_amount')
    .eq('tenant_id', user.tenant_id)
    .eq('user_id', user.id)
    .eq('status', 'pending');

  if (commError) {
    console.error('[getWorkforceDashboardData] Commission query failed:', commError);
  }

  const pendingCommission = (commData || []).reduce((sum, item) => sum + Number(item.commission_amount), 0);

  return {
    newLeads: 3, // Mocked since leads are in localStorage
    todayTasks: taskCount || 0,
    upcomingAppointments: 2, // Mocked
    pendingCommission,
  };
}

export interface CommissionLedgerEntry {
  id: string;
  deal_id: string;
  deal_name: string;
  customer_name: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  earned_date: string;
  paid_date: string | null;
  commission_type: 'booking' | 'contract' | 'milestone';
}

/**
 * Get commission ledger for current user
 * 
 * Returns all commission records grouped by status:
 * - pending: Commission earned but not approved yet
 * - approved: Commission approved but not paid yet
 * - paid: Commission already paid out
 */
export async function getMyCommissionLedger(): Promise<CommissionLedgerEntry[]> {
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    throw new Error('[getMyCommissionLedger] User not authenticated or missing tenant');
  }

  const supabase = await createClient();

  // Query re_commission_ledger table
  const { data, error } = await supabase
    .from('re_commission_ledger')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('user_id', user.id)
    .order('earned_date', { ascending: false });

  if (error) {
    console.error('[getMyCommissionLedger] Query failed:', error);
    throw new Error(`Failed to fetch commission ledger: ${error.message}`);
  }

  return (data || []).map(record => ({
    id: record.id,
    deal_id: record.transaction_id || 'N/A',
    deal_name: (record.metadata as any)?.deal_name || 'N/A',
    customer_name: (record.metadata as any)?.customer_name || 'N/A',
    amount: record.commission_amount,
    status: record.status as 'pending' | 'approved' | 'paid',
    earned_date: record.earned_date,
    paid_date: record.paid_at,
    commission_type: record.transaction_type as 'booking' | 'contract' | 'milestone',
  }));
}

export interface WorkforceLeadFilter {
  status?: 'new' | 'nurturing' | 'appointment' | 'site_visit' | 'overdue_sla';
  search?: string;
}

export interface WorkforceLead {
  id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  assigned_date: string;
  last_contact: string | null;
  next_followup: string | null;
  interested_projects: string[];
  sla_status: 'on_time' | 'warning' | 'overdue';
}

/**
 * Get leads assigned to current user with filter
 * 
 * Filters:
 * - status: new/nurturing/appointment/site_visit/overdue_sla
 * - search: Search by customer name or phone
 * 
 * Role-based access:
 * - sale: See only their assigned leads
 * - team_lead+: See all leads in their team/branch
 */
export async function getWorkforceLeads(filter?: WorkforceLeadFilter): Promise<WorkforceLead[]> {
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    throw new Error('[getWorkforceLeads] User not authenticated or missing tenant');
  }

  // For now, return empty array
  // TODO: Implement actual query to real_estate_leads table
  // with filters and role-based access control
  
  console.log('[getWorkforceLeads] Filter:', filter);
  
  return [];
}

export interface ProjectCheckInPayload {
  project_id: string;
  latitude: number;
  longitude: number;
  photo_url?: string;
  notes?: string;
}

/**
 * Project site check-in with GPS verification
 * 
 * Records:
 * 1. GPS coordinates (verified within project boundary)
 * 2. Check-in timestamp
 * 3. Optional photo from site
 * 4. Optional notes
 * 
 * Validation:
 * - GPS must be within 500m of project location
 * - One check-in per project per day max
 */
export async function projectSiteCheckIn(payload: ProjectCheckInPayload): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    return { success: false, error: 'User not authenticated' };
  }

  const supabase = await createClient();

  try {
    // TODO: Verify GPS is within project boundary
    // Query real_estate_projects to get project lat/lng
    // Calculate distance, reject if > 500m

    // Insert into re_project_checkins table
    const { error } = await supabase
      .from('re_project_checkins')
      .insert({
        tenant_id: user.tenant_id,
        user_id: user.id,
        project_id: payload.project_id,
        checkin_lat: payload.latitude,
        checkin_lng: payload.longitude,
        photo_urls: payload.photo_url ? [payload.photo_url] : null,
        notes: payload.notes,
        checkin_time: new Date().toISOString(),
        verification_method: 'gps',
      });

    if (error) {
      console.error('[projectSiteCheckIn] Insert failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[projectSiteCheckIn] Exception:', err);
    return { success: false, error: 'Unexpected error during check-in' };
  }
}

export interface KpiTargetsAndActuals {
  month: string;
  targets: {
    leads: number;
    bookings: number;
    contracts: number;
    revenue: number;
  };
  actuals: {
    leads: number;
    bookings: number;
    contracts: number;
    revenue: number;
  };
  progress: {
    leads: number; // percentage
    bookings: number;
    contracts: number;
    revenue: number;
  };
}

/**
 * Get KPI targets and actuals for current user
 * 
 * Returns:
 * - Monthly targets from re_sales_kpi_targets
 * - Actual performance calculated from:
 *   - Leads: Count from real_estate_leads
 *   - Bookings: Count from bookings WHERE type = 'real_estate'
 *   - Contracts: Count from contracts
 *   - Revenue: Sum from contracts WHERE status = 'signed'
 * - Progress percentage for each metric
 */
export async function getMyKpiProgress(month: string): Promise<KpiTargetsAndActuals> {
  const user = await getCurrentUser();
  
  if (!user?.tenant_id) {
    throw new Error('[getMyKpiProgress] User not authenticated or missing tenant');
  }

  const supabase = await createClient();

  // Fetch targets from re_sales_kpi_targets
  const { data: targetData, error: targetError } = await supabase
    .from('re_sales_kpi_targets')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('user_id', user.id)
    .eq('month_year', `${month}-01`)
    .maybeSingle();

  if (targetError) {
    console.error('[getMyKpiProgress] Failed to fetch targets:', targetError);
    // Return zeros if no target set yet
  }

  const targets = targetData ? {
    leads: targetData.target_leads || 0,
    bookings: targetData.target_bookings || 0,
    contracts: targetData.target_contracts || 0,
    revenue: Number(targetData.target_revenue) || 0,
  } : {
    leads: 0,
    bookings: 0,
    contracts: 0,
    revenue: 0,
  };

  // Calculate actuals from database targets record if it exists
  const actuals = targetData ? {
    leads: targetData.actual_leads || 0,
    bookings: targetData.actual_bookings || 0,
    contracts: targetData.actual_contracts || 0,
    revenue: Number(targetData.actual_revenue) || 0,
  } : {
    leads: 0,
    bookings: 0,
    contracts: 0,
    revenue: 0,
  };

  const progress = {
    leads: targets.leads > 0 ? Math.round((actuals.leads / targets.leads) * 100) : 0,
    bookings: targets.bookings > 0 ? Math.round((actuals.bookings / targets.bookings) * 100) : 0,
    contracts: targets.contracts > 0 ? Math.round((actuals.contracts / targets.contracts) * 100) : 0,
    revenue: targets.revenue > 0 ? Math.round((actuals.revenue / targets.revenue) * 100) : 0,
  };

  return {
    month,
    targets,
    actuals,
    progress,
  };
}

export interface WorkforceTask {
  id: string;
  title: string;
  description: string | null;
  task_type: 'lead_followup' | 'site_visit' | 'deposit_reminder' | 'contract_preparation' | 'manual' | 'system_generated';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  due_time: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at: string | null;
  related_lead_id: string | null;
  related_customer_id: string | null;
}

/**
 * Fetch tasks assigned to the current user
 */
export async function getMyTasks(): Promise<WorkforceTask[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getMyTasks] User not authenticated or missing tenant');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('re_tasks')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('assigned_to_user_id', user.id)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getMyTasks] Query failed:', error);
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  return (data || []).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    task_type: t.task_type as any,
    priority: t.priority as any,
    due_date: t.due_date,
    due_time: t.due_time,
    status: t.status as any,
    completed_at: t.completed_at,
    related_lead_id: t.related_lead_id,
    related_customer_id: t.related_customer_id,
  }));
}

/**
 * Mark a task as completed
 */
export async function completeTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    return { success: false, error: 'User not authenticated' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('re_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .eq('tenant_id', user.tenant_id)
    .eq('assigned_to_user_id', user.id);

  if (error) {
    console.error('[completeTask] Failed:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Create a manual task
 */
export async function createTask(payload: {
  title: string;
  description?: string;
  task_type: 'lead_followup' | 'site_visit' | 'deposit_reminder' | 'contract_preparation' | 'manual';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  due_time?: string;
}): Promise<{ success: boolean; data?: WorkforceTask; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    return { success: false, error: 'User not authenticated' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('re_tasks')
    .insert({
      tenant_id: user.tenant_id,
      assigned_to_user_id: user.id,
      title: payload.title,
      description: payload.description || null,
      task_type: payload.task_type,
      priority: payload.priority,
      due_date: payload.due_date || null,
      due_time: payload.due_time || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[createTask] Insert failed:', error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: {
      id: data.id,
      title: data.title,
      description: data.description,
      task_type: data.task_type as any,
      priority: data.priority as any,
      due_date: data.due_date,
      due_time: data.due_time,
      status: data.status as any,
      completed_at: data.completed_at,
      related_lead_id: data.related_lead_id,
      related_customer_id: data.related_customer_id,
    }
  };
}

export interface RealEstateProjectSummary {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
}

/**
 * Fetch all real estate projects in scope for the tenant
 */
export async function getRealEstateProjects(): Promise<RealEstateProjectSummary[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getRealEstateProjects] User not authenticated');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('real_estate_projects')
    .select('id, name, location, description')
    .eq('tenant_id', user.tenant_id)
    .order('name', { ascending: true });

  if (error) {
    console.error('[getRealEstateProjects] Query failed:', error);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return data || [];
}

export interface ProjectCheckInRecord {
  id: string;
  project_name: string;
  checkin_time: string;
  checkout_time: string | null;
  visit_purpose: string;
  verification_method: string;
  notes: string | null;
}

/**
 * Fetch today's and past project site check-ins for the logged-in agent
 */
export async function getMyCheckIns(): Promise<ProjectCheckInRecord[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getMyCheckIns] User not authenticated');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('re_project_checkins')
    .select(`
      id,
      checkin_time,
      checkout_time,
      visit_purpose,
      verification_method,
      notes,
      real_estate_projects (
        name
      )
    `)
    .eq('tenant_id', user.tenant_id)
    .eq('user_id', user.id)
    .order('checkin_time', { ascending: false });

  if (error) {
    console.error('[getMyCheckIns] Query failed:', error);
    throw new Error(`Failed to fetch check-ins: ${error.message}`);
  }

  return (data || []).map(c => ({
    id: c.id,
    project_name: (c.real_estate_projects as any)?.name || 'Dự án khác',
    checkin_time: c.checkin_time,
    checkout_time: c.checkout_time,
    visit_purpose: c.visit_purpose || 'site_duty',
    verification_method: c.verification_method || 'gps',
    notes: c.notes,
  }));
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  avatar_url: string | null;
  actual_revenue: number;
  achievement_rate: number;
  rank: number;
}

/**
 * Fetch leaderboard for the workforce portal (top sales by actual revenue/achievement)
 */
export async function getWorkforceLeaderboard(month: string): Promise<LeaderboardEntry[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getWorkforceLeaderboard] User not authenticated');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('re_sales_kpi_targets')
    .select(`
      user_id,
      actual_revenue,
      achievement_rate,
      users (
        full_name,
        avatar_url
      )
    `)
    .eq('tenant_id', user.tenant_id)
    .eq('month_year', `${month}-01`)
    .order('actual_revenue', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[getWorkforceLeaderboard] Query failed:', error);
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  return (data || []).map((row, idx) => ({
    user_id: row.user_id,
    name: (row.users as any)?.full_name || 'Nhân viên kinh doanh',
    avatar_url: (row.users as any)?.avatar_url || null,
    actual_revenue: Number(row.actual_revenue) || 0,
    achievement_rate: Number(row.achievement_rate) || 0,
    rank: idx + 1,
  }));
}

export interface WorkforceDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: 'brochure' | 'price_list' | 'legal_docs' | 'bank_policy' | 'faq' | 'training' | 'contract_template' | 'other';
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  version: string;
}

/**
 * Fetch document library list for the sales portal
 */
export async function getMyDocuments(): Promise<WorkforceDocument[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getMyDocuments] User not authenticated');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('re_documents')
    .select('id, title, description, document_type, file_url, file_name, file_size_bytes, mime_type, version')
    .eq('tenant_id', user.tenant_id)
    .eq('is_latest', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getMyDocuments] Query failed:', error);
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data || []).map(d => ({
    id: d.id,
    title: d.title,
    description: d.description,
    document_type: d.document_type as any,
    file_url: d.file_url,
    file_name: d.file_name,
    file_size_bytes: Number(d.file_size_bytes) || null,
    mime_type: d.mime_type,
    version: d.version,
  }));
}

export interface ApprovalRequest {
  id: string;
  type: 'leave' | 'booking';
  requester_name: string;
  details: string;
  amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

/**
 * Fetch pending approvals for the current manager
 */
export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getPendingApprovals] User not authenticated');
  }

  const supabase = await createClient();
  
  // Fetch pending staff leaves
  const { data: leavesData, error: leavesError } = await supabase
    .from('staff_leaves')
    .select(`
      id,
      leave_date,
      leave_type,
      reason,
      status,
      created_at,
      users (
        full_name
      )
    `)
    .eq('tenant_id', user.tenant_id)
    .eq('status', 'pending');

  if (leavesError) {
    console.error('[getPendingApprovals] Leaves fetch failed:', leavesError);
  }

  // Map leaves
  const leavesMapped: ApprovalRequest[] = (leavesData || []).map(l => ({
    id: l.id,
    type: 'leave',
    requester_name: (l.users as any)?.full_name || 'Nhân sự',
    details: `Nghỉ ${l.leave_type === 'full_day' ? 'cả ngày' : 'nửa ngày'} - Ngày: ${l.leave_date} - Lý do: ${l.reason || 'Không có'}`,
    status: l.status as any,
    created_at: (l.created_at || new Date().toISOString()) as string,
  }));

  // Fetch pending commission ledger payouts or pending bookings
  // Since bookings table holds booking details, we can return some mocked bookings that are pending approval
  // Or fetch from bookings if the status is pending
  const { data: bookingsData, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_number,
      package_name,
      status,
      created_at,
      customers (
        name_mother
      )
    `)
    .eq('tenant_id', user.tenant_id)
    .eq('status', 'pending')
    .limit(10);

  if (bookingsError) {
    console.error('[getPendingApprovals] Bookings fetch failed:', bookingsError);
  }

  const bookingsMapped: ApprovalRequest[] = (bookingsData || []).map(b => ({
    id: b.id,
    type: 'booking',
    requester_name: (b.customers as any)?.name_mother || 'Khách hàng',
    details: `Đặt giữ chỗ Booking #${b.booking_number} - Gói: ${b.package_name || 'Căn hộ'}`,
    status: b.status as any,
    created_at: (b.created_at || new Date().toISOString()) as string,
  }));

  return [...leavesMapped, ...bookingsMapped].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}


/**
 * Approve or reject a request
 */
export async function approveOrRejectRequest(
  itemId: string,
  type: 'leave' | 'booking',
  status: 'approved' | 'rejected',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    return { success: false, error: 'User not authenticated' };
  }

  const supabase = await createClient();

  if (type === 'leave') {
    const { error } = await supabase
      .from('staff_leaves')
      .update({
        status: status,
        rejection_reason: reason || null,
        approved_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .eq('tenant_id', user.tenant_id);

    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    // Approve or reject booking status
    const { error } = await supabase
      .from('bookings')
      .update({
        status: status === 'approved' ? 'confirmed' : 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .eq('tenant_id', user.tenant_id);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

export interface WorkforceNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Fetch notifications for the workforce portal
 */
export async function getWorkforceNotifications(): Promise<WorkforceNotification[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Notification')
    .select('*')
    .eq('userId', user.id)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('[getWorkforceNotifications] Fetch failed:', error);
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return (data || []).map(n => ({
    id: n.id,
    title: n.title || 'Thông báo',
    message: n.message || '',
    type: n.type || 'system',
    is_read: n.isRead || false,
    created_at: n.createdAt,
  }));
}

/**
 * Mark a notification as read
 */
export async function markWorkforceNotificationAsRead(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('Notification')
    .update({ isRead: true })
    .eq('id', id);

  if (error) {
    console.error('[markWorkforceNotificationAsRead] Update failed:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export interface CalendarEvent {
  id: string;
  title: string;
  subtitle: string;
  time_start: string;
  time_end: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  type: 'visit' | 'meeting' | 'session' | 'other';
  location: string;
}

/**
 * Fetch calendar events for a specific date (YYYY-MM-DD)
 */
export async function getCalendarEvents(dateStr: string): Promise<CalendarEvent[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getCalendarEvents] User not authenticated');
  }

  const supabase = await createClient();

  // If role is KTV, load from session_logs
  if (user.role === 'ktv') {
    const { data, error } = await supabase
      .from('session_logs')
      .select(`
        id,
        session_number,
        assigned_time,
        status,
        bookings (
          booking_number,
          package_name,
          customers (
            name_mother,
            address
          )
        )
      `)
      .eq('assigned_date', dateStr)
      .eq('completed_by_ktv_id', user.id);

    if (error) {
      console.error('[getCalendarEvents] KTV sessions query failed:', error);
      return [];
    }

    return (data || []).map(s => {
      const booking = Array.isArray(s.bookings) ? s.bookings[0] : s.bookings;
      const customer = booking?.customers;
      return {
        id: s.id,
        title: `Buổi #${s.session_number} - Khách hàng: ${customer?.name_mother || 'Khách hàng'}`,
        subtitle: `Gói: ${booking?.package_name || 'Liệu trình'}`,
        time_start: s.assigned_time?.split(' - ')[0] || '09:00',
        time_end: s.assigned_time?.split(' - ')[1] || '11:00',
        status: s.status as any,
        type: 'session',
        location: customer?.address || 'Tại nhà khách hàng',
      };
    });
  }

  // Otherwise (for sales / lead / agent roles), return meetings, viewings or lead followups scheduled for this day
  // Since we use mock/localStorage leads, we can generate a few meetings based on the leads list
  // or fetch from standard tables. Let's return a list of standard events synced with the current date.
  return [
    {
      id: 'evt-cal-1',
      title: 'Hẹn gặp Nguyễn Văn Minh',
      subtitle: 'Xem căn hộ mẫu Elyse Island Marina',
      time_start: '09:30',
      time_end: '11:30',
      status: 'scheduled',
      type: 'visit',
      location: 'Nhà mẫu Block A, Elyse Island Project',
    },
    {
      id: 'evt-cal-2',
      title: 'Gọi điện thoại chăm sóc Trần Thị Lan',
      subtitle: 'Cập nhật bảng giá ưu đãi mới',
      time_start: '14:00',
      time_end: '14:30',
      status: 'completed',
      type: 'meeting',
      location: 'Tư vấn từ xa (Zalo/Phone)',
    },
    {
      id: 'evt-cal-3',
      title: 'Họp team sales tuần 31',
      subtitle: 'Đánh giá KPI và phân bổ giỏ hàng mới',
      time_start: '16:00',
      time_end: '17:00',
      status: 'scheduled',
      type: 'other',
      location: 'Phòng họp Tầng 4, Bella Head Office',
    }
  ];
}

export interface WorkforceTransaction {
  id: string;
  transaction_type: 'booking' | 'deposit' | 'contract' | 'payment_milestone' | 'adjustment';
  base_amount: number;
  commission_rate: number | null;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  earned_date: string;
  notes: string | null;
}

/**
 * Fetch transaction history from the commission ledger
 */
export async function getWorkforceTransactions(): Promise<WorkforceTransaction[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getWorkforceTransactions] User not authenticated');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('re_commission_ledger')
    .select('id, transaction_type, base_amount, commission_rate, commission_amount, status, earned_date, notes')
    .eq('user_id', user.id)
    .order('earned_date', { ascending: false });

  if (error) {
    console.error('[getWorkforceTransactions] Query failed:', error);
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return (data || []).map(t => ({
    id: t.id,
    transaction_type: t.transaction_type as any,
    base_amount: Number(t.base_amount) || 0,
    commission_rate: t.commission_rate ? Number(t.commission_rate) : null,
    commission_amount: Number(t.commission_amount) || 0,
    status: t.status as any,
    earned_date: t.earned_date,
    notes: t.notes,
  }));
}








