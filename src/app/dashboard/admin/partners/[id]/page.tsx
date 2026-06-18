/**
 * Trang Chi Tiết Đối Tác
 * 
 * Hiển thị thông tin đầy đủ về một đối tác API với 8 tabs:
 * - Overview: Thông tin tổng quan
 * - Scopes: Quản lý phân quyền
 * - Security: API Key Rotation & Security Settings
 * - Activity: Timeline hoạt động real-time
 * - Logs: Nhật ký request
 * - Webhooks: Cấu hình webhook
 * - Webhook Logs: Nhật ký webhook delivery
 * - Usage: Thống kê sử dụng
 */

import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase-server';
import type { APIPartner } from '@/types/api-gateway';

// Tab Components
import { PartnerOverviewTab } from '@/components/admin/partners/detail-tabs/PartnerOverviewTab';
import { PartnerScopesTab } from '@/components/admin/partners/detail-tabs/PartnerScopesTab';
import { PartnerLogsTab } from '@/components/admin/partners/detail-tabs/PartnerLogsTab';
import { PartnerWebhooksTab } from '@/components/admin/partners/detail-tabs/PartnerWebhooksTab';
import { PartnerUsageTab } from '@/components/admin/partners/detail-tabs/PartnerUsageTab';
import { PartnerWebhookLogsTab } from '@/components/admin/partners/detail-tabs/PartnerWebhookLogsTab';
import { PartnerSecurityTab } from '@/components/admin/partners/detail-tabs/PartnerSecurityTab';
import { PartnerActivityTab } from '@/components/admin/partners/detail-tabs/PartnerActivityTab';

export const metadata: Metadata = {
  title: 'Chi Tiết Đối Tác | Admin',
  description: 'Xem và quản lý thông tin đối tác API',
};

interface PartnerDetailPageProps {
  params: {
    id: string;
  };
  searchParams: {
    tab?: string;
  };
}

export default async function PartnerDetailPage({
  params,
  searchParams,
}: PartnerDetailPageProps) {
  const { id } = params;
  const activeTab = searchParams.tab || 'overview';

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

  // Lấy thông tin đối tác
  const { data: partner, error } = await (supabase as any)
    .from('api_partners')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id) // Security: chỉ lấy partner của tenant này
    .single();

  if (error || !partner) {
    notFound();
  }

  const partnerData = partner as APIPartner;

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/partners">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {partnerData.partner_name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {partnerData.partner_type.toUpperCase()} • {partnerData.is_sandbox ? 'Sandbox' : 'Production'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href={`/admin/partners/${id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Chỉnh Sửa
            </Button>
          </Link>
          <Button variant="outline" className="text-red-600 hover:text-red-700">
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={activeTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Tổng Quan</TabsTrigger>
          <TabsTrigger value="scopes">Phân Quyền</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="logs">Nhật Ký</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="webhook-logs">Webhook Logs</TabsTrigger>
          <TabsTrigger value="usage">Thống Kê</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
