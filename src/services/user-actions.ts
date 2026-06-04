'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { recordAuditLog } from './audit-actions';
import { CurrentUser, StaffRecord } from '@/types/domain';
import { randomBytes } from 'crypto';
import type { Database } from '@/types/database.types';
import { getMonthStart } from '@/lib/utils';
import type { SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js';
import { recalculateAndSaveSalaryRecordEngine } from '@/modules/hr-salary/actions/salary-recalculation-engine';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AdminSupabaseClient = {
  from: SupabaseClient['from'];
  auth: {
    admin: {
      deleteUser: (id: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};
type UserInsert = Database['public']['Tables']['users']['Insert'];
type UserRow = Database['public']['Tables']['users']['Row'];
type UserUpdate = Database['public']['Tables']['users']['Update'];
type StaffLeaveInsert = Database['public']['Tables']['staff_leaves']['Insert'];
type StaffLeaveRow = Database['public']['Tables']['staff_leaves']['Row'];
type SalarySupabaseClient = SupabaseJsClient<Database>;
type SupabaseQueryError = { code?: string; message?: string } | null;

interface UserWithLogsAndReviews {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string | null;
  tenant_id: string | null;
  session_logs: { count: number }[];
  session_reviews: { rating: number }[];
}

export interface CreateUserInput {
  email: string;
  full_name: string;
  role: string;
}

function isMissingSingleRowError(error: SupabaseQueryError) {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    error.code === 'PGRST116' ||
    message.includes('json object requested') ||
    message.includes('0 rows') ||
    message.includes('no rows')
  );
}

function isMissingAuthSessionError(error: unknown) {
  const message = getErrorMessage(error, '').toLowerCase();
  return (
    message.includes('auth session missing') ||
    message.includes('session missing') ||
    message.includes('no current user')
  );
}

function assertNonMissingQueryError(error: SupabaseQueryError, context: string) {
  if (!error || isMissingSingleRowError(error)) return;
  throw new Error(`${context}: ${error.message || 'Unknown database error'}`);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && !isMissingAuthSessionError(authError)) {
    console.error('[getCurrentUser] Auth user validation failed:', authError);
    throw new Error(`Failed to validate current user: ${getErrorMessage(authError)}`);
  }
  
  if (!user) {
    // Development bypass: proxy injects x-mock-user-email header when mock_user_email
    // cookie is present, allowing E2E tests and local dev without real Supabase passwords.
    if (process.env.NODE_ENV === 'development') {
      const { headers } = await import('next/headers');
      const mockEmail = (await headers()).get('x-mock-user-email');
      const adminUrl = getSupabaseAdminUrl();
      const adminKey = getSupabaseAdminKey();
      if (mockEmail && adminUrl && adminKey) {
        // Anon client is blocked by RLS without a session — use service role to bypass.
        const { createClient: createAdmin } = await import('@supabase/supabase-js');
        const adminClient = createAdmin(
          adminUrl,
          adminKey,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: mockProfile, error: mockProfileError } = await adminClient
          .from('users')
          .select('*')
          .eq('email', mockEmail)
          .single();
        assertNonMissingQueryError(
          mockProfileError as SupabaseQueryError,
          '[getCurrentUser] Failed to fetch development mock profile',
        );
        if (mockProfile) {
          const profile = mockProfile as unknown as CurrentUser;
          profile.role = profile.role?.toLowerCase();
          if (profile.tenant_id) {
            const { data: tenant, error: tenantError } = await adminClient
              .from('tenants')
              .select('status')
              .eq('id', profile.tenant_id)
              .single();
            assertNonMissingQueryError(
              tenantError as SupabaseQueryError,
              '[getCurrentUser] Failed to fetch development mock tenant',
            );
            if (tenant?.status === 'suspended') profile.isSuspended = true;
          }
          return profile;
        }
      }
    }
    console.warn('[getCurrentUser] No active session found');
    return null;
  }


  // Try fetching from 'users' table by ID (primary path)
  let profile: CurrentUser | null = null;
  const { data: mainProfile, error: mainProfileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  assertNonMissingQueryError(
    mainProfileError as SupabaseQueryError,
    '[getCurrentUser] Failed to fetch profile by auth id',
  );
  
  if (mainProfile) {
    profile = mainProfile as unknown as CurrentUser;
  }

  // Fallback 1: lookup by email (handles auth users created separately from public.users)
  if (!profile && user.email) {
    const { data: emailProfile, error: emailProfileError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();
    assertNonMissingQueryError(
      emailProfileError as SupabaseQueryError,
      '[getCurrentUser] Failed to fetch profile by email',
    );
    
    if (emailProfile) {
      profile = emailProfile as unknown as CurrentUser;
    }
  }



  if (!profile) {
    console.error('[getCurrentUser] No profile found for auth user:', user.email, '| auth_id:', user.id);
  } else {
    // Standardize role to lowercase to avoid case-sensitivity issues across the app
    profile.role = profile.role?.toLowerCase();

    // Check if the tenant is suspended
    if (profile.tenant_id) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('status, name')
        .eq('id', profile.tenant_id)
        .single();
      assertNonMissingQueryError(
        tenantError as SupabaseQueryError,
        '[getCurrentUser] Failed to fetch tenant status',
      );
      
      if (tenant && tenant.status === 'suspended') {
        console.warn(`[getCurrentUser] Tenant ${tenant.name} (${profile.tenant_id}) is suspended. Blocking user.`);
        profile.isSuspended = true;
      }
    }
  }

  return profile || { 
    id: user.id, 
    email: user.email || '', 
    role: "user", 
    tenant_id: null,
    full_name: "",
    avatar_url: null
  };
}


export async function getUsers(): Promise<StaffRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      session_logs(count),
      session_reviews(rating)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
  }

  const processedData: StaffRecord[] = (data as unknown as UserWithLogsAndReviews[] || []).map((user) => {
    const reviews = user.session_reviews || [];
    const avgRating = reviews.length 
      ? reviews.reduce((acc: number, r) => acc + r.rating, 0) / reviews.length 
      : 5.0;
    
    return {
      id: user.id,
      full_name: user.full_name || '',
      email: user.email,
      role: user.role,
      status: user.status,
      sessions_count: user.session_logs?.[0]?.count || 0,
      avg_rating: avgRating.toFixed(1)
    };
  });


  return processedData;
}

import { checkSubscriptionLimit } from '@/lib/subscription';

function generateTemporaryPassword() {
  return `Bella-${randomBytes(9).toString('base64url')}1aA!`;
}

function getErrorMessage(error: unknown, fallback = 'Loi he thong') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

async function rollbackUserUpdate(
  supabase: SupabaseClient,
  id: string,
  payload: UserUpdate,
) {
  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id);

  return error?.message || '';
}

