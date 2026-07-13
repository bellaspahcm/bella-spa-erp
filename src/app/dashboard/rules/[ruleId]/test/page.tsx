/**
 * Rule Test Simulator Page
 * Path: /dashboard/rules/[ruleId]/test
 * 
 * Allows business users to test rules with sample data before activating.
 * Features:
 * - JSON input editor (CodeMirror or textarea)
 * - Execute button with loading state
 * - Result display with execution trace
 * - Test history with saved results
 */

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { notFound, redirect } from 'next/navigation';
import RuleTestSimulator from '@/components/rules/RuleTestSimulator';

interface PageProps {
  params: Promise<{
    ruleId: string;
  }>;
}

export default async function RuleTestPage({ params }: PageProps) {
  const { ruleId } = await params;

  // Authenticate user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user's tenant
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData || !userData.tenant_id) {
    return notFound();
  }

  // Fetch rule
  const { data: rule, error: ruleError } = await supabase
    .from('rules')
    .select('id, name, description, provider, conditions, actions, status')
    .eq('id', ruleId)
    .eq('tenant_id', userData.tenant_id)
    .single();

  if (ruleError || !rule) {
    return notFound();
  }

  // Fetch recent test results (last 10)
  const { data: testHistory, error: historyError } = await supabase
    .from('rule_test_results')
    .select('*')
    .eq('rule_id', ruleId)
    .eq('tenant_id', userData.tenant_id)
    .order('tested_at', { ascending: false })
    .limit(10);

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<div>Loading simulator...</div>}>
        <RuleTestSimulator
          rule={rule}
          testHistory={(testHistory || []).map(h => ({
            ...h,
            test_name: h.test_name || 'Unnamed Test',
            execution_time_ms: h.execution_time_ms || 0,
            trace: (h.trace as any) || [],
            matched_conditions: (h.matched_conditions as any) || [],
            executed_actions: (h.executed_actions as any) || [],
          }))}
        />
      </Suspense>
    </div>
  );
}
