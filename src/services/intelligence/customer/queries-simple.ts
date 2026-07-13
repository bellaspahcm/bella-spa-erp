/**
 * Customer Intelligence Queries - Simplified Version
 * 
 * Simple implementations that query base tables directly instead of materialized views.
 * Returns basic metrics with minimal computation.
 */

import type { Database } from '@/types/database.types';
import { QueryError } from '../shared/types';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';

/**
 * Create service role client
 */
async function createServiceRoleClient() {
  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role credentials');
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type CustomerSegmentation = {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalBookings: number;
  totalRevenue: number;
  daysSinceLastBooking: number;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmScore: number;
  segment: 'New' | 'Active' | 'At Risk' | 'Churned';
  churnRiskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  computedAt: string;
};

export type ChurnRiskAnalysis = {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalBookings: number;
  totalRevenue: number;
  daysSinceLastBooking: number;
  churnRiskScore: number;
  churnProbability: number;
  churnRiskLevel: 'Low' | 'Medium' | 'High';
  recommendedActions: string[];
  computedAt: string;
};

export type CohortAnalysis = {
  tenantId: string;
  cohortMonth: string;
  cohortSize: number;
  activeCustomers: number;
  totalRevenue: number;
  avgLTV: number;
  retentionRate: number;
  churnRate: number;
  computedAt: string;
};

export type RFMAnalysis = {
  tenantId: string;
  customerId: string;
  customerName: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmScore: number;
  segment: string;
  computedAt: string;
};

export type CustomerLTV = {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerSince: string;
  cohortMonth: string;
  totalBookings: number;
  lifetimeRevenue: number;
  currentLTV: number;
  projectedAnnualLtv: number;
  customerValueTier: 'Standard' | 'Premium' | 'VIP';
  purchaseFrequency: number;
  activityStatus: 'Active' | 'Inactive' | 'Dormant';
  computedAt: string;
};

export type SegmentDistribution = {
  tenantId: string;
  segment: string;
  customerCount: number;
  percentageOfTotal: number;
  computedAt: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get Customer LTV - Simplified
 */
export async function getCustomerLTV(
  tenantId: string,
  cohortMonth?: string,
  valueTier?: string,
  limit?: number
) {
  const supabase = await createServiceRoleClient();

  // Query customers table
  let query = supabase
    .from('customers')
    .select('id, name_mother, phone, created_at')
    .eq('tenant_id', tenantId);

  const { data: customers, error: customerError } = await query;

  if (customerError) {
    throw customerError;
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('customer_id, full_price, status, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'completed']);

  if (bookingsError) {
    throw bookingsError;
  }

  const bookingsByCustomer = new Map<string, typeof bookings>();
  (bookings || []).forEach((b) => {
    const list = bookingsByCustomer.get(b.customer_id) || [];
    list.push(b);
    bookingsByCustomer.set(b.customer_id, list);
  });

  const now = new Date();
  let ltvList = (customers || []).map((customer) => {
    const custBookings = bookingsByCustomer.get(customer.id) || [];
    const totalBookings = custBookings.length;
    const lifetimeRevenue = custBookings.reduce((sum, b) => sum + Number(b.full_price || 0), 0);
    const customerSince = customer.created_at || new Date().toISOString();
    
    const daysSinceCreation = Math.max(1, Math.ceil(
      (now.getTime() - new Date(customerSince).getTime()) / (1000 * 60 * 60 * 24)
    ));
    const projectedAnnualLtv = Math.round((lifetimeRevenue / daysSinceCreation) * 365);

    const customerValueTier = lifetimeRevenue >= 5000000 
      ? ('VIP' as const)
      : lifetimeRevenue >= 2000000 
      ? ('Premium' as const) 
      : ('Standard' as const);

    const purchaseFrequency = totalBookings / Math.max(1, daysSinceCreation / 30);

    const lastBookingDate = custBookings.length > 0 
      ? custBookings.map(b => b.created_at || '').sort().reverse()[0] 
      : null;

    const daysSinceLastBooking = lastBookingDate 
      ? Math.max(0, Math.ceil((now.getTime() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24))) 
      : 999;

    const activityStatus = daysSinceLastBooking < 30 
      ? ('Active' as const) 
      : daysSinceLastBooking < 90 
      ? ('Inactive' as const) 
      : ('Dormant' as const);

    return {
      tenantId,
      customerId: customer.id,
      customerName: customer.name_mother || 'Unknown',
      customerPhone: customer.phone || '',
      customerSince,
      cohortMonth: customerSince.slice(0, 7),
      totalBookings,
      lifetimeRevenue,
      currentLTV: lifetimeRevenue,
      projectedAnnualLtv,
      customerValueTier,
      purchaseFrequency,
      activityStatus,
      computedAt: new Date().toISOString(),
    };
  });

  // Apply filters
  if (cohortMonth) {
    ltvList = ltvList.filter(item => item.cohortMonth === cohortMonth);
  }
  if (valueTier) {
    ltvList = ltvList.filter(item => item.customerValueTier === valueTier);
  }

  // Sort by lifetimeRevenue desc
  ltvList.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);

  // Apply limit
  if (limit) {
    ltvList = ltvList.slice(0, limit);
  }

  return ltvList;
}

/**
 * Get Customer Segmentation - Simplified
 */
export async function getCustomerSegmentation(
  tenantId: string,
  segment?: string,
  limit?: number
) {
  const supabase = await createServiceRoleClient();

  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, name_mother, phone, created_at')
    .eq('tenant_id', tenantId);

  if (customerError) {
    throw customerError;
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('customer_id, full_price, status, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'completed']);

  if (bookingsError) {
    throw bookingsError;
  }

  const bookingsByCustomer = new Map<string, typeof bookings>();
  (bookings || []).forEach((b) => {
    const list = bookingsByCustomer.get(b.customer_id) || [];
    list.push(b);
    bookingsByCustomer.set(b.customer_id, list);
  });

  const now = new Date();
  let segmentList = (customers || []).map((customer) => {
    const custBookings = bookingsByCustomer.get(customer.id) || [];
    const totalBookings = custBookings.length;
    const totalRevenue = custBookings.reduce((sum, b) => sum + Number(b.full_price || 0), 0);
    
    const lastBookingDate = custBookings.length > 0 
      ? custBookings.map(b => b.created_at || '').sort().reverse()[0] 
      : null;

    const daysSinceLastBooking = lastBookingDate 
      ? Math.max(0, Math.ceil((now.getTime() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24))) 
      : 999;

    // Recency Score (1-4)
    const recencyScore = daysSinceLastBooking <= 15 ? 4 : daysSinceLastBooking <= 30 ? 3 : daysSinceLastBooking <= 60 ? 2 : 1;

    // Frequency Score (1-4)
    const frequencyScore = totalBookings >= 10 ? 4 : totalBookings >= 5 ? 3 : totalBookings >= 2 ? 2 : 1;

    // Monetary Score (1-4)
    const monetaryScore = totalRevenue >= 5000000 ? 4 : totalRevenue >= 2000000 ? 3 : totalRevenue >= 500000 ? 2 : 1;

    const rfmScore = recencyScore + frequencyScore + monetaryScore;

    // Segment mappings matching: 'New' | 'Active' | 'At Risk' | 'Churned'
    let customerSegment: 'New' | 'Active' | 'At Risk' | 'Churned' = 'New';
    if (rfmScore >= 10) {
      customerSegment = 'Active';
    } else if (rfmScore >= 7) {
      customerSegment = 'New';
    } else if (rfmScore >= 5) {
      customerSegment = 'At Risk';
    } else {
      customerSegment = 'Churned';
    }

    const churnRiskLevel = recencyScore === 1 
      ? ('High Risk' as const) 
      : recencyScore === 2 
      ? ('Medium Risk' as const) 
      : ('Low Risk' as const);

    return {
      tenantId,
      customerId: customer.id,
      customerName: customer.name_mother || 'Unknown',
      customerPhone: customer.phone || '',
      totalBookings,
      totalRevenue,
      daysSinceLastBooking,
      recencyScore,
      frequencyScore,
      monetaryScore,
      rfmScore,
      segment: customerSegment,
      churnRiskLevel,
      computedAt: new Date().toISOString(),
    };
  });

  if (segment) {
    segmentList = segmentList.filter(item => item.segment === segment);
  }

  // Sort by rfmScore desc
  segmentList.sort((a, b) => b.rfmScore - a.rfmScore);

  if (limit) {
    segmentList = segmentList.slice(0, limit);
  }

  return segmentList;
}

/**
 * Get Churn Risk Analysis - Simplified
 */
export async function getChurnRiskAnalysis(
  tenantId: string,
  minChurnProbability?: number,
  limit?: number
) {
  const supabase = await createServiceRoleClient();

  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, name_mother, phone, created_at')
    .eq('tenant_id', tenantId);

  if (customerError) {
    throw customerError;
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('customer_id, full_price, status, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'completed']);

  if (bookingsError) {
    throw bookingsError;
  }

  const bookingsByCustomer = new Map<string, typeof bookings>();
  (bookings || []).forEach((b) => {
    const list = bookingsByCustomer.get(b.customer_id) || [];
    list.push(b);
    bookingsByCustomer.set(b.customer_id, list);
  });

  const now = new Date();
  let analysisList = (customers || []).map((customer) => {
    const custBookings = bookingsByCustomer.get(customer.id) || [];
    const totalBookings = custBookings.length;
    const totalRevenue = custBookings.reduce((sum, b) => sum + Number(b.full_price || 0), 0);
    
    const lastBookingDate = custBookings.length > 0 
      ? custBookings.map(b => b.created_at || '').sort().reverse()[0] 
      : null;

    const daysSinceLastBooking = lastBookingDate 
      ? Math.max(0, Math.ceil((now.getTime() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24))) 
      : 999;

    const recencyScore = daysSinceLastBooking <= 15 ? 4 : daysSinceLastBooking <= 30 ? 3 : daysSinceLastBooking <= 60 ? 2 : 1;
    const frequencyScore = totalBookings >= 10 ? 4 : totalBookings >= 5 ? 3 : totalBookings >= 2 ? 2 : 1;
    const monetaryScore = totalRevenue >= 5000000 ? 4 : totalRevenue >= 2000000 ? 3 : totalRevenue >= 500000 ? 2 : 1;

    // Recency risk is highest weight. If daysSinceLastBooking is large, risk increases.
    const recencyRisk = Math.min(1.0, daysSinceLastBooking / 90);
    const frequencyRisk = 1.0 - (frequencyScore / 4);
    const monetaryRisk = 1.0 - (monetaryScore / 4);

    const churnProbability = Math.round((recencyRisk * 0.5 + frequencyRisk * 0.3 + monetaryRisk * 0.2) * 100) / 100;
    const churnRiskScore = Math.round(churnProbability * 100);

    const churnRiskLevel = churnProbability >= 0.75 
      ? ('High' as const) 
      : churnProbability >= 0.40 
      ? ('Medium' as const) 
      : ('Low' as const);

    const recommendedActions = churnProbability >= 0.75
      ? ['Gọi điện trực tiếp chăm sóc đặc biệt', 'Tặng voucher ưu đãi lớn để lôi kéo khách hàng quay lại']
      : churnProbability >= 0.40
      ? ['Gửi tin nhắn Zalo chăm sóc tự động', 'Đề xuất dịch vụ/combo mới']
      : ['Duy trì chăm sóc định kỳ', 'Gửi lời chúc ngày lễ'];

    return {
      tenantId,
      customerId: customer.id,
      customerName: customer.name_mother || 'Unknown',
      customerPhone: customer.phone || '',
      totalBookings,
      totalRevenue,
      daysSinceLastBooking,
      churnRiskScore,
      churnProbability,
      churnRiskLevel,
      recommendedActions,
      computedAt: new Date().toISOString(),
    };
  });

  if (minChurnProbability !== undefined) {
    analysisList = analysisList.filter(item => item.churnProbability >= minChurnProbability);
  }

  // Sort by risk score desc
  analysisList.sort((a, b) => b.churnRiskScore - a.churnRiskScore);

  if (limit) {
    analysisList = analysisList.slice(0, limit);
  }

  return analysisList;
}

/**
 * Get Cohort Analysis - Simplified
 */
export async function getCohortAnalysis(
  tenantId: string,
  startMonth?: string,
  endMonth?: string
) {
  const supabase = await createServiceRoleClient();

  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, created_at')
    .eq('tenant_id', tenantId);

  if (customerError) {
    throw customerError;
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('customer_id, full_price, status, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'completed']);

  if (bookingsError) {
    throw bookingsError;
  }

  const bookingsByCustomer = new Map<string, typeof bookings>();
  (bookings || []).forEach((b) => {
    const list = bookingsByCustomer.get(b.customer_id) || [];
    list.push(b);
    bookingsByCustomer.set(b.customer_id, list);
  });

  const now = new Date();
  const cohortGroups = new Map<string, { size: number; active: number; revenue: number }>();

  (customers || []).forEach((customer) => {
    const cohortMonth = (customer.created_at || new Date().toISOString()).slice(0, 7);
    const custBookings = bookingsByCustomer.get(customer.id) || [];
    const revenue = custBookings.reduce((sum, b) => sum + Number(b.full_price || 0), 0);
    
    const lastBookingDate = custBookings.length > 0 
      ? custBookings.map(b => b.created_at || '').sort().reverse()[0] 
      : null;

    const daysSinceLastBooking = lastBookingDate 
      ? Math.max(0, Math.ceil((now.getTime() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24))) 
      : 999;

    const isActive = daysSinceLastBooking < 30;

    const current = cohortGroups.get(cohortMonth) || { size: 0, active: 0, revenue: 0 };
    cohortGroups.set(cohortMonth, {
      size: current.size + 1,
      active: current.active + (isActive ? 1 : 0),
      revenue: current.revenue + revenue,
    });
  });

  let result = Array.from(cohortGroups.entries()).map(([cohortMonth, data]) => {
    const retentionRate = Math.round((data.active / data.size) * 100);
    return {
      tenantId,
      cohortMonth,
      cohortSize: data.size,
      activeCustomers: data.active,
      totalRevenue: data.revenue,
      avgLTV: Math.round(data.revenue / data.size),
      retentionRate,
      churnRate: 100 - retentionRate,
      computedAt: new Date().toISOString(),
    };
  });

  if (startMonth) {
    result = result.filter(item => item.cohortMonth >= startMonth);
  }
  if (endMonth) {
    result = result.filter(item => item.cohortMonth <= endMonth);
  }

  // Sort by cohort month desc
  result.sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth));

  return result;
}

/**
 * Get RFM Analysis - Simplified
 */
export async function getRFMAnalysis(
  tenantId: string,
  minRfmScore?: number,
  limit?: number
) {
  const segmentList = await getCustomerSegmentation(tenantId, undefined, limit);

  let rfmList = segmentList.map((item) => ({
    tenantId: item.tenantId,
    customerId: item.customerId,
    customerName: item.customerName,
    recencyScore: item.recencyScore,
    frequencyScore: item.frequencyScore,
    monetaryScore: item.monetaryScore,
    rfmScore: item.rfmScore,
    segment: item.segment,
    computedAt: item.computedAt,
  }));

  if (minRfmScore !== undefined) {
    rfmList = rfmList.filter(item => item.rfmScore >= minRfmScore);
  }

  return rfmList;
}

/**
 * Get Segment Distribution - Simplified
 */
export async function getSegmentDistribution(tenantId: string) {
  const segmentations = await getCustomerSegmentation(tenantId);
  const total = segmentations.length;

  if (total === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  segmentations.forEach((item) => {
    counts.set(item.segment, (counts.get(item.segment) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([segment, count]) => ({
    tenantId,
    segment,
    customerCount: count,
    percentageOfTotal: Math.round((count / total) * 100 * 100) / 100,
    computedAt: new Date().toISOString(),
  }));
}

