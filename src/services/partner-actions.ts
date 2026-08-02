'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';

// Types are now generated from database schema in database.types.ts

export interface PartnerDashboardData {
  totalSalesCount: number;
  totalSalesValue: number;
  pendingBookingsCount: number;
  approvedBookingsCount: number;
  commission: {
    total: number;
    pending: number;
    paid: number;
    latestPaid: number;
  };
  announcements: {
    id: string;
    title: string;
    content: string;
    date: string;
    tag?: string;
  }[];
}

/**
 * Fetch dashboard stats for current logged-in partner/broker
 */
export async function getPartnerDashboardData(): Promise<PartnerDashboardData> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getPartnerDashboardData] User not authenticated');
  }

  const supabase = await createClient();

  // 1. Fetch commission stats from re_commission_ledger
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('re_commission_ledger')
    .select('base_amount, commission_amount, status')
    .eq('user_id', user.id);

  if (ledgerError) {
    console.error('[getPartnerDashboardData] Ledger query failed:', ledgerError);
  }

  let totalSalesValue = 0;
  let totalSalesCount = 0;
  let totalComm = 0;
  let pendingComm = 0;
  let paidComm = 0;
  let latestPaid = 0;

  if (ledgerData && Array.isArray(ledgerData)) {
    (ledgerData as any[]).forEach(item => {
      const base = Number(item.base_amount) || 0;
      const comm = Number(item.commission_amount) || 0;
      totalComm += comm;
      if (item.status === 'paid') {
        paidComm += comm;
        latestPaid = Math.max(latestPaid, comm); // mock simple tracking
      } else if (item.status === 'pending' || item.status === 'approved') {
        pendingComm += comm;
      }
      
      if (item.status !== 'cancelled') {
        totalSalesValue += base;
        totalSalesCount++;
      }
    });
  }

  // 2. Fetch booking counts from re_reservations
  const { data: resData, error: resError } = await supabase
    .from('re_reservations')
    .select('status')
    .eq('user_id', user.id);

  if (resError) {
    console.error('[getPartnerDashboardData] Reservations query failed:', resError);
  }

  let pendingBookingsCount = 0;
  let approvedBookingsCount = 0;

  if (resData && Array.isArray(resData)) {
    (resData as any[]).forEach(r => {
      if (r.status === 'active') {
        pendingBookingsCount++;
      } else if (r.status === 'converted') {
        approvedBookingsCount++;
      }
    });
  }

  // Announcements list (policies, hot sales, info)
  const announcements = [
    {
      id: 'ann-1',
      title: 'Chính sách bán hàng đợt 2 - Phân khu Sapphire',
      content: 'Chiết khấu lên tới 8% cho khách hàng thanh toán sớm 95%. Tặng ngay voucher nội thất trị giá 150 triệu.',
      date: '2026-08-01',
      tag: 'Chính sách',
    },
    {
      id: 'ann-2',
      title: 'Thưởng nóng giao dịch Villa tháng 8/2026',
      content: 'Nhận ngay 1 cây vàng SJC khi chốt thành công 1 căn Villa đơn lập thuộc dự án Bella Riverside.',
      date: '2026-08-01',
      tag: 'Thống kê thưởng',
    },
    {
      id: 'ann-3',
      title: 'Cập nhật tài liệu Sales Kit & Pháp lý mới',
      content: 'Brochure và giấy phép xây dựng của Block B Sapphire đã được cập nhật vào kho tài liệu.',
      date: '2026-07-28',
      tag: 'Tài liệu',
    }
  ];

  return {
    totalSalesCount,
    totalSalesValue,
    pendingBookingsCount,
    approvedBookingsCount,
    commission: {
      total: totalComm,
      pending: pendingComm,
      paid: paidComm,
      latestPaid,
    },
    announcements,
  };
}

export interface PartnerInventoryItem {
  id: string;
  project_id: string;
  project_name: string;
  product_code: string;
  product_type: 'apartment' | 'townhouse' | 'shophouse' | 'villa';
  floor: string | null;
  block: string | null;
  area: number;
  unit_price: number;
  status: 'available' | 'booked' | 'deposited' | 'contracted' | 'paid' | 'handed_over' | 'cancelled';
  owner_name: string | null;
}

