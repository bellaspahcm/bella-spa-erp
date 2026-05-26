import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

const ALLOWED_ROLES = ['admin', 'super_admin', 'accountant'] as const;

/**
 * Server-side role guard cho toàn bộ /dashboard/ai-copilot.
 * KTV, receptionist và các role khác bị redirect về /dashboard.
 * Không thêm wrapper UI — tránh phá vỡ flex layout của page con.
 */
export default async function AICopilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.tenant_id || !ALLOWED_ROLES.includes(userData.role as typeof ALLOWED_ROLES[number])) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
