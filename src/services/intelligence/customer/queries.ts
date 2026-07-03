/**
 * Customer Intelligence Queries Module
 * 
 * Query builders for Customer Intelligence metrics:
 * - Customer Segmentation (RFM analysis with 11 predefined segments)
 * - Customer LTV (lifetime value, cohort analysis, value tiers)
 * - Churn Risk Analysis (rule-based scoring with weighted factors)
 * - RFM Analysis (detailed Recency, Frequency, Monetary scores)
 * - Cohort Analysis (customer retention and LTV by signup month)
 * 
 * Architecture:
 * - Read-only operations (no mutations)
 * - Query materialized views for performance
 * - Tenant isolation (tenant_id filter on all queries)
 * - Date range filtering (cohort month/quarter/year)
 * - TypeScript types for all return values
 * 
 * Data Sources:
 * - mv_customer_segments (materialized view)
 * - mv_customer_ltv (materialized view)
 * - mv_customer_activity_summary (materialized view)
 */

import type { Database } from '@/types/database.types';
import type { DateRange, TimePeriod } from '../shared/types';
import { QueryError } from '../shared/types';
import { parseDateRange, formatDate } from '../shared/helpers';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';

/**
 * Create server-side Supabase client with service role key (bypasses RLS).
 * 
 * Customer Intelligence queries need service role access to read materialized views
 * and aggregate data across customer segments without RLS restrictions.
 */
