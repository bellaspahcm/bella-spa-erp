/**
 * Test Utilities and Helpers
 * Intelligence Layer Phase 8 Task #3
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ============================================================================
// TEST ENVIRONMENT SETUP
// ============================================================================

export const TEST_TENANT_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000002';

export function getTestSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  return createClient<Database>(supabaseUrl, supabaseKey);
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

export function generateForecastResult(overrides?: Partial<Database['public']['Tables']['forecast_results']['Insert']>) {
  return {
    tenant_id: TEST_TENANT_ID,
    forecast_type: 'revenue' as const,
    model_name: 'linear_regression',
    period_start_date: '2026-06-01',
    period_end_date: '2026-06-30',
    forecasted_value: 50000000,
    confidence_lower: 45000000,
    confidence_upper: 55000000,
    accuracy_pct: 85.5,
    metadata: {
      algorithm_params: { window_size: 12 }
    },
    ...overrides
  };
}

export function generateRecommendation(overrides?: Partial<Database['public']['Tables']['recommendation_cache']['Insert']>) {
  return {
    tenant_id: TEST_TENANT_ID,
    recommendation_type: 'service' as const,
    customer_id: '00000000-0000-0000-0000-000000000003',
    recommended_item_id: '00000000-0000-0000-0000-000000000004',
    relevance_score: 0.85,
    rank_position: 1,
    algorithm_used: 'collaborative_filtering',
    cached_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    metadata: {
      similar_customers: 10,
      confidence: 0.9
    },
    ...overrides
  };
}

export function generateSession(overrides?: Partial<Database['public']['Tables']['session_logs']['Insert']>) {
  return {
    tenant_id: TEST_TENANT_ID,
    booking_id: '00000000-0000-0000-0000-000000000005',
    session_number: 1,
    completed_by_ktv_id: null,
    status: 'completed',
    start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    end_time: new Date().toISOString(),
    ...overrides
  };
}

export function generateBooking(overrides?: Partial<Database['public']['Tables']['bookings']['Insert']>) {
  return {
    tenant_id: TEST_TENANT_ID,
    customer_id: '00000000-0000-0000-0000-000000000007',
    package_id: null,
    status: 'active',
    full_price: 5000000,
    booking_number: 'B-' + Math.random().toString(36).substring(2, 11).toUpperCase(),
    ...overrides
  };
}

export function generateRevenue(overrides?: Partial<Database['public']['Tables']['revenue']['Insert']>) {
  return {
    tenant_id: TEST_TENANT_ID,
    revenue_type: 'package_sale',
    booking_id: null,
    amount: 5000000,
    received_date: new Date().toISOString().split('T')[0],
    status: 'confirmed',
    ...overrides
  };
}

// ============================================================================
// TEST DATA CLEANUP
// ============================================================================

export async function cleanupTestData() {
  const supabase = getTestSupabaseClient();
  
  // Clean up in reverse order of dependencies
  await supabase.from('recommendation_cache').delete().eq('tenant_id', TEST_TENANT_ID);
  await supabase.from('forecast_results').delete().eq('tenant_id', TEST_TENANT_ID);
  await supabase.from('session_logs').delete().eq('tenant_id', TEST_TENANT_ID);
  await supabase.from('revenue').delete().eq('tenant_id', TEST_TENANT_ID);
  await supabase.from('bookings').delete().eq('tenant_id', TEST_TENANT_ID);
  await supabase.from('customers').delete().eq('tenant_id', TEST_TENANT_ID);
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

export function expectForecastResult(result: any) {
  expect(result).toHaveProperty('forecasts');
  expect(result).toHaveProperty('summary');
  expect(Array.isArray(result.forecasts)).toBe(true);
}

export function expectRecommendation(recommendation: any) {
  expect(recommendation).toHaveProperty('recommended_item_id');
  expect(recommendation).toHaveProperty('relevance_score');
  expect(recommendation).toHaveProperty('rank_position');
  expect(typeof recommendation.recommended_item_id).toBe('string');
  expect(recommendation.relevance_score).toBeGreaterThanOrEqual(0);
  expect(recommendation.relevance_score).toBeLessThanOrEqual(1);
  expect(recommendation.rank_position).toBeGreaterThan(0);
}

export function expectIntelligenceResponse(response: any) {
  expect(response).toHaveProperty('success');
  expect(response).toHaveProperty('data');
  expect(response).toHaveProperty('meta');
  expect(response.success).toBe(true);
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

export function generateMockHistoricalRevenue(months: number = 12): Array<{ month: string; revenue: number }> {
  const data: Array<{ month: string; revenue: number }> = [];
  const baseRevenue = 40000000;
  const trend = 0.05; // 5% monthly growth
  const seasonality = [1.0, 0.9, 0.95, 1.05, 1.1, 1.15, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95];
  
  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - i));
    const month = date.toISOString().slice(0, 7);
    const seasonalFactor = seasonality[date.getMonth()];
    const revenue = Math.round(baseRevenue * (1 + trend * i / 12) * seasonalFactor);
    data.push({ month, revenue });
  }
  
  return data;
}

export function generateMockCustomerInteractions(customerCount: number = 100, itemCount: number = 20): Array<{
  customer_id: string;
  item_id: string;
  interaction_score: number;
}> {
  const interactions: Array<{
    customer_id: string;
    item_id: string;
    interaction_score: number;
  }> = [];
  
  for (let c = 0; c < customerCount; c++) {
    const customerId = `customer_${c}`;
    const interactionCount = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < interactionCount; i++) {
      const itemId = `item_${Math.floor(Math.random() * itemCount)}`;
      const score = Math.random() * 0.5 + 0.5; // 0.5-1.0
      
      interactions.push({
        customer_id: customerId,
        item_id: itemId,
        interaction_score: score
      });
    }
  }
  
  return interactions;
}

// ============================================================================
// TIME HELPERS
// ============================================================================

export function getMonthRange(monthOffset: number = 0): { start: string; end: string } {
  const now = new Date();
  now.setMonth(now.getMonth() + monthOffset);
  
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// PERFORMANCE HELPERS
// ============================================================================

export async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

export async function runMultipleTimes<T>(
  fn: () => Promise<T>,
  iterations: number
): Promise<{ results: T[]; avgDuration: number; minDuration: number; maxDuration: number }> {
  const results: T[] = [];
  const durations: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const { result, duration } = await measureExecutionTime(fn);
    results.push(result);
    durations.push(duration);
  }
  
  return {
    results,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations)
  };
}
