/**
 * Trang Chi Tiết Đối Tác
 * 
 * Hiển thị thông tin đầy đủ về một đối tác API với 9 tabs:
 * - Overview: Thông tin tổng quan
 * - Scopes: Quản lý phân quyền
 * - Security: API Key Rotation & Security Settings
 * - Activity: Timeline hoạt động real-time
 * - Logs: Nhật ký request
 * - Webhooks: Cấu hình webhook
 * - Webhook Logs: Nhật ký webhook delivery
 * - Usage: Thống kê sử dụng
 * - SLA: Giám sát SLA & Alerts
 */

import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase-server';
import { getPartnerById } from '@/services/api-gateway/partner.service';
import { PartnerDetailHeader } from '@/components/admin/partners/PartnerDetailHeader';

// Tab Components
import { PartnerOverviewTab } from '@/components/admin/partners/detail-tabs/PartnerOverviewTab';
import { PartnerScopesTab } from '@/components/admin/partners/detail-tabs/PartnerScopesTab';
import { PartnerLogsTab } from '@/components/admin/partners/detail-tabs/PartnerLogsTab';
import { PartnerWebhooksTab } from '@/components/admin/partners/detail-tabs/PartnerWebhooksTab';
import { PartnerUsageTab } from '@/components/admin/partners/detail-tabs/PartnerUsageTab';
import { PartnerWebhookLogsTab } from '@/components/admin/partners/detail-tabs/PartnerWebhookLogsTab';
import { PartnerSecurityTab } from '@/components/admin/partners/detail-tabs/PartnerSecurityTab';
import { PartnerActivityTab } from '@/components/admin/partners/detail-tabs/PartnerActivityTab';
import { PartnerSLAMonitorTab } from '@/components/admin/partners/detail-tabs/PartnerSLAMonitorTab';

export const metadata: Metadata = {
  title: 'Chi Tiết Đối Tác | Admin',
  description: 'Xem và quản lý thông tin đối tác API',
};

interface PartnerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    tab?: string;
    embedded?: string;
  }>;
}

export default async function PartnerDetailPage({
  params,
  searchParams,
}: PartnerDetailPageProps) {
  const { id } = await params;
  const { tab, embedded } = await searchParams;
  const activeTab = tab || 'overview';

  // Lấy user hiện tại
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Lấy tenant của user
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) {
    redirect('/dashboard');
  }

  const partnerData = await getPartnerById(id, profile.tenant_id);

  if (!partnerData) {
    notFound();
  }

  const isEmbedded = embedded === 'true';

  return (
    <div className={`space-y-8 w-full ${isEmbedded ? 'px-4 md:px-6 py-2' : 'p-6 md:p-8 lg:p-10 max-w-7xl mx-auto'}`}>
      {/* Redesigned Premium Header Component */}
      <PartnerDetailHeader partner={partnerData} />

      {/* Tabs list with horizontal scroll capability for smaller viewports */}
      <Tabs defaultValue={activeTab} className="space-y-6">
        <div className="w-full border-b border-slate-100 dark:border-slate-800/80 pb-px">
          <div className="w-full overflow-x-auto scrollbar-none">
            <TabsList variant="line" className="flex w-max min-w-full justify-start gap-4 md:gap-6 bg-transparent h-10 px-1 border-b border-transparent">
              <TabsTrigger value="overview" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Tổng Quan</TabsTrigger>
              <TabsTrigger value="scopes" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Phân Quyền</TabsTrigger>
              <TabsTrigger value="security" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Security</TabsTrigger>
              <TabsTrigger value="activity" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Activity</TabsTrigger>
              <TabsTrigger value="logs" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Nhật Ký</TabsTrigger>
              <TabsTrigger value="webhooks" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Webhooks</TabsTrigger>
              <TabsTrigger value="webhook-logs" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Webhook Logs</TabsTrigger>
              <TabsTrigger value="usage" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">Thống Kê</TabsTrigger>
              <TabsTrigger value="sla" className="data-active:text-foreground text-muted-foreground bg-transparent font-medium py-2">SLA</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Tab Content */}
        <TabsContent value="overview" className="space-y-4">
          <PartnerOverviewTab partner={partnerData} />
        </TabsContent>

        <TabsContent value="scopes" className="space-y-4">
          <PartnerScopesTab partner={partnerData} />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <PartnerSecurityTab partner={partnerData} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <PartnerActivityTab partner={partnerData} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <PartnerLogsTab partnerId={id} />
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <PartnerWebhooksTab partner={partnerData} />
        </TabsContent>

        <TabsContent value="webhook-logs" className="space-y-4">
          <PartnerWebhookLogsTab partnerId={id} />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <PartnerUsageTab partnerId={id} />
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <PartnerSLAMonitorTab partner={partnerData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
