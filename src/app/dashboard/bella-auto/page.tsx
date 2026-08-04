import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import VehicleInventoryDashboard from '@/components/bella-auto/VehicleInventoryDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, History, BarChart3 } from 'lucide-react';
import TemporalQueryBuilder from '@/components/bella-auto/TemporalQueryBuilder';

export const dynamic = 'force-dynamic';

export default async function BellaAutoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get tenant
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) {
    return <div>Không tìm thấy tenant</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bella Auto</h1>
          <p className="text-gray-600">Quản lý kho xe & hành trình khách hàng</p>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Car className="w-4 h-4" />
            Kho xe
          </TabsTrigger>
          <TabsTrigger value="temporal" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Time Travel
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Phân tích
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-6">
          <Suspense fallback={<div>Đang tải...</div>}>
            <VehicleInventoryDashboard tenantId={profile.tenant_id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="temporal" className="mt-6">
          <Suspense fallback={<div>Đang tải...</div>}>
            <TemporalQueryBuilder tenantId={profile.tenant_id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Phân tích sẽ có sớm</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
