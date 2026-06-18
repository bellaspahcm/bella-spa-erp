/**
 * Advanced Analytics Dashboard
 * 
 * So sánh performance của nhiều partners:
 * - Multi-partner comparison
 * - Trend analysis (7d, 30d, 90d)
 * - Cost tracking per partner
 * - Performance benchmarks
 * - Revenue impact analysis
 */

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { AdvancedAnalyticsDashboard } from '@/components/admin/partners/AdvancedAnalyticsDashboard';

export const metadata = {
  title: 'Analytics Dashboard - API Partners',
  description: 'Advanced analytics and performance comparison for API partners',
};

export default async function AdvancedAnalyticsPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Role check - admin/owner only
  if (profile.role !== 'admin' && profile.role !== 'owner') {
    redirect('/dashboard');
  }

  // Fetch all partners for this tenant
  const { data: partners } = await supabase
    .from('api_partners' as any)
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Phân tích và so sánh performance của các đối tác API
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }
      >
        <AdvancedAnalyticsDashboard partners={(partners as any) || []} tenantId={profile.tenant_id || ''} />
      </Suspense>
    </div>
  );
}
