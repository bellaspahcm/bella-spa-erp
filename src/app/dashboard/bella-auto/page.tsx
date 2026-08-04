import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import VehicleInventoryDashboard from '@/components/bella-auto/VehicleInventoryDashboard';
import { BellaAutoHeader } from '@/components/bella-auto/BellaAutoHeader';

export const dynamic = 'force-dynamic';

export default async function BellaAutoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get tenant and user profile
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, full_name')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) {
    return <div>Không tìm thấy tenant</div>;
  }

  // Get tenant name
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', profile.tenant_id)
    .single();

  const monogram = profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'BA';

  return (
    <div className="p-6 w-full space-y-6">
      {/* Premium Dashboard Welcome Header - Real Estate Style */}
      <BellaAutoHeader 
        monogram={monogram}
        fullName={profile?.full_name || 'Admin'}
        tenantName={tenant?.name || 'Bella Auto'}
      />

      {/* Vehicle Inventory Dashboard */}
      <Suspense fallback={
        <div className="p-8 space-y-6 animate-pulse">
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      }>
        <VehicleInventoryDashboard tenantId={profile.tenant_id} />
      </Suspense>
    </div>
  );
}
