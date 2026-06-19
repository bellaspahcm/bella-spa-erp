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
import { listPartners } from '@/services/api-gateway/partner.service';

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

  if (!profile.tenant_id) {
    redirect('/dashboard');
  }

  // Role check - admin/owner only
  if (profile.role !== 'admin' && profile.role !== 'owner') {
    redirect('/dashboard');
  }

  const { partners } = await listPartners({
    tenant_id: profile.tenant_id,
    limit: 100,
    offset: 0,
  });

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
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
        <AdvancedAnalyticsDashboard partners={partners} tenantId={profile.tenant_id} />
      </Suspense>
    </div>
  );
}
