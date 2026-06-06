import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';

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
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!user.tenant_id || !ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