function toUserInsertSnapshot(user: UserRow): UserInsert {
  return {
    avatar_url: user.avatar_url,
    base_salary: user.base_salary,
    created_at: user.created_at,
    email: user.email,
    full_name: user.full_name,
    hire_date: user.hire_date,
    id: user.id,
    phone: user.phone,
    resignation_date: user.resignation_date,
    role: user.role,
    status: user.status,
    tenant_id: user.tenant_id,
    updated_at: user.updated_at,
  };
}

function toUserAuditSnapshot(user: UserRow) {
  return toUserInsertSnapshot(user);
}

function toStaffLeaveInsertSnapshot(leave: StaffLeaveRow): StaffLeaveInsert {
  return {
    approved_by: leave.approved_by,
    created_at: leave.created_at,
    id: leave.id,
    leave_date: leave.leave_date,
    leave_type: leave.leave_type,
    reason: leave.reason,
    rejection_reason: leave.rejection_reason,
    status: leave.status,
    tenant_id: leave.tenant_id,
    updated_at: leave.updated_at,
    user_id: leave.user_id,
  };
}

async function restoreDeletedUser(
  supabase: SupabaseClient,
  payload: UserInsert,
) {
  const { error } = await supabase
    .from('users')
    .insert([payload]);

  return error?.message || '';
}

async function restoreDeletedStaffLeaves(
  supabase: SupabaseClient,
  payloads: StaffLeaveInsert[],
) {
  if (payloads.length === 0) return '';

  const { error } = await supabase
    .from('staff_leaves')
    .insert(payloads);

  return error?.message || '';
}

async function rollbackCreatedAuthUser(
  supabaseAdmin: AdminSupabaseClient,
  authUserId: string,
) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  return error?.message || '';
}

async function rollbackCreatedUserProfile(
  supabaseAdmin: AdminSupabaseClient,
  authUserId: string,
) {
  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', authUserId);

  return error?.message || '';
}

function formatRollbackNotes(notes: Array<[string, string]>) {
  return notes
    .filter(([, message]) => message)
    .map(([label, message]) => `; ${label} failed: ${message}`)
    .join('');
}

async function recalculateCurrentMonthSalary(
  supabase: SupabaseClient,
  ktvId: string,
  tenantId: string,
) {
  return recalculateAndSaveSalaryRecordEngine(
    supabase as unknown as SalarySupabaseClient,
    ktvId,
    getMonthStart(),
    tenantId,
  );
}

async function rollbackBaseSalaryChange(
  supabase: SupabaseClient,
  id: string,
  previousBaseSalary: number | null,
  recalcTenantId?: string | null,
) {
  const userRollbackError = await rollbackUserUpdate(supabase, id, {
    base_salary: previousBaseSalary,
  });

  let salaryRollbackError = '';
  if (!userRollbackError && recalcTenantId) {
    try {
      await recalculateCurrentMonthSalary(supabase, id, recalcTenantId);
    } catch (error: unknown) {
      salaryRollbackError = getErrorMessage(error);
    }
  }

  return formatRollbackNotes([
    ['user rollback', userRollbackError],
    ['salary rollback', salaryRollbackError],
  ]);
}

