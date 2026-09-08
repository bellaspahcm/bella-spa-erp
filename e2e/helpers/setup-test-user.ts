/**
 * Setup test user with real Supabase Auth for E2E tests
 * 
 * Creates a user in auth.users with proper JWT claims
 * and corresponding record in public.users table
 */

import { admin, getHqTenantId } from './supabase-admin';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  tenant_id: string;
}

const TEST_USER_EMAIL = 'e2e.preschool.test@bellaspa.local';
const TEST_USER_PASSWORD = 'E2eTest123!SecurePassword';

/**
 * Creates or retrieves test user with real Supabase auth
 * Returns credentials that can be used for login
 * 
 * NOTE: Uses non-HQ tenant to avoid super-admin NULL tenant_id behavior
 * NOTE: Does NOT delete existing user - reuses stable identity across suite
 */
export async function setupTestUser(): Promise<TestUser> {
  // Use non-HQ active tenant for Preschool tests
  // HQ tenant causes get_auth_tenant_id() to return NULL (super-admin bypass)
  const tenantId = '3f042f90-e9bb-448a-8001-2f418a705dad'; // Tenant A Leak Test (active)
  
  console.log('[setupTestUser] Ensuring test user exists with real Supabase auth (non-HQ tenant)...');
  
  // Check if user already exists
  const { data: existingUsers } = await admin().auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(u => u.email === TEST_USER_EMAIL);

  if (existingUser) {
    console.log('[setupTestUser] Test user already exists, reusing:', existingUser.id);
    
    // Verify public.users record exists
    const { data: publicUser } = await admin()
      .from('users')
      .select('*')
      .eq('id', existingUser.id)
      .single();

    if (!publicUser) {
      console.log('[setupTestUser] Public user record missing, creating...');
      await admin()
        .from('users')
        .insert({
          id: existingUser.id,
          email: TEST_USER_EMAIL,
          full_name: 'E2E Test User (Preschool)',
          role: 'admin',
          tenant_id: tenantId,
          status: 'active',
        });
    }

    return {
      id: existingUser.id,
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      tenant_id: tenantId,
    };
  }

  // Create new auth user
  console.log('[setupTestUser] Creating new test user...');
  const { data: authUser, error: authError } = await admin().auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'E2E Test User (Preschool)',
    },
    app_metadata: {
      tenant_id: tenantId,
      role: 'admin',
    },
  });

  if (authError || !authUser?.user) {
    throw new Error(`Failed to create test user: ${authError?.message || 'No user returned'}`);
  }

  console.log('[setupTestUser] Auth user created:', authUser.user.id);

  // Create corresponding public.users record
  const { error: publicUserError } = await admin()
    .from('users')
    .insert({
      id: authUser.user.id,
      email: TEST_USER_EMAIL,
      full_name: 'E2E Test User (Preschool)',
      role: 'admin',
      tenant_id: tenantId,
      status: 'active',
    });

  if (publicUserError && !publicUserError.message.includes('duplicate key')) {
    console.error('[setupTestUser] Failed to create public.users record:', publicUserError);
  }

  console.log('[setupTestUser] Test user setup complete');
  console.log('[setupTestUser] Email:', TEST_USER_EMAIL);
  console.log('[setupTestUser] Tenant ID:', tenantId);

  return {
    id: authUser.user.id,
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    tenant_id: tenantId,
  };
}

/**
 * Cleanup test user (optional - for manual teardown only)
 * 
 * WARNING: Do NOT call this during test execution
 * The test user should remain stable across the entire suite
 */
export async function cleanupTestUser(): Promise<void> {
  console.log('[cleanupTestUser] WARNING: Removing stable test user (manual teardown)...');
  
  const { data: users } = await admin().auth.admin.listUsers();
  const testUser = users?.users.find(u => u.email === TEST_USER_EMAIL);
  
  if (testUser) {
    // Delete from public.users first (FK constraints)
    await admin()
      .from('users')
      .delete()
      .eq('id', testUser.id);
    
    // Delete from auth
    await admin().auth.admin.deleteUser(testUser.id);
    
    console.log('[cleanupTestUser] Test user removed');
  }
}

export { TEST_USER_EMAIL, TEST_USER_PASSWORD };
