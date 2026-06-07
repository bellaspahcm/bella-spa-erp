import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';
import { canAccessAiCopilot } from '@/lib/business-rules/permissions';

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

  if (!canAccessAiCopilot({ role: user.role, tenantId: user.tenant_id })) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
