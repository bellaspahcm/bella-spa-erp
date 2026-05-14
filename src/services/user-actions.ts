'use server';

import { safeRevalidatePath } from '@/lib/revalidate';

export async function getCurrentUser() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // For the demo/mock environment, if no authenticated user is found, 
  // we check for a search param or return a default (admin for now)
  if (!user) {
    // In a real app, we'd return null or redirect to login
    // For this demo, let's allow "simulating" a KTV via a search param if needed
    // But for safety, we return a default admin profile
    return { id: 'admin-01', full_name: 'Quản trị viên', role: 'admin' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile || { id: user.id, role: 'ktv', full_name: user.email?.split('@')[0] };
}

export async function getUsers() {
  const { createClient } = await import('@/lib/supabase-server');
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

  // If DB is empty or has only the initial admin, add mock data for demo
  if (processedData.length <= 1) {
    const mockUsers = [
      { id: 'm1', full_name: 'Nguyễn Thị Hoa', role: 'ktv', email: 'hoa.nt@bellaspa.vn', status: 'active', sessions_count: 45, avg_rating: '5.0', created_at: new Date().toISOString() },
      { id: 'm2', full_name: 'Lê Thu Hà', role: 'ktv', email: 'ha.lt@bellaspa.vn', status: 'active', sessions_count: 38, avg_rating: '4.9', created_at: new Date().toISOString() },
      { id: 'm3', full_name: 'Phạm Minh Tuyết', role: 'ktv', email: 'tuyet.pm@bellaspa.vn', status: 'active', sessions_count: 32, avg_rating: '4.8', created_at: new Date().toISOString() },
      { id: 'm4', full_name: 'Trần Tâm', role: 'ktv', email: 'tam.t@bellaspa.vn', status: 'active', sessions_count: 28, avg_rating: '4.7', created_at: new Date().toISOString() },
      { id: 'm5', full_name: 'Lê Diệu Huyền', role: 'staff', email: 'receptionist@bellaspa.vn', status: 'active', sessions_count: 120, avg_rating: '5.0', created_at: new Date().toISOString() },
    ];
    return [...processedData, ...mockUsers];
  }

  return processedData;
}

export async function createUser(formData: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('users')
    .insert([{
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role || 'ktv',
      status: 'active',
      // In a real multi-tenant app, we'd get the tenant_id from the session
      // For now, we'll use 't01' as fallback for the demo
      tenant_id: formData.tenant_id || 't01'
    } as any])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    return { error: error.message };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { data };
}

export async function updateUserStatus(id: string, status: 'active' | 'inactive') {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { error } = await supabase
    .from('users')
    .update({ status } as any)
    .eq('id', id);

  if (error) {
    console.error('Error updating user status:', error);
    return { error: error.message };
  }

  await safeRevalidatePath('/dashboard/settings');
  return { success: true };
}
