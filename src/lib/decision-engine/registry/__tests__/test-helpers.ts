/**
 * Test Helpers for Integration Tests
 * 
 * Provides utilities for integration testing with database
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Create a Supabase client for testing (bypasses Next.js cookie requirement)
 * 
 * Uses service role key for full database access in tests
 */
export function createTestClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined for testing');
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Clean up test data from database
 */
export async function cleanupTestData(supabase: ReturnType<typeof createTestClient>, prefix: string = 'test-') {
  // Delete from policy_history first (foreign key constraint)
  await supabase
    .from('policy_history')
    .delete()
    .ilike('policy_id', `${prefix}%`);

  // Delete from policy_registry
  await supabase
    .from('policy_registry')
    .delete()
    .ilike('policy_id', `${prefix}%`);
}

/**
 * Wait for async operations to complete
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate unique test policy ID
 */
export function generateTestPolicyId(prefix: string = 'test-policy'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create a minimal valid policy input for testing
 */
export function createMockPolicyInput(policyId: string, version: string = '1.0.0') {
  return {
    policy: {
      id: policyId,
      version,
      name: `Test Policy ${policyId}`,
      description: 'Integration test policy',
      rules: [
        {
          id: 'rule-1',
          condition: 'true',
          action: { type: 'approve' as const, score: 100 },
          priority: 1,
        },
      ],
    },
    category: 'booking' as const,
    businessOwner: 'Test Owner',
    businessOwnerEmail: 'owner@test.com',
    technicalOwner: 'Test Tech',
    technicalOwnerEmail: 'tech@test.com',
    ownerDepartment: 'IT',
    effectiveDate: '2026-01-01',
  };
}