export async function createUser(formData: CreateUserInput) {
  const currentUser = await getCurrentUser();

  const targetRole = formData.role || 'ktv';

  if (targetRole === 'ktv' && currentUser?.tenant_id) {
    const ktvLimit = await checkSubscriptionLimit(currentUser.tenant_id, 'ktv');
    if (ktvLimit.isBlocked) {
      return { error: 'Vượt quá giới hạn nhân sự kỹ thuật viên của gói dịch vụ hiện tại. Vui lòng nâng cấp gói cước.' };
    }
  }

  // STEP 1 — Create the Supabase Auth account first so the employee can log in.
  // Without this, the public.users row was a dead record (no auth → no login).
  // Pattern mirrors registerNewTenant() in onboarding-actions.ts.
  const serviceRoleKey = getSupabaseAdminKey();
  const supabaseUrl = getSupabaseAdminUrl();
  console.warn('[createUser] env check', {
    hasAdminKey: !!serviceRoleKey,
    hasUrl: !!supabaseUrl,
  });

  if (!serviceRoleKey) {
    return { error: 'Hệ thống chưa cấu hình SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY ở Vercel — không thể tạo tài khoản đăng nhập. Vào Vercel → Settings → Environment Variables để thêm.' };
  }
  if (!supabaseUrl) {
    return { error: 'Hệ thống chưa cấu hình NEXT_PUBLIC_SUPABASE_URL — không thể kết nối Supabase.' };
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const temporaryPassword = generateTemporaryPassword();

  const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: temporaryPassword,
    email_confirm: true, // bypass confirmation email (rate limit + UX)
    user_metadata: { full_name: formData.full_name },
  });

  console.warn('[createUser] auth.admin.createUser result', {
    hasUser: !!adminData?.user?.id,
    authUserId: adminData?.user?.id ?? null,
    errorMessage: adminError?.message ?? null,
    errorStatus: (adminError as { status?: number } | null)?.status ?? null,
  });

  if (adminError) {
    console.error('[createUser] Auth user creation failed:', adminError);
    if (adminError.message?.toLowerCase().includes('already') || adminError.message?.includes('registered')) {
      return { error: 'Email này đã được sử dụng trong hệ thống. Vui lòng sử dụng email khác.' };
    }
    return { error: `Không thể tạo tài khoản đăng nhập: ${adminError.message}` };
  }

  const authUserId = adminData?.user?.id;
  if (!authUserId) {
    return { error: 'Tạo tài khoản đăng nhập không thành công (auth user id rỗng).' };
  }

  // STEP 2 — Insert the profile row with id matching the auth user, so
  // getCurrentUser()'s primary id lookup (users.id = auth.uid) hits directly.
  // Uses supabaseAdmin (service role) to bypass any RLS policy that might
  // restrict cross-user inserts on public.users (id != auth.uid()).
  const userPayload: UserInsert = {
    id: authUserId,
    email: formData.email,
    full_name: formData.full_name,
    role: targetRole,
    status: 'active',
    tenant_id: currentUser?.tenant_id,
  };

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([userPayload])
    .select()
    .single();

  if (error) {
    // Rollback the auth user so we don't leave an orphan account hanging.
    const authRollbackError = await rollbackCreatedAuthUser(supabaseAdmin, authUserId);
    console.error('[createUser] Profile insert failed:', error);
    const rollbackNote = formatRollbackNotes([
      ['auth rollback', authRollbackError],
    ]);
    if (!rollbackNote && (error.code === '23505' || error.message?.includes('users_email_key'))) {
      return { error: 'Email này đã được sử dụng trong hệ thống. Vui lòng sử dụng email khác.' };
    }
    return { error: `${error.message}${rollbackNote}` };
  }

  try {
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'users',
      record_id: data.id,
      new_data: {
        full_name: formData.full_name,
        email: formData.email,
        role: targetRole,
      },
    });
  } catch (auditError: unknown) {
    const profileRollbackError = await rollbackCreatedUserProfile(supabaseAdmin, authUserId);
    const authRollbackError = await rollbackCreatedAuthUser(supabaseAdmin, authUserId);
    const rollbackNote = formatRollbackNotes([
      ['profile rollback', profileRollbackError],
      ['auth rollback', authRollbackError],
    ]);
    return { error: `Failed to record user create audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { data, defaultPassword: temporaryPassword };
}

export async function updateUserStatus(id: string, status: 'active' | 'inactive') {
  const supabase = await createClient();

  const { data: previousUser, error: snapshotError } = await supabase
    .from('users')
    .select('status')
    .eq('id', id)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }
  
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating user status:', error);
    return { error: error.message };
  }

  // Record Audit Log
  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      old_data: { status: previousUser.status },
      new_data: { status }
    });
  } catch (auditError: unknown) {
    const rollbackError = await rollbackUserUpdate(supabase, id, {
      status: previousUser.status,
    });
    const rollbackNote = rollbackError ? `; rollback failed: ${rollbackError}` : '';
    return { error: `Failed to record user status audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateUser(id: string, formData: { full_name: string; role: string }) {
  const supabase = await createClient();

  const { data: previousUser, error: snapshotError } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', id)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }
  
  const { error } = await supabase
    .from('users')
    .update({
      full_name: formData.full_name,
      role: formData.role
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating user:', error);
    return { error: error.message };
  }

  // Record Audit Log
  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      old_data: { full_name: previousUser.full_name, role: previousUser.role },
      new_data: { full_name: formData.full_name, role: formData.role }
    });
  } catch (auditError: unknown) {
    const rollbackError = await rollbackUserUpdate(supabase, id, {
      full_name: previousUser.full_name,
      role: previousUser.role,
    });
    const rollbackNote = rollbackError ? `; rollback failed: ${rollbackError}` : '';
    return { error: `Failed to record user update audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}

export async function deleteUser(id: string) {
  const supabase = await createClient();

  const {
    data: previousUser,
    error: snapshotError,
  }: { data: UserRow | null; error: { message?: string } | null } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }

  const restorePayload = toUserInsertSnapshot(previousUser);

  const {
    data: previousStaffLeaves,
    error: staffLeavesSnapshotError,
  }: { data: StaffLeaveRow[] | null; error: { message?: string } | null } = await supabase
    .from('staff_leaves')
    .select('*')
    .eq('user_id', id);

  if (staffLeavesSnapshotError) {
    return { error: staffLeavesSnapshotError.message || 'Failed to snapshot staff leaves' };
  }

  const staffLeaveRestorePayloads = (previousStaffLeaves || []).map(toStaffLeaveInsertSnapshot);
  
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting user:', error);
    return { error: error.message };
  }

  // Record Audit Log
  try {
    await recordAuditLog({
      action: 'DELETE',
      table_name: 'users',
      record_id: id,
      old_data: toUserAuditSnapshot(previousUser),
      new_data: null
    });
  } catch (auditError: unknown) {
    const restoreError = await restoreDeletedUser(supabase, restorePayload);
    const staffLeavesRestoreError = restoreError
      ? ''
      : await restoreDeletedStaffLeaves(supabase, staffLeaveRestorePayloads);
    const restoreNote = formatRollbackNotes([
      ['restore', restoreError],
      ['staff leaves restore', staffLeavesRestoreError],
    ]);
    return { error: `Failed to record user delete audit log: ${getErrorMessage(auditError)}${restoreNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateBaseSalary(id: string, base_salary: number) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return { error: 'Quyền truy cập bị từ chối: Chỉ Admin hoặc Manager mới có quyền thay đổi lương cứng.' };
  }

  const {
    data: previousUser,
    error: snapshotError,
  }: {
    data: Pick<UserRow, 'base_salary' | 'role' | 'tenant_id'> | null;
    error: { message?: string } | null;
  } = await supabase
    .from('users')
    .select('base_salary, role, tenant_id')
    .eq('id', id)
    .single();

  if (snapshotError || !previousUser) {
    return { error: snapshotError?.message || 'User not found' };
  }

  const { error } = await supabase
    .from('users')
    .update({ base_salary })
    .eq('id', id);

  if (error) {
    console.error('Error updating base salary:', error);
    return { error: error.message };
  }

  const recalcTenantId = previousUser.role === 'ktv' ? previousUser.tenant_id : null;

  if (recalcTenantId) {
    try {
      await recalculateCurrentMonthSalary(supabase, id, recalcTenantId);
    } catch (recalcError: unknown) {
      const rollbackNote = await rollbackBaseSalaryChange(
        supabase,
        id,
        previousUser.base_salary,
        recalcTenantId,
      );
      return { error: `Failed to recalculate salary after base salary update: ${getErrorMessage(recalcError)}${rollbackNote}` };
    }
  }

  // Record Audit Log
  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'users',
      record_id: id,
      old_data: { base_salary: previousUser.base_salary },
      new_data: { base_salary }
    });
  } catch (auditError: unknown) {
    const rollbackNote = await rollbackBaseSalaryChange(
      supabase,
      id,
      previousUser.base_salary,
      recalcTenantId,
    );
    return { error: `Failed to record base salary audit log: ${getErrorMessage(auditError)}${rollbackNote}` };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}