/**
 * Fetch read-only inventory (giỏ hàng căn hộ)
 */
export async function getPartnerInventory(): Promise<PartnerInventoryItem[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getPartnerInventory] User not authenticated');
  }

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('real_estate_products')
    .select(`
      id,
      project_id,
      product_code,
      product_type,
      floor,
      block,
      area,
      unit_price,
      status,
      owner_name,
      real_estate_projects (
        name
      )
    `)
    .eq('tenant_id', user.tenant_id)
    .order('product_code', { ascending: true });

  if (error) {
    console.error('[getPartnerInventory] Query failed:', error);
    throw new Error(`Failed to fetch inventory: ${error.message}`);
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    project_id: p.project_id,
    project_name: p.real_estate_projects?.name || 'Dự án BĐS',
    product_code: p.product_code,
    product_type: p.product_type,
    floor: p.floor,
    block: p.block,
    area: Number(p.area) || 0,
    unit_price: Number(p.unit_price) || 0,
    status: p.status,
    owner_name: p.owner_name,
  }));
}

export interface PartnerCommissionItem {
  id: string;
  transaction_type: 'booking' | 'deposit' | 'contract' | 'payment_milestone' | 'adjustment';
  base_amount: number;
  commission_rate: number | null;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  earned_date: string;
  notes: string | null;
  product_code?: string;
}

/**
 * Fetch commission history for commission wallet
 */
export async function getPartnerCommissions(): Promise<PartnerCommissionItem[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getPartnerCommissions] User not authenticated');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('re_commission_ledger')
    .select(`
      id,
      transaction_type,
      base_amount,
      commission_rate,
      commission_amount,
      status,
      earned_date,
      notes,
      real_estate_products (
        product_code
      )
    `)
    .eq('user_id', user.id)
    .order('earned_date', { ascending: false });

  if (error) {
    console.error('[getPartnerCommissions] Query failed:', error);
    throw new Error(`Failed to fetch commissions: ${error.message}`);
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    transaction_type: c.transaction_type,
    base_amount: Number(c.base_amount) || 0,
    commission_rate: c.commission_rate ? Number(c.commission_rate) : null,
    commission_amount: Number(c.commission_amount) || 0,
    status: c.status,
    earned_date: c.earned_date,
    notes: c.notes,
    product_code: c.real_estate_products?.product_code,
  }));
}

export interface PartnerDocumentItem {
  id: string;
  title: string;
  description: string | null;
  document_type: 'brochure' | 'price_list' | 'legal_docs' | 'bank_policy' | 'faq' | 'training' | 'contract_template' | 'other';
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  version: string;
}

/**
 * Fetch sales documents / kits
 */
export async function getPartnerDocuments(): Promise<PartnerDocumentItem[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getPartnerDocuments] User not authenticated');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('re_documents')
    .select('id, title, description, document_type, file_url, file_name, file_size_bytes, version')
    .eq('tenant_id', user.tenant_id)
    .eq('is_latest', true);

  if (error) {
    console.error('[getPartnerDocuments] Query failed:', error);
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data || []).map((d: any) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    document_type: d.document_type,
    file_url: d.file_url,
    file_name: d.file_name,
    file_size_bytes: Number(d.file_size_bytes) || null,
    version: d.version,
  }));
}

export interface PartnerBookingItem {
  id: string;
  product_code: string;
  project_name: string;
  customer_name: string;
  status: 'active' | 'released' | 'expired' | 'converted';
  expires_at: string;
  created_at: string;
  deposit_proof_url?: string;
}

/**
 * Fetch partner's reservations
 */
