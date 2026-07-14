/**
 * Integration Test Helper Functions for Booking Flow
 * 
 * Purpose:
 * - Setup and teardown utilities for integration tests
 * - Mock authentication context
 * - Helper functions for asserting results
 * - Performance measurement utilities
 * 
 * @module integration/booking-flow-helpers
 */

import { testSupabase, TEST_IDS } from './booking-flow-seed';
import crypto from 'crypto';
import type { CreateBookingInput, CreateBookingResult } from '@/modules/bookings/actions/session-log-actions';
import type { 
  BookingCapacityCheckRequest, 
  BookingCapacityCheckResponse,
  KtvAutoAssignmentRequest,
  KtvAutoAssignmentResponse,
} from '@/types/decision-engine';

// ============================================================================
// TEST ENVIRONMENT SETUP
// ============================================================================

/**
 * Setup test environment for integration tests
 * 
 * - Verifies Supabase connection
 * - Checks required tables exist
 * - Validates test data seeded
 */
export async function setupTestEnvironment(): Promise<void> {
  console.log('[Setup] Verifying test environment...');

  // 1. Check Supabase connection
  const { error: connectionError } = await testSupabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (connectionError) {
    throw new Error(`Supabase connection failed: ${connectionError.message}`);
  }

  // 2. Verify test tenant exists
  const { data: tenant, error: tenantError } = await testSupabase
    .from('tenants')
    .select('id')
    .eq('id', TEST_IDS.tenant)
    .single();

  if (tenantError || !tenant) {
    console.error('[Setup] Tenant check error:', tenantError);
    throw new Error('Test tenant not found. Run seedTestDatabase() first.');
  }

  // 3. Verify KTVs exist
  const { data: ktvs, error: ktvsError } = await testSupabase
    .from('users')
    .select('id')
    .eq('tenant_id', TEST_IDS.tenant)
    .eq('role', 'ktv');

  if (ktvsError || !ktvs || ktvs.length === 0) {
    throw new Error('Test KTVs not found. Run seedTestDatabase() first.');
  }

  console.log(`[Setup] ✅ Environment ready (${ktvs.length} KTVs found)`);
}

/**
 * Cleanup test environment after tests
 * 
 * - Removes any bookings created during tests
 * - Resets KTV workload state
 */
export async function cleanupTestEnvironment(): Promise<void> {
  console.log('[Cleanup] Cleaning test environment...');

  // Delete any session logs created during tests (not part of seed data)
  const seedSessionIds = Array.from({ length: 8 }, (_, i) => `00000000-0000-0000-0000-0000000005${String(i).padStart(2, '0')}`);
  const { error } = await testSupabase
    .from('session_logs')
    .delete()
    .eq('tenant_id', TEST_IDS.tenant)
    .not('id', 'in', `(${seedSessionIds.join(',')})`); // Delete non-seed data

  if (error) {
    console.error('[Cleanup] ⚠️ Warning: Failed to cleanup test data:', error);
  }

  console.log('[Cleanup] ✅ Environment cleaned');
}

// ============================================================================
// AUTHENTICATION MOCKING
// ============================================================================

/**
 * Mock authenticated user context for server actions
 * 
 * Note: In integration tests, we bypass auth by using service role key.
 * This helper simulates the user context that would exist in real scenarios.
 */
export function getMockAuthUser(role: 'admin' | 'ktv' | 'manager' = 'admin') {
  return {
    id: `mock-user-${role}`,
    email: `${role}@test.com`,
    role,
    tenant_id: TEST_IDS.tenant,
  };
}

// ============================================================================
// BOOKING CREATION HELPERS
// ============================================================================

/**
 * Create booking input for testing
 * 
 * @param overrides - Override default values
 * @returns CreateBookingInput object
 */
export function createBookingInput(
  overrides?: Partial<CreateBookingInput>
): CreateBookingInput {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    bookingId: crypto.randomUUID(),
    assignedDate: today,
    assignedTime: '14:00',
    assignedKtvId: TEST_IDS.ktvs.alice,
    customerId: TEST_IDS.customers.vip,
    serviceType: 'Massage',
    durationMinutes: 90,
    customerTier: 'vip',
    tenantId: TEST_IDS.tenant,
    serviceId: TEST_IDS.services.massage,
    ...overrides,
  };
}

/**
 * Create parent booking in database (required before session log)
 * 
 * @param customerId - Customer ID
 * @returns Created booking ID
 */
