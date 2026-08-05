import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import BookingsPageClient from './client';

export const metadata = {
  title: 'Quản Lý Booking & Đặt Cọc | Bella Auto',
  description: 'Theo dõi trạng thái đặt cọc và xác nhận thanh toán của khách hàng',
};

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    redirect('/login');
  }

  return <BookingsPageClient tenantId={profile.tenant_id} />;
}