export async function getPartnerBookings(): Promise<PartnerBookingItem[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[getPartnerBookings] User not authenticated');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('re_reservations')
    .select(`
      id,
      status,
      expires_at,
      created_at,
      metadata,
      real_estate_products (
        product_code,
        real_estate_projects (
          name
        )
      ),
      customers (
        name_mother
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getPartnerBookings] Query failed:', error);
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    product_code: r.real_estate_products?.product_code || 'N/A',
    project_name: r.real_estate_products?.real_estate_projects?.name || 'Dự án',
    customer_name: r.customers?.name_mother || r.metadata?.customerName || 'Khách hàng',
    status: r.status,
    expires_at: r.expires_at,
    created_at: r.created_at,
    deposit_proof_url: r.metadata?.depositProofUrl,
  }));
}

/**
 * Create a new hold reservation for partner
 */
export async function createPartnerBooking(params: {
  productId: string;
  customerName: string;
  customerPhone: string;
  depositProofUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    throw new Error('[createPartnerBooking] User not authenticated');
  }

  const supabase = await createClient();

  // Call the core RPC reserve_product (defined in reservation_engine migration)
  const { data, error } = await supabase.rpc('reserve_product' as any, { // TODO: Regenerate types after migration
    p_tenant_id: user.tenant_id,
    p_product_id: params.productId,
    p_user_id: user.id,
    p_customer_id: null, // Custom flow for new lead without saved customer row yet
    p_duration_minutes: 1440, // 24 hours lock
  });

  if (error) {
    console.error('[createPartnerBooking] RPC error:', error);
    return { success: false, error: error.message };
  }

  const res = data as any;
  if (!res.success) {
    return { success: false, error: res.error };
  }

  // Update metadata with customer details and payment proof image url
  const { error: updateError } = await supabase
    .from('re_reservations')
    .update({
      metadata: {
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        depositProofUrl: params.depositProofUrl || null,
      }
    })
    .eq('id', res.reservation_id);

  if (updateError) {
    console.error('[createPartnerBooking] Metadata update error:', updateError);
  }

  return { success: true };
}

/**
 * BOOKINGS MODULE - Additional functions
 */

export async function fetchPartnerBookings(userId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('re_reservations')
    .select(`
      id,
      status,
      expires_at,
      created_at,
      metadata,
      real_estate_products (
        product_code,
        real_estate_projects (
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((r: any) => ({
    id: r.id,
    project_name: r.real_estate_products?.real_estate_projects?.name || 'Dự án',
    unit_code: r.real_estate_products?.product_code || 'N/A',
    customer_name: r.metadata?.customerName || 'Khách hàng',
    customer_phone: r.metadata?.customerPhone || '',
    deposit_amount: r.metadata?.depositAmount || 0,
    status: r.status === 'active' ? 'pending' : r.status === 'converted' ? 'approved' : r.status,
    created_at: r.created_at,
    documents: r.metadata?.documents || [],
  }));
}

export async function createBookingRequest(params: {
  user_id: string;
  project_name: string;
  unit_code: string;
  customer_name: string;
  customer_phone: string;
  deposit_amount: number;
}) {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Not authenticated');

  const supabase = await createClient();

  // Find product by code
  const { data: product } = await supabase
    .from('real_estate_products')
    .select('id')
    .eq('tenant_id', user.tenant_id)
    .eq('product_code', params.unit_code)
    .single();

  if (!product) throw new Error('Căn hộ không tồn tại');

  // Create reservation
  const { error } = await supabase.from('re_reservations').insert({
    tenant_id: user.tenant_id,
    product_id: (product).id,
    user_id: params.user_id,
    status: 'active',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    metadata: {
      customerName: params.customer_name,
      customerPhone: params.customer_phone,
      depositAmount: params.deposit_amount,
      documents: [],
    },
  });

  if (error) throw error;
}

export async function uploadBookingDocument(
  bookingId: string,
  file: File,
  docType: string
) {
  // Mock implementation - in production would upload to Supabase Storage
  const supabase = await createClient();
  
  const { data: reservation } = await supabase
    .from('re_reservations')
    .select('metadata')
    .eq('id', bookingId)
    .single();

  if (!reservation) throw new Error('Booking not found');

  const metadata = (reservation).metadata as any || {};
  const documents = metadata.documents || [];
  
  documents.push({
    name: file.name,
    type: docType,
    url: `https://storage.example.com/${file.name}`, // Mock URL
  });

  const { error } = await supabase
    .from('re_reservations')
    .update({ metadata: { ...metadata, documents } })
    .eq('id', bookingId);

  if (error) throw error;
}

/**
 * COMMISSION MODULE - Additional functions
 */

export async function fetchPartnerCommissions(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('re_commission_ledger')
    .select(`
      id,
      transaction_type,
      base_amount,
      commission_rate,
      commission_amount,
      status,
      earned_date,
      paid_date,
      notes,
      real_estate_products (
        product_code,
        real_estate_projects (
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('earned_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((c: any) => ({
    id: c.id,
    booking_id: c.id,
    project_name: c.real_estate_products?.real_estate_projects?.name || 'Dự án',
    unit_code: c.real_estate_products?.product_code || 'N/A',
    transaction_amount: Number(c.base_amount) || 0,
    commission_rate: Number(c.commission_rate) || 0,
    commission_amount: Number(c.commission_amount) || 0,
    tax_deduction: Number(c.commission_amount) * 0.1 || 0, // Mock 10% tax
    net_amount: Number(c.commission_amount) * 0.9 || 0,
    status: c.status as 'pending' | 'approved' | 'paid',
    approved_date: c.status === 'approved' || c.status === 'paid' ? c.earned_date : null,
    paid_date: c.paid_date,
    created_at: c.earned_date,
  }));
}

/**
 * DOCUMENTS MODULE - Additional functions
 */

export async function fetchPartnerDocuments() {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Not authenticated');

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('re_documents')
    .select(`
      id,
      title,
      description,
      document_type,
      file_url,
      file_name,
      file_size_bytes,
      created_at,
      real_estate_projects (
        name
      )
    `)
    .eq('tenant_id', user.tenant_id)
    .eq('is_latest', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const categoryMap: Record<string, any> = {
    brochure: 'brochure',
    price_list: 'price_list',
    legal_docs: 'legal',
    bank_policy: 'policy',
    faq: 'sales_kit',
    training: 'sales_kit',
    contract_template: 'legal',
    other: 'media',
  };

  return (data || []).map((d: any) => ({
    id: d.id,
    title: d.title,
    category: categoryMap[d.document_type] || 'media',
    file_type: d.file_name.split('.').pop() || 'pdf',
    file_size: Number(d.file_size_bytes) || 0,
    file_url: d.file_url,
    description: d.description,
    uploaded_at: d.created_at,
    project_name: d.real_estate_projects?.name,
  }));
}

export async function downloadDocument(fileUrl: string, fileName: string) {
  // In browser - trigger download
  if (typeof window !== 'undefined') {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * INBOX MODULE - Additional functions
 */

export async function fetchPartnerNotifications(userId: string) {
  // Mock data - in production would query notifications table
  return [
    {
      id: '1',
      type: 'booking_approved' as const,
      title: 'Booking được duyệt',
      message: 'Yêu cầu giữ chỗ căn S1.05.08 đã được phê duyệt',
      is_read: false,
      created_at: new Date().toISOString(),
      metadata: { booking_id: 'b1' },
    },
    {
      id: '2',
      type: 'commission_paid' as const,
      title: 'Thanh toán hoa hồng',
      message: 'Hoa hồng 50,000,000 VNĐ đã được chuyển khoản',
      is_read: false,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      metadata: { commission_id: 'c1', amount: 50000000 },
    },
    {
      id: '3',
      type: 'policy_update' as const,
      title: 'Cập nhật chính sách',
      message: 'Chính sách bán hàng tháng 8 đã có thay đổi',
      is_read: true,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

export async function markNotificationAsRead(notificationId: string) {
  // Mock implementation
  return { success: true };
}

/**
 * PROFILE MODULE - Additional functions
 */

export async function fetchPartnerProfile(userId: string) {
  const supabase = await createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, metadata')
    .eq('id', userId)
    .single();

  if (error) throw error;

  const metadata = (user.metadata) || {};

  return {
    id: user.id,
    full_name: metadata.full_name || 'Partner',
    email: user.email || '',
    phone: metadata.phone || '',
    partner_code: metadata.partner_code || 'P-001',
    partner_type: metadata.partner_type || 'CTV',
    company_name: metadata.company_name,
    tax_code: metadata.tax_code,
    address: metadata.address,
    bank_account: metadata.bank_account,
    created_at: metadata.created_at || new Date().toISOString(),
  };
}

export async function updatePartnerProfile(
  userId: string,
  updates: {
    full_name?: string;
    phone?: string;
    company_name?: string;
    tax_code?: string;
    address?: string;
  }
) {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from('users')
    .select('metadata')
    .eq('id', userId)
    .single();

  const metadata = { ...(current?.metadata as any || {}), ...updates };

  const { error } = await supabase
    .from('users')
    .update({ metadata })
    .eq('id', userId);

  if (error) throw error;
}

export async function updateBankAccount(
  userId: string,
  bankInfo: {
    bank_name: string;
    account_number: string;
    account_holder: string;
    branch?: string;
  }
) {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from('users')
    .select('metadata')
    .eq('id', userId)
    .single();

  const metadata = { 
    ...(current?.metadata as any || {}), 
    bank_account: bankInfo 
  };

  const { error } = await supabase
    .from('users')
    .update({ metadata })
    .eq('id', userId);

  if (error) throw error;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

/**
 * LEAD MANAGEMENT MODULE - API Integration
 */

export interface PartnerLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  budget: string | null;
  status: 'registered' | 'interested' | 'booking' | 'deposited' | 'contracted' | 'lost';
  notes: string | null;
  created_at: string;
  protected_until: string;
  isProtected?: boolean;
  daysRemaining?: number;
}

export interface LeadAnalytics {
  total: number;
  protected: number;
  hot: number; // interested status
  converted: number; // contracted status
  conversionRate: number; // percentage
  byStatus: {
    registered: number;
    interested: number;
    booking: number;
    deposited: number;
    contracted: number;
    lost: number;
  };
}

/**
 * Fetch all leads for current partner
 */
export async function fetchPartnerLeads(): Promise<PartnerLead[]> {
  const response = await fetch('/api/partner/leads', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch leads');
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Calculate lead analytics from lead data
 */
export async function fetchLeadAnalytics(): Promise<LeadAnalytics> {
  const leads = await fetchPartnerLeads();
  
  const now = new Date();
  const byStatus = {
    registered: 0,
    interested: 0,
    booking: 0,
    deposited: 0,
    contracted: 0,
    lost: 0,
  };

  let protected_count = 0;
  
  leads.forEach(lead => {
    byStatus[lead.status]++;
    
    if (new Date(lead.protected_until) > now) {
      protected_count++;
    }
  });

  const total = leads.length;
  const hot = byStatus.interested;
  const converted = byStatus.contracted;
  const conversionRate = total > 0 ? (converted / total) * 100 : 0;

  return {
    total,
    protected: protected_count,
    hot,
    converted,
    conversionRate,
    byStatus,
  };
}

/**
 * Create a new lead with duplicate phone check
 */
export async function createPartnerLead(params: {
  name: string;
  phone: string;
  email?: string;
  budget?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: PartnerLead; error?: string }> {
  const response = await fetch('/api/partner/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const result = await response.json();

  if (!response.ok) {
    return { 
      success: false, 
      error: result.error || 'Failed to create lead' 
    };
  }

  return { 
    success: true, 
    data: result.data 
  };
}

/**
 * Update lead status or other fields
 */
export async function updatePartnerLeadStatus(
  leadId: string,
  updates: {
    status?: 'registered' | 'interested' | 'booking' | 'deposited' | 'contracted' | 'lost';
    notes?: string;
    budget?: string;
    email?: string;
  }
): Promise<{ success: boolean; data?: PartnerLead; error?: string }> {
  const response = await fetch(`/api/partner/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  const result = await response.json();

  if (!response.ok) {
    return { 
      success: false, 
      error: result.error || 'Failed to update lead' 
    };
  }

  return { 
    success: true, 
    data: result.data 
  };
}

/**
 * Delete a lead (soft delete to 'lost' status)
 */
export async function deletePartnerLead(leadId: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/partner/leads/${leadId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();

  if (!response.ok) {
    return { 
      success: false, 
      error: result.error || 'Failed to delete lead' 
    };
  }

  return { success: true };
}
