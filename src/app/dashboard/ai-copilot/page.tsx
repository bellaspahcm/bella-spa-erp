import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';
import AICopilotClient from './ai-copilot-client';
import { canUseAiCopilotRole } from '@/lib/business-rules/permissions';

export const metadata = {
  title: 'Bella AI Copilot — Trợ lý điều phối vận hành',
  description: 'Trợ lý ảo đa đại lý AI COO/CHRO/CFO cho Bella Spa.',
};

/**
 * L1 FIX: Server-side role guard for /dashboard/ai-copilot.
 * Pattern matches /hq/financial-overview (Phase 29.3).
 *
 * Authorization tiers:
 *   - Page-level guard (this file): redirect non-eligible to /dashboard
 *   - API-level guard (coo-orchestrator/action-approval/route.ts): re-check role
 *   - DB-level guard (RLS + RPC auth check): final defense
 */
export default async function AICopilotPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/dashboard/ai-copilot');
  }

  if (!canUseAiCopilotRole(user.role)) {
    // KTV, ktv_lead, admin_staff không có quyền vào AI Copilot
    redirect('/dashboard');
  }

  return <AICopilotClient />;
}
