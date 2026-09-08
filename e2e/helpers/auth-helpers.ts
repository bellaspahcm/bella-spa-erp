/**
 * E2E Auth Helpers
 * 
 * Provides authentication and cleanup utilities for E2E tests
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test credentials (from setup-test-user.ts)
const TEST_USER_EMAIL = 'e2e.preschool.test@bellaspa.local';
const TEST_USER_PASSWORD = 'E2eTest123!SecurePassword';

/**
 * Authenticate and get Supabase client with real auth session
 */
export async function authenticateForE2E(tenantId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in with test user
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (error || !data.session) {
    throw new Error(`Failed to authenticate: ${error?.message || 'No session returned'}`);
  }

  return {
    supabase,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user.id,
  };
}

/**
 * Cleanup E2E test data using service role client
 */
export async function cleanupE2EData(
  supabase: SupabaseClient,
  data: {
    enrollmentIds?: string[];
    guardianLinkIds?: string[];
    studentIds?: string[];
    classroomIds?: string[];
    customerIds?: string[];
  }
) {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Cleanup in dependency order
  if (data.enrollmentIds?.length) {
    await adminClient
      .from('preschool_enrollments')
      .delete()
      .in('id', data.enrollmentIds);
  }

  if (data.guardianLinkIds?.length) {
    await adminClient
      .from('preschool_student_guardians')
      .delete()
      .in('id', data.guardianLinkIds);
  }

  if (data.studentIds?.length) {
    await adminClient
      .from('preschool_students')
      .delete()
      .in('id', data.studentIds);
  }

  if (data.classroomIds?.length) {
    await adminClient
      .from('preschool_classrooms')
      .delete()
      .in('id', data.classroomIds);
  }

  if (data.customerIds?.length) {
    await adminClient
      .from('customers')
      .delete()
      .in('id', data.customerIds);
  }
}