async function createServiceRoleClient() {
  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    throw new Error(
      'Customer Intelligence requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Service role key grants admin access to bypass RLS for analytics queries.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Type Definitions ───────────────────────────────────────────────────────

/**
 * Customer Segment (RFM Analysis)
 */
export interface CustomerSegment {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerSince: string;
  customerLifetimeDays: number;
  
  // RFM Metrics
  daysSinceLastBooking: number;
  totalBookings: number;
  totalRevenue: number;
  avgBookingAmount: number;
  totalSessionsCompleted: number;
  avgSessionsPerBooking: number;
  lastBookingDate: string | null;
  
  // RFM Scores (1-4 scale, 4 is best)
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmScore: number;
  
  // Segmentation
  segment: 'Champions' | 'Loyal Customers' | 'Potential Loyalists' | 'Recent Customers' | 'Promising' | 'Need Attention' | 'About To Sleep' | 'At Risk' | 'Cannot Lose' | 'Hibernating' | 'Lost' | 'New' | 'Other';
  retentionPriority: number; // 1-5, 1 is highest priority
  churnRiskLevel: 'High Risk' | 'Medium Risk' | 'Low Risk';
  recommendedAction: string;
  
  // Metadata
  computedAt: string;
}

/**
 * Customer LTV (Lifetime Value)
 */
export interface CustomerLTV {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerSince: string;
  cohortMonth: string;
  cohortYear: number;
  cohortMonthNum: number;
  
  // Cohort Metrics
  cohortSize: number;
  avgCohortLtv: number;
  cohortRetentionRatePct: number;
  avgCustomerLifespanMonths: number;
  
  // Customer Lifetime Metrics
  totalBookings: number;
  lifetimeRevenue: number;
  avgOrderValue: number;
  totalSessions: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  customerAgeMonths: number;
  activeMonths: number;
  daysSinceFirstPurchase: number;
  daysSinceLastPurchase: number;
  
  // LTV Calculations
  currentLtv: number;
  projectedAnnualLtv: number;
  ltvConfidenceScore: number; // 0-100
  customerValueTier: 'VIP' | 'High Value' | 'Medium Value' | 'Standard' | 'Low Value' | 'Prospect';
  purchaseFrequency: number;
  activityStatus: 'Active' | 'Moderately Active' | 'Inactive' | 'Dormant';
  
  // Rankings
  cohortLtvRank: number;
  tenantLtvRank: number;
  ltvPercentile: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Customer Activity Summary (for Churn Risk)
 */
export interface CustomerActivitySummary {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerSince: string;
  customerLifetimeDays: number;
  
  // Activity Metrics
  totalBookings: number;
  totalRevenue: number;
  avgBookingAmount: number;
  totalSessionsCompleted: number;
  sessionCompletionRatePct: number;
  firstBookingDate: string | null;
  lastBookingDate: string | null;
  daysSinceLastBooking: number;
  activeMonths: number;
  avgBookingsPerMonth: number;
  
  // Review Metrics
  totalReviews: number;
  avgReviewRating: number;
  
  // Recent Activity Trends
  bookingsLast90Days: number;
  revenueLast90Days: number;
  bookings90180DaysAgo: number;
  revenue90180DaysAgo: number;
  bookings180270DaysAgo: number;
  revenue180270DaysAgo: number;
  bookingFrequencyChangePct: number | null;
  revenueChangePct: number | null;
  
  // Churn Risk Factors (0-100 scale, higher = higher risk)
  recencyRiskScore: number;
  frequencyDeclineRiskScore: number;
  revenueDeclineRiskScore: number;
  satisfactionRiskScore: number;
  
  // Overall Churn Risk
  churnRiskScore: number; // 0-100 (weighted average)
  churnRiskLevel: 'High' | 'Medium' | 'Low';
  recommendedRetentionActions: string[];
  
  // Metadata
  computedAt: string;
}

/**
 * Segment Distribution Summary
 */
export interface SegmentDistribution {
  tenantId: string;
  segment: string;
  customerCount: number;
  totalRevenue: number;
  avgRfmScore: number;
  avgLifetimeValue: number;
  percentageOfTotal: number;
}

/**
 * Cohort Analysis Summary
 */
export interface CohortAnalysis {
  tenantId: string;
  cohortMonth: string;
  cohortYear: number;
  cohortSize: number;
  totalRevenue: number;
  avgLtv: number;
  retentionRatePct: number;
  avgActiveMonths: number;
  topValueTier: string;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Convert snake_case database fields to camelCase TypeScript
 * Generic version for type-safe conversions
 */
function snakeToCamel<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

// ─── Query Builders ─────────────────────────────────────────────────────────

/**
 * Get Customer Segmentation (RFM Analysis)
 * Returns customers with RFM scores and assigned segments
 * 
 * @param tenantId - Tenant UUID
 * @param segment - Optional segment filter (Champions, Loyal Customers, At Risk, etc.)
 * @param limit - Optional limit for pagination
 * @returns Array of CustomerSegment records
 */
export async function getCustomerSegmentation(
  tenantId: string,
  segment?: string,
  limit?: number
): Promise<CustomerSegment[]> {
  const supabase = await createServiceRoleClient();
  
  let query = supabase
    .from('mv_customer_segments' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  // Apply segment filter if provided
  if (segment) {
    query = query.eq('segment', segment);
  }
  
  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query.order('rfm_score', { ascending: false });
  
  if (error) {
    throw new QueryError(`Failed to fetch customer segmentation: ${error.message}`, error);
  }
  
  // After error check, data is guaranteed to be array. Cast through unknown is necessary
  // because materialized view is not in generated types (using 'as any' in .from())
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => snakeToCamel<CustomerSegment>(row));
}

/**
 * Get Customer LTV (Lifetime Value)
 * Returns customer LTV with cohort benchmarks and value tiers
 * 
 * @param tenantId - Tenant UUID
 * @param cohortMonth - Optional cohort month filter (YYYY-MM format)
 * @param valueTier - Optional value tier filter (VIP, High Value, etc.)
 * @param limit - Optional limit for top customers
 * @returns Array of CustomerLTV records
 */
export async function getCustomerLTV(
  tenantId: string,
  cohortMonth?: string,
  valueTier?: string,
  limit?: number
): Promise<CustomerLTV[]> {
  const supabase = await createServiceRoleClient();
  
  let query = supabase
    .from('mv_customer_ltv' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  // Apply cohort month filter if provided
  if (cohortMonth) {
    query = query.eq('cohort_month', cohortMonth);
  }
  
  // Apply value tier filter if provided
  if (valueTier) {
    query = query.eq('customer_value_tier', valueTier);
  }
  
  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query.order('lifetime_revenue', { ascending: false });
  
  if (error) {
    throw new QueryError(`Failed to fetch customer LTV: ${error.message}`, error);
  }
  
  // After error check, data is guaranteed to be array. Cast through unknown is necessary
  // because materialized view is not in generated types (using 'as any' in .from())
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => snakeToCamel<CustomerLTV>(row));
}

/**
 * Get Churn Risk Analysis
 * Returns customers with churn risk scores and recommended retention actions
 * 
 * @param tenantId - Tenant UUID
 * @param riskLevel - Optional risk level filter (High, Medium, Low)
 * @param limit - Optional limit for high-risk customers
 * @returns Array of CustomerActivitySummary records
 */
export async function getChurnRiskAnalysis(
  tenantId: string,
  riskLevel?: 'High' | 'Medium' | 'Low',
  limit?: number
): Promise<CustomerActivitySummary[]> {
  const supabase = await createServiceRoleClient();
  
  let query = supabase
    .from('mv_customer_activity_summary' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  // Apply risk level filter if provided
  if (riskLevel) {
    query = query.eq('churn_risk_level', riskLevel);
  }
  
  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query.order('churn_risk_score', { ascending: false });
  
  if (error) {
    throw new QueryError(`Failed to fetch churn risk analysis: ${error.message}`, error);
  }
  
  // After error check, data is guaranteed to be array. Cast through unknown is necessary
  // because materialized view is not in generated types (using 'as any' in .from())
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => snakeToCamel<CustomerActivitySummary>(row));
}

/**
 * Get RFM Analysis (detailed scores)
 * Returns comprehensive RFM scores for all customers
 * 
 * @param tenantId - Tenant UUID
 * @returns Array of CustomerSegment records
 */
export async function getRFMAnalysis(
  tenantId: string
): Promise<CustomerSegment[]> {
  // RFM analysis is the same as customer segmentation
  // This is a convenience alias for clarity
  return getCustomerSegmentation(tenantId);
}

/**
 * Get Segment Distribution Summary
 * Returns aggregated metrics by segment
 * 
 * @param tenantId - Tenant UUID
 * @returns Array of SegmentDistribution records
 */
export async function getSegmentDistribution(
  tenantId: string
): Promise<SegmentDistribution[]> {
  const supabase = await createServiceRoleClient();
  
  // Aggregate from customer segments MV
  const { data, error } = await supabase
    .from('mv_customer_segments' as any)
    .select('*')
    .eq('tenant_id', tenantId);
  
  if (error) {
    throw new QueryError(`Failed to fetch segment distribution: ${error.message}`, error);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Cast data to proper type after error check and null check
  const rows = data as unknown as Record<string, any>[];
  
  // Group by segment and aggregate
  const segmentMap = rows.reduce((acc, row) => {
    const segment = row.segment as string;
    if (!acc[segment]) {
      acc[segment] = {
        tenantId,
        segment,
        customerCount: 0,
        totalRevenue: 0,
        avgRfmScore: 0,
        avgLifetimeValue: 0,
        percentageOfTotal: 0,
      };
    }
    acc[segment].customerCount += 1;
    acc[segment].totalRevenue += row.total_revenue || 0;
    acc[segment].avgRfmScore += row.rfm_score || 0;
    acc[segment].avgLifetimeValue += row.total_revenue || 0;
    return acc;
  }, {} as Record<string, SegmentDistribution>);
  
  // Calculate averages and percentages
  const totalCustomers = rows.length;
  return Object.values(segmentMap).map((seg) => ({
    ...seg,
    avgRfmScore: seg.avgRfmScore / seg.customerCount,
    avgLifetimeValue: seg.avgLifetimeValue / seg.customerCount,
    percentageOfTotal: (seg.customerCount / totalCustomers) * 100,
  }));
}

/**
 * Get Cohort Analysis
 * Returns LTV and retention metrics by signup cohort
 * 
 * @param tenantId - Tenant UUID
 * @param limit - Optional limit for recent cohorts (default: 12 months)
 * @returns Array of CohortAnalysis records
 */
export async function getCohortAnalysis(
  tenantId: string,
  limit: number = 12
): Promise<CohortAnalysis[]> {
  const supabase = await createServiceRoleClient();
  
  const { data, error } = await supabase
    .from('mv_customer_ltv' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('cohort_month', { ascending: false })
    .limit(limit * 10); // Fetch more to account for multiple customers per cohort
  
  if (error) {
    throw new QueryError(`Failed to fetch cohort analysis: ${error.message}`, error);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Cast data to proper type after error check and null check
  const rows = data as unknown as Record<string, any>[];
  
  // Group by cohort month and aggregate
  const cohortMap = rows.reduce((acc, row) => {
    const cohortMonth = row.cohort_month as string;
    if (!acc[cohortMonth]) {
      acc[cohortMonth] = {
        tenantId,
        cohortMonth,
        cohortYear: row.cohort_year as number,
        cohortSize: row.cohort_size as number,
        totalRevenue: 0,
        avgLtv: row.avg_cohort_ltv as number,
        retentionRatePct: row.cohort_retention_rate_pct as number,
        avgActiveMonths: 0,
        topValueTier: '',
        customerCount: 0,
        valueTiers: {} as Record<string, number>,
      };
    }
    acc[cohortMonth].totalRevenue += row.lifetime_revenue || 0;
    acc[cohortMonth].avgActiveMonths += row.active_months || 0;
    acc[cohortMonth].customerCount += 1;
    
    // Track value tier distribution
    const tier = row.customer_value_tier as string;
    acc[cohortMonth].valueTiers[tier] = (acc[cohortMonth].valueTiers[tier] || 0) + 1;
    
    return acc;
  }, {} as Record<string, CohortAnalysis & { customerCount: number; valueTiers: Record<string, number> }>);
  
  // Calculate averages and determine top value tier
  return Object.values(cohortMap)
    .map((cohort) => {
      const topTier = Object.entries(cohort.valueTiers)
        .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'Standard';
      
      return {
        tenantId: cohort.tenantId,
        cohortMonth: cohort.cohortMonth,
        cohortYear: cohort.cohortYear,
        cohortSize: cohort.cohortSize,
        totalRevenue: cohort.totalRevenue,
        avgLtv: cohort.avgLtv,
        retentionRatePct: cohort.retentionRatePct,
        avgActiveMonths: cohort.avgActiveMonths / cohort.customerCount,
        topValueTier: topTier,
      };
    })
    .sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth))
    .slice(0, limit);
}