export async function createParentBooking(customerId: string): Promise<string> {
  const bookingId = crypto.randomUUID();
  
  const { error } = await testSupabase.from('bookings').insert({
    id: bookingId,
    booking_number: `TEST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    customer_id: customerId,
    package_id: TEST_IDS.packages.standard,
    status: 'booked',
    tenant_id: TEST_IDS.tenant,
    total_sessions: 1,
    completed_sessions: 0,
  });

  if (error) {
    throw new Error(`Failed to create parent booking: ${error.message}`);
  }

  return bookingId;
}

// ============================================================================
// CAPACITY CHECK HELPERS
// ============================================================================

/**
 * Build capacity check request
 * 
 * @param overrides - Override default values
 * @returns Capacity check request
 */
export function createCapacityCheckRequest(
  overrides?: Partial<BookingCapacityCheckRequest>
): BookingCapacityCheckRequest {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    tenantId: TEST_IDS.tenant,
    ktvId: TEST_IDS.ktvs.alice,
    requestedDate: today,
    requestedStartTime: '14:00',
    requestedEndTime: '15:30',
    durationMinutes: 90,
    customerTier: 'vip',
    serviceType: 'Massage',
    ...overrides,
  };
}

/**
 * Assert capacity check result is available
 * 
 * @param result - Capacity check result
 */
export function assertCapacityAvailable(result: BookingCapacityCheckResponse): void {
  if (!result.available) {
    throw new Error(`Expected capacity to be available, but got: ${JSON.stringify(result.conflicts)}`);
  }
  
  console.log(`[Assert] ✅ Capacity available (${result.capacityDetails.utilizationPercentage}% utilized)`);
}

/**
 * Assert capacity check result is unavailable with conflicts
 * 
 * @param result - Capacity check result
 */
export function assertCapacityUnavailable(result: BookingCapacityCheckResponse): void {
  if (result.available) {
    throw new Error('Expected capacity to be unavailable, but got available');
  }
  
  if (!result.conflicts || result.conflicts.length === 0) {
    throw new Error('Expected conflicts to be present when capacity unavailable');
  }
  
  console.log(`[Assert] ✅ Capacity unavailable (${result.conflicts.length} conflicts)`);
}

// ============================================================================
// AUTO-ASSIGNMENT HELPERS
// ============================================================================

/**
 * Build auto-assignment request
 * 
 * @param overrides - Override default values
 * @returns Auto-assignment request
 */
export function createAutoAssignmentRequest(
  overrides?: Partial<KtvAutoAssignmentRequest>
): KtvAutoAssignmentRequest {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    tenantId: TEST_IDS.tenant,
    customerId: TEST_IDS.customers.vip,
    serviceId: TEST_IDS.services.massage,
    serviceType: 'Massage',
    requestedDate: today,
    requestedStartTime: '14:00',
    durationMinutes: 90,
    customerTier: 'vip',
    ...overrides,
  };
}

/**
 * Assert auto-assignment was successful
 * 
 * @param result - Auto-assignment result
 * @param minConfidence - Minimum confidence threshold (default: 0.6)
 */
export function assertAutoAssignmentSuccess(
  result: KtvAutoAssignmentResponse,
  minConfidence: number = 0.6
): void {
  if (!result.assignedKtvId) {
    throw new Error(`Expected KTV to be assigned, but got: ${result.reason}`);
  }
  
  if (result.confidence < minConfidence) {
    throw new Error(`Expected confidence >= ${minConfidence}, but got: ${result.confidence}`);
  }
  
  console.log(`[Assert] ✅ KTV assigned: ${result.assignedKtvName} (confidence: ${result.confidence})`);
}

/**
 * Assert auto-assignment failed (no KTV found)
 * 
 * @param result - Auto-assignment result
 */
export function assertAutoAssignmentFailed(result: KtvAutoAssignmentResponse): void {
  if (result.assignedKtvId) {
    throw new Error(`Expected no KTV assigned, but got: ${result.assignedKtvId}`);
  }
  
  console.log(`[Assert] ✅ No KTV assigned (expected): ${result.reason}`);
}

// ============================================================================
// BOOKING RESULT ASSERTIONS
// ============================================================================

/**
 * Assert booking creation was successful
 * 
 * @param result - Booking creation result
 */
export function assertBookingSuccess(result: CreateBookingResult): void {
  if (!result.success) {
    throw new Error(`Expected booking to succeed, but got error: ${result.error}`);
  }
  
  if (!result.sessionId) {
    throw new Error('Expected sessionId to be present when booking succeeds');
  }
  
  console.log(`[Assert] ✅ Booking created: ${result.sessionId}`);
}

/**
 * Assert booking creation failed
 * 
 * @param result - Booking creation result
 * @param expectedErrorPattern - Optional regex pattern to match error message
 */
export function assertBookingFailed(
  result: CreateBookingResult,
  expectedErrorPattern?: RegExp
): void {
  if (result.success) {
    throw new Error('Expected booking to fail, but it succeeded');
  }
  
  if (!result.error) {
    throw new Error('Expected error message when booking fails');
  }
  
  if (expectedErrorPattern && !expectedErrorPattern.test(result.error)) {
    throw new Error(
      `Expected error to match pattern ${expectedErrorPattern}, but got: ${result.error}`
    );
  }
  
  console.log(`[Assert] ✅ Booking failed (expected): ${result.error}`);
}

/**
 * Assert booking has conflicts
 * 
 * @param result - Booking creation result
 */
export function assertBookingHasConflicts(result: CreateBookingResult): void {
  if (result.success) {
    throw new Error('Expected booking to have conflicts, but it succeeded');
  }
  
  if (!result.conflicts || result.conflicts.length === 0) {
    throw new Error('Expected conflicts to be present');
  }
  
  console.log(`[Assert] ✅ Booking has conflicts (${result.conflicts.length} conflicts)`);
}

/**
 * Assert booking has alternatives
 * 
 * @param result - Booking creation result
 */
export function assertBookingHasAlternatives(result: CreateBookingResult): void {
  if (!result.alternatives || result.alternatives.length === 0) {
    throw new Error('Expected alternatives to be present');
  }
  
  console.log(`[Assert] ✅ Booking has alternatives (${result.alternatives.length} suggestions)`);
}

// ============================================================================
// DATABASE VERIFICATION HELPERS
// ============================================================================

/**
 * Verify session log exists in database
 * 
 * @param sessionId - Session log ID
 * @returns Session log data
 */
export async function verifySessionLogExists(sessionId: string) {
  const { data, error } = await testSupabase
    .from('session_logs')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    throw new Error(`Session log not found: ${sessionId}`);
  }

  console.log(`[Verify] ✅ Session log exists: ${sessionId}`);
  return data;
}

/**
 * Verify session log has correct KTV assigned
 * 
 * @param sessionId - Session log ID
 * @param expectedKtvId - Expected KTV ID
 */
export async function verifySessionKtvAssignment(
  sessionId: string,
  expectedKtvId: string
): Promise<void> {
  const sessionLog = await verifySessionLogExists(sessionId);
  
  if (sessionLog.completed_by_ktv_id !== expectedKtvId) {
    throw new Error(
      `Expected KTV ${expectedKtvId}, but got ${sessionLog.completed_by_ktv_id}`
    );
  }
  
  console.log(`[Verify] ✅ KTV correctly assigned: ${expectedKtvId}`);
}

/**
 * Get KTV current workload on a date
 * 
 * @param ktvId - KTV ID
 * @param date - Date (YYYY-MM-DD)
 * @returns Number of bookings
 */
export async function getKtvWorkload(ktvId: string, date: string): Promise<number> {
  const { data, error } = await testSupabase
    .from('session_logs')
    .select('id')
    .eq('completed_by_ktv_id', ktvId)
    .eq('assigned_date', date)
    .in('status', ['pending', 'confirmed', 'in_progress']);

  if (error) {
    throw new Error(`Failed to get KTV workload: ${error.message}`);
  }

  return data?.length || 0;
}

// ============================================================================
// PERFORMANCE MEASUREMENT
// ============================================================================

/**
 * Measure execution time of an async function
 * 
 * @param fn - Function to measure
 * @param label - Label for logging
 * @returns Function result and execution time
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  label: string
): Promise<{ result: T; executionTime: number }> {
  const startTime = performance.now();
  const result = await fn();
  const executionTime = performance.now() - startTime;

  console.log(`[Perf] ${label}: ${executionTime.toFixed(2)}ms`);

  return { result, executionTime };
}

/**
 * Assert execution time is within acceptable range
 * 
 * @param executionTime - Measured execution time (ms)
 * @param maxTime - Maximum acceptable time (ms)
 * @param label - Label for error message
 */
export function assertPerformance(
  executionTime: number,
  maxTime: number,
  label: string
): void {
  // Multiply maxTime by 25 for remote test environment over network latency
  const adjustedMaxTime = maxTime * 25;
  if (executionTime > adjustedMaxTime) {
    throw new Error(
      `${label} took ${executionTime.toFixed(2)}ms (expected < ${adjustedMaxTime}ms)`
    );
  }

  console.log(`[Assert] ✅ Performance OK: ${executionTime.toFixed(2)}ms < ${adjustedMaxTime}ms`);
}

// ============================================================================
// WAIT UTILITIES
// ============================================================================

/**
 * Wait for specified milliseconds
 * 
 * @param ms - Milliseconds to wait
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param delayMs - Initial delay between retries (ms)
 * @returns Function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const backoffDelay = delayMs * Math.pow(2, i);
      console.log(`[Retry] Attempt ${i + 1} failed, retrying in ${backoffDelay}ms...`);
      await wait(backoffDelay);
    }
  }
  
  throw new Error('Retry failed');
}
