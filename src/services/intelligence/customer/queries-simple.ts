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
  try {
    const supabase = await createServiceRoleClient();

    // Query customers table
    let query = supabase
      .from('customers')
      .select('id, name_mother, phone, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[Customer Intelligence] LTV query error:', error);
      return [];
    }

    // Return basic LTV data
    return (customers || []).map((customer, index) => ({
      tenantId,
      customerId: customer.id,
      customerName: customer.name_mother || 'Unknown',
      customerPhone: customer.phone || '',
      customerSince: customer.created_at || new Date().toISOString(),
      cohortMonth: (customer.created_at || new Date().toISOString()).slice(0, 7),
      totalBookings: 0,
      lifetimeRevenue: 0,
      currentLTV: 0,
      projectedAnnualLtv: 0,
      customerValueTier: 'Standard' as const,
      purchaseFrequency: 0,
      activityStatus: 'Active' as const,
      computedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[Customer Intelligence] LTV error:', error);
    return [];
  }
}

/**
 * Get Customer Segmentation - Simplified
 */
export async function getCustomerSegmentation(
  tenantId: string,
  segment?: string,
  limit?: number
) {
  try {
    const supabase = await createServiceRoleClient();

    let query = supabase
      .from('customers')
      .select('id, name_mother, phone, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[Customer Intelligence] Segmentation query error:', error);
      return [];
    }

    // Return basic segmentation data
    return (customers || []).map((customer) => ({
      tenantId,
      customerId: customer.id,
      customerName: customer.name_mother || 'Unknown',
      customerPhone: customer.phone || '',
      totalBookings: 0,
      totalRevenue: 0,
      daysSinceLastBooking: 0,
      recencyScore: 3,
      frequencyScore: 3,
      monetaryScore: 3,
      rfmScore: 9,
      segment: 'New' as const,
      churnRiskLevel: 'Low Risk' as const,
      computedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[Customer Intelligence] Segmentation error:', error);
    return [];
  }
}

/**
 * Get Churn Risk Analysis - Simplified
 */
export async function getChurnRiskAnalysis(
  tenantId: string,
  minChurnProbability?: number,
  limit?: number
) {
  try {
    const supabase = await createServiceRoleClient();

    let query = supabase
      .from('customers')
      .select('id, name_mother, phone, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[Customer Intelligence] Churn risk query error:', error);
      return [];
    }

    // Return basic churn risk data
    return (customers || []).map((customer) => ({
      tenantId,
      customerId: customer.id,
      customerName: customer.name_mother || 'Unknown',
      customerPhone: customer.phone || '',
      totalBookings: 0,
      totalRevenue: 0,
      daysSinceLastBooking: 0,
      churnRiskScore: 30,
      churnProbability: 0.3,
      churnRiskLevel: 'Low' as const,
      recommendedActions: ['Monitor activity'],
      computedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[Customer Intelligence] Churn risk error:', error);
    return [];
  }
}

/**
 * Get Cohort Analysis - Simplified
 */
export async function getCohortAnalysis(
  tenantId: string,
  startMonth?: string,
  endMonth?: string
) {
  try {
    const supabase = await createServiceRoleClient();

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, created_at')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[Customer Intelligence] Cohort analysis query error:', error);
      return [];
    }

    // Group by cohort month
    const cohortMap = new Map<string, number>();
    (customers || []).forEach((customer) => {
      const cohortMonth = (customer.created_at || new Date().toISOString()).slice(0, 7);
      cohortMap.set(cohortMonth, (cohortMap.get(cohortMonth) || 0) + 1);
    });

    // Return cohort data
    return Array.from(cohortMap.entries()).map(([cohortMonth, cohortSize]) => ({
      tenantId,
      cohortMonth,
      cohortSize,
      activeCustomers: cohortSize,
      totalRevenue: 0,
      avgLTV: 0,
      retentionRate: 100,
      churnRate: 0,
      computedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[Customer Intelligence] Cohort analysis error:', error);
    return [];
  }
}

/**
 * Get RFM Analysis - Simplified
 */
export async function getRFMAnalysis(
  tenantId: string,
  minRfmScore?: number,
  limit?: number
) {
  try {
    const supabase = await createServiceRoleClient();

    let query = supabase
      .from('customers')
      .select('id, name_mother')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[Customer Intelligence] RFM query error:', error);
      return [];
    }

    return (customers || []).map((customer) => ({
      tenantId,
      customerId: customer.id,
      customerName: customer.name_mother || 'Unknown',
      recencyScore: 3,
      frequencyScore: 3,
      monetaryScore: 3,
      rfmScore: 9,
      segment: 'New',
      computedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[Customer Intelligence] RFM error:', error);
    return [];
  }
}

/**
 * Get Segment Distribution - Placeholder
 */
export async function getSegmentDistribution(tenantId: string) {
  return [];
}
