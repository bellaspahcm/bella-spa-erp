'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from './audit-actions';
import { CurrentUser, StaffRecord } from '@/types/domain';

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
  
  // Use getSession() instead of getUser() — getSession() validates JWT locally
  // (no extra network round-trip to Supabase Auth server). getUser() can silently
  // return null in server action contexts if the auth verification network call fails.
  let { data: { user } } = await supabase.auth.getUser(); 
  if (!user) { 
    const { data: { session } } = await supabase.auth.getSession(); 
    user = session?.user ?? null; 
    console.log("[getCurrentUser] Auth result:", !!user, user?.id); 
  }
  
  if (!user) {
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

export async function createUser(formData: CreateUserInput) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  const targetRole = formData.role || 'ktv';
  
  if (targetRole === 'ktv' && currentUser?.tenant_id) {
    const ktvLimit = await checkSubscriptionLimit(currentUser.tenant_id, 'ktv');
    if (ktvLimit.isBlocked) {
      return { error: 'Vượt quá giới hạn nhân sự kỹ thuật viên của gói dịch vụ hiện tại. Vui lòng nâng cấp gói cước.' };
    }
  }
  
  const { data, error } = await supabase
    .from('users')
    .insert([{
      email: formData.email as string,
      full_name: formData.full_name as string,
      role: targetRole as string,
      status: 'active',
      tenant_id: currentUser?.tenant_id
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    if (error.code === '23505' || error.message?.includes('users_email_key')) {
      return { error: 'Email này đã được sử dụng trong hệ thống. Vui lòng sử dụng email khác.' };
    }
    return { error: error.message };
  }

  // Record Audit Log
  await recordAuditLog({
    action: 'INSERT',
    table_name: 'users',
    record_id: data.id,
    new_data: { 
      full_name: formData.full_name, 
      email: formData.email, 
      role: targetRole
    }
  });

  await safeRevalidatePath('/dashboard/settings');
  return { data };
}

export async function updateUserStatus(id: string, status: 'active' | 'inactive') {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating user status:', error);
    return { error: error.message };
  }

  // Record Audit Log
  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'users',
    record_id: id,
    new_data: { status }
  });

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}

export async function updateUser(id: string, formData: { full_name: string; role: string }) {
  const supabase = await createClient();
  
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
  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'users',
    record_id: id,
    new_data: { full_name: formData.full_name, role: formData.role }
  });

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


