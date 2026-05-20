'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from './audit-actions';

export async function getCurrentUser() {
  const supabase = (await createClient()) as any;
  
  // Use getSession() instead of getUser() â€” getSession() validates JWT locally
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
  let { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fallback 1: lookup by email (handles auth users created separately from public.users)
  if (!profile && user.email) {
    const { data: emailProfile } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();
    
    if (emailProfile) {
      profile = emailProfile;
    }
  }

  // Fallback 2: 'profiles' table
  if (!profile) {
    const { data: fallbackProfile } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (fallbackProfile) {
      profile = {
        ...fallbackProfile,
        role: fallbackProfile.role?.toLowerCase() === 'admin' ? 'admin' : fallbackProfile.role
      };
    }
  }

  if (!profile) {
    console.error('[getCurrentUser] No profile found for auth user:', user.email, '| auth_id:', user.id);
  } else {
    // Standardize role to lowercase to avoid case-sensitivity issues across the app
    profile.role = profile.role?.toLowerCase();
  }

  return profile || { id: user.id, email: user.email, role: "user" };
}


export async function getUsers() {
  const supabase = (await createClient()) as any;
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

  const processedData = (data || []).map((user: any) => {
    const reviews = user.session_reviews || [];
    const avgRating = reviews.length 
      ? reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length 
      : 5.0;
    
    return {
      ...user,
      sessions_count: user.session_logs?.[0]?.count || 0,
      avg_rating: avgRating.toFixed(1)
    };
  });


  return processedData;
}

export async function createUser(formData: any) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  
  const { data, error } = await supabase
    .from('users')
    .insert([{
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role || 'ktv',
      status: 'active',
      tenant_id: currentUser?.tenant_id
    } as any])
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
      role: formData.role || 'ktv' 
    }
  });

  await safeRevalidatePath('/dashboard/settings');
  return { data };
}

export async function updateUserStatus(id: string, status: 'active' | 'inactive') {
  const supabase = (await createClient()) as any;
  
  const { error } = await supabase
    .from('users')
    .update({ status } as any)
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

export async function updateUser(id: string, formData: any) {
  const supabase = (await createClient()) as any;
  
  const { error } = await supabase
    .from('users')
    .update({
      full_name: formData.full_name,
      role: formData.role
    } as any)
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
  const supabase = (await createClient()) as any;
  
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


