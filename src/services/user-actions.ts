'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from './audit-actions';
import { CurrentUser, StaffRecord } from '@/types/domain';
import { randomBytes } from 'crypto';
import type { Database } from '@/types/database.types';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type UserUpdate = Database['public']['Tables']['users']['Update'];

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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  
  // Use getSession() first — getSession() validates JWT locally
  // (no extra network round-trip to Supabase Auth server and avoids concurrent session refresh token race conditions).
  // Fallback to getUser() only if getSession() is null.
  const { data: { session } } = await supabase.auth.getSession();
  let user = session?.user ?? null;
  
  if (!user) { 
    const { data: { user: authUser } } = await supabase.auth.getUser(); 
    user = authUser ?? null;
    console.log("[getCurrentUser] Fallback Auth result:", !!user, user?.id); 
  }
  
  if (!user) {
    // Development bypass: proxy injects x-mock-user-email header when mock_user_email
    // cookie is present, allowing E2E tests and local dev without real Supabase passwords.
    if (process.env.NODE_ENV === 'development') {
      const { headers } = await import('next/headers');
      const mockEmail = (await headers()).get('x-mock-user-email');
      if (mockEmail && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        // Anon client is blocked by RLS without a session — use service role to bypass.
        const { createClient: createAdmin } = await import('@supabase/supabase-js');
        const adminClient = createAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: mockProfile } = await adminClient
          .from('users')
          .select('*')
          .eq('email', mockEmail)
          .single();
        if (mockProfile) {
          const profile = mockProfile as unknown as CurrentUser;
          profile.role = profile.role?.toLowerCase();
          if (profile.tenant_id) {
            const { data: tenant } = await adminClient
              .from('tenants')
              .select('status')
              .eq('id', profile.tenant_id)
              .single();
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
  const { data: mainProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (mainProfile) {
    profile = mainProfile as unknown as CurrentUser;
  }

  // Fallback 1: lookup by email (handles auth users created separately from public.users)
  if (!profile && user.email) {
    const { data: emailProfile } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();
    
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
      const { data: tenant } = await supabase
        .from('tenants')
        .select('status, name')
        .eq('id', profile.tenant_id)
        .single();
      
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  console.warn('[createUser] env check', {
    hasServiceRoleKey: !!serviceRoleKey,
    hasUrl: !!supabaseUrl,
  });

  if (!serviceRoleKey) {
    return { error: 'Hệ thống chưa cấu hình SUPABASE_SERVICE_ROLE_KEY ở Vercel — không thể tạo tài khoản đăng nhập. Vào Vercel → Settings → Environment Variables để thêm.' };
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
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([{
      id: authUserId,
      email: formData.email as string,
      full_name: formData.full_name as string,
      role: targetRole as string,
      status: 'active',
      tenant_id: currentUser?.tenant_id,
    }])
    .select()
    .single();

  if (error) {
    // Rollback the auth user so we don't leave an orphan account hanging.
    await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
    console.error('[createUser] Profile insert failed:', error);
    if (error.code === '23505' || error.message?.includes('users_email_key')) {
      return { error: 'Email này đã được sử dụng trong hệ thống. Vui lòng sử dụng email khác.' };
    }
    return { error: error.message };
  }

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
  
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting user:', error);
    return { error: error.message };
  }

  // Record Audit Log
  await recordAuditLog({
    action: 'DELETE',
    table_name: 'users',
    record_id: id,
    new_data: null
  });

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateBaseSalary(id: string, base_salary: number) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return { error: 'Quyền truy cập bị từ chối: Chỉ Admin hoặc Manager mới có quyền thay đổi lương cứng.' };
  }

  const { error } = await supabase
    .from('users')
    .update({ base_salary })
    .eq('id', id);

  if (error) {
    console.error('Error updating base salary:', error);
    return { error: error.message };
  }

  // Record Audit Log
  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'users',
    record_id: id,
    new_data: { base_salary }
  });

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}


