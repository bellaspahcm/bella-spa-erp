/**
 * Tab Tổng Quan Đối Tác
 * 
 * Hiển thị:
 * - Thông tin cơ bản
 * - API Key management (show/hide, copy, regenerate)
 * - Thống kê nhanh
 * - Ghi chú
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Eye,
  EyeOff,
  Key,
  Calendar,
  Mail,
  Phone,
  FileText,
  Activity,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Globe,
  Code2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { APIPartner } from '@/types/api-gateway';
import { RateLimitCustomizationDialog } from '../RateLimitCustomizationDialog';
import { copyToClipboard } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PartnerOverviewTabProps {
  partner: APIPartner;
}

export function PartnerOverviewTab({ partner }: PartnerOverviewTabProps) {
  const router = useRouter();
  const [showApiKey, setShowApiKey] = useState(false);
  const [regenerateDialog, setRegenerateDialog] = useState(false);
  const [rateLimitDialog, setRateLimitDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Copy API key
  const handleCopyApiKey = async () => {
    const success = await copyToClipboard(partner.api_key);
    if (success) {
      toast.success('Đã sao chép API key');
    } else {
      toast.error('Không thể sao chép API key');
    }
  };

  // Regenerate API key
  const handleRegenerateKey = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/regenerate-key`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Không thể tạo lại API key');
      }

      const { data } = await response.json();

      toast.success(`API key mới đã được tạo cho ${partner.partner_name}`);
      toast.info(`Key mới: ${data.new_api_key}`, { duration: 10000 });

      // Refresh page
      router.refresh();
      setRegenerateDialog(false);
    } catch (error) {
      toast.error('Không thể tạo lại API key');
    } finally {
      setLoading(false);
    }
  };

  // Mask API key
  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  };

  // Copy text helper
  const handleCopyText = async (text: string, successMessage: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast.success(successMessage);
    } else {
      toast.error('Không thể sao chép');
    }
  };

  // Helper check scope
  const hasScope = (requiredScope: string) => {
    if (!partner.allowed_scopes) return false;
    
    // Check direct match
    if (partner.allowed_scopes.includes(requiredScope as any)) return true;
    
    // Check wildcard match (e.g., 'order:*' matches 'order:read', 'order:write')
    const [category] = requiredScope.split(':');
    if (partner.allowed_scopes.includes(`${category}:*` as any)) return true;
    
    // Check admin wildcard
    if (partner.allowed_scopes.includes('admin' as any)) return true;
    
    return false;
  };

  const displayKey = showApiKey ? partner.api_key : maskApiKey(partner.api_key);

  const curlCode = `curl -X GET https://bella-spa-erp.vercel.app/api/v1/orders \\
  -H "Authorization: Bearer ${displayKey}" \\
  -H "Content-Type: application/json"`;

  const jsCode = `fetch('https://bella-spa-erp.vercel.app/api/v1/orders', {
  headers: {
    'Authorization': 'Bearer ${displayKey}',
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(data => console.log(data));`;

  const pythonCode = `import requests

url = 'https://bella-spa-erp.vercel.app/api/v1/orders'
headers = {
    'Authorization': 'Bearer ${displayKey}',
    'Content-Type': 'application/json'
}

response = requests.get(url, headers=headers)
print(response.json())`;

  const commonEndpoints = [
    {
      method: 'GET',
      path: '/orders',
      scope: 'order:read',
      desc: 'Lấy danh sách đơn hàng của Spa',
    },
    {
      method: 'POST',
      path: '/orders',
      scope: 'order:write',
      desc: 'Tạo đơn hàng mới trên hệ thống',
    },
    {
      method: 'PATCH',
      path: '/orders/{id}/complete',
      scope: 'order:complete',
      desc: 'Đánh dấu hoàn thành đơn hàng',
    },
    {
      method: 'POST',
      path: '/payments',
      scope: 'payment:write',
      desc: 'Ghi nhận thanh toán hóa đơn',
    },
    {
      method: 'POST',
      path: '/pos/sync',
      scope: 'pos:sync',
      desc: 'Đồng bộ hóa dữ liệu với hệ thống POS',
    },
    {
      method: 'POST',
      path: '/webhooks',
      scope: 'webhook:subscribe',
      desc: 'Đăng ký nhận sự kiện webhook tự động',
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Thông Tin Cơ Bản */}
      <Card>
        <CardHeader>
          <CardTitle>Thông Tin Cơ Bản</CardTitle>
          <CardDescription>Chi tiết về đối tác API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Tên Đối Tác</p>
                <p className="text-base font-semibold">{partner.partner_name}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Loại Đối Tác</p>
                <Badge variant="outline" className="capitalize">
                  {partner.partner_type}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Môi Trường</p>
                <div>
                  {partner.is_sandbox ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                      🧪 Sandbox (Test)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-800">
                      🚀 Production
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Trạng Thái</p>
                <div className="flex items-center gap-2">
                  {partner.is_active ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">Hoạt Động</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-red-600 font-medium">Không Hoạt Động</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {partner.partner_description && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Mô Tả
                  </p>
                  <p className="text-sm">{partner.partner_description}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Quản Lý API Key
          </CardTitle>
          <CardDescription>Xem, sao chép và tái tạo API key</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded border font-mono">
                {showApiKey ? partner.api_key : maskApiKey(partner.api_key)}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Ẩn key' : 'Hiện key'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyApiKey}
                title="Sao chép"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>💡 Lưu ý:</strong> API key này được sử dụng để xác thực các request API. 
              Không chia sẻ key với bên thứ ba.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setRegenerateDialog(true)}
              disabled={loading}
            >
              <Key className="mr-2 h-4 w-4" />
              Tạo Lại API Key
            </Button>
            <p className="text-xs text-muted-foreground">
              ⚠️ Key cũ sẽ ngừng hoạt động ngay lập tức
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Thông Tin Liên Hệ */}
      <Card>
        <CardHeader>
          <CardTitle>Thông Tin Liên Hệ</CardTitle>
          <CardDescription>Liên hệ với đối tác</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {partner.contact_email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <a
                  href={`mailto:${partner.contact_email}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {partner.contact_email}
                </a>
              </div>
            </div>
          )}

          {partner.contact_phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Số Điện Thoại</p>
                <a
                  href={`tel:${partner.contact_phone}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {partner.contact_phone}
                </a>
              </div>
            </div>
          )}

          {!partner.contact_email && !partner.contact_phone && (
            <p className="text-sm text-muted-foreground italic">
              Chưa có thông tin liên hệ
            </p>
          )}
        </CardContent>
      </Card>

      {/* Thống Kê Nhanh */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Thống Kê Nhanh
          </CardTitle>
          <CardDescription>Tổng quan hoạt động</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tổng Requests</p>
              <p className="text-2xl font-bold">
                {partner.total_requests_count.toLocaleString('vi-VN')}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Requests Lỗi</p>
              <p className="text-2xl font-bold text-red-600">
                {partner.failed_requests_count.toLocaleString('vi-VN')}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Tỷ Lệ Lỗi</p>
            <p className="text-lg font-semibold">
              {partner.total_requests_count > 0
                ? ((partner.failed_requests_count / partner.total_requests_count) * 100).toFixed(2)
                : 0}
              %
            </p>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Request Cuối Cùng
            </p>
            <p className="text-sm">
              {partner.last_request_at ? (
                formatDistanceToNow(new Date(partner.last_request_at), {
                  addSuffix: true,
                  locale: vi,
                })
              ) : (
                <span className="text-muted-foreground italic">Chưa có request nào</span>
              )}
            </p>
          </div>

          {partner.last_error_at && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground text-red-600">Lỗi Cuối Cùng</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(partner.last_error_at), {
                    addSuffix: true,
                    locale: vi,
                  })}
                </p>
                {partner.last_error_message && (
                  <p className="text-xs bg-red-50 text-red-800 p-2 rounded mt-1">
                    {partner.last_error_message}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Ghi Chú & Metadata */}
      {(partner.notes || partner.metadata) && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Ghi Chú & Metadata</CardTitle>
            <CardDescription>Thông tin bổ sung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {partner.notes && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Ghi Chú Nội Bộ</p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{partner.notes}</p>
                </div>
              </div>
            )}

            {partner.metadata && Object.keys(partner.metadata).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Metadata</p>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(partner.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rate Limit Configuration */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Rate Limit Configuration
              </CardTitle>
              <CardDescription>Giới hạn API requests</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRateLimitDialog(true)}
            >
              <Key className="mr-2 h-4 w-4" />
              Tùy Chỉnh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tier</p>
              <Badge variant="outline" className="text-base capitalize">
                {partner.rate_limit_tier || 'basic'}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Per Minute</p>
              <p className="text-lg font-semibold">
                {partner.rate_limit_per_minute.toLocaleString('vi-VN')}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Per Day</p>
              <p className="text-lg font-semibold">
                {partner.rate_limit_per_day.toLocaleString('vi-VN')}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Burst Limit</p>
              <p className="text-lg font-semibold">
                {partner.rate_limit_burst.toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hướng Dẫn Tích Hợp API Endpoint */}
      <Card className="md:col-span-2 border-emerald-950/10 shadow-sm">
        <CardHeader className="bg-emerald-950/5 pb-4">
          <CardTitle className="flex items-center gap-2 text-emerald-950 font-serif">
            <Terminal className="h-5 w-5 text-emerald-800" />
            Hướng Dẫn Tích Hợp API Endpoint
          </CardTitle>
          <CardDescription>
            Tài liệu hướng dẫn kết nối chi tiết và code ví dụ thử nghiệm dành cho đối tác {partner.partner_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-800" />
                Thông Tin Kết Nối
              </h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1">MÔI TRƯỜNG</span>
                  {partner.is_sandbox ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                      🧪 Sandbox (Môi trường Test)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                      🚀 Production (Môi trường Live)
                    </Badge>
                  )}
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1">BASE URL API</span>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200 font-mono text-xs text-slate-800">
                    <span className="flex-1 overflow-x-auto whitespace-nowrap">https://bella-spa-erp.vercel.app/api/v1</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopyText('https://bella-spa-erp.vercel.app/api/v1', 'Đã sao chép Base URL')}
                      title="Sao chép"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1">PHƯƠNG THỨC XÁC THỰC</span>
                  <p className="text-xs text-slate-600 mb-1 leading-relaxed">
                    Sử dụng Bearer Token trong Header <code className="bg-slate-100 px-1 py-0.5 rounded text-red-600 font-mono">Authorization</code>:
                  </p>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200 font-mono text-xs text-slate-800">
                    <span className="flex-1 overflow-x-auto whitespace-nowrap">Authorization: Bearer {displayKey}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopyText(`Authorization: Bearer ${partner.api_key}`, 'Đã sao chép Authorization Header')}
                      title="Sao chép"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    * Bật nút hiển thị API Key phía trên để điền tự động giá trị thực của khóa vào mã nguồn bên dưới.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-800" />
                Mẫu Code Ví Dụ (GET /orders)
              </h3>
              
              <Tabs defaultValue="curl" className="w-full">
                <TabsList className="w-full grid grid-cols-3 bg-slate-100 p-0.5 rounded-lg border border-slate-200 h-9">
                  <TabsTrigger value="curl" className="py-1">cURL</TabsTrigger>
                  <TabsTrigger value="javascript" className="py-1">JavaScript</TabsTrigger>
                  <TabsTrigger value="python" className="py-1">Python</TabsTrigger>
                </TabsList>
                
                <TabsContent value="curl" className="mt-2 relative">
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre pr-10 min-h-[100px]">
                    {curlCode}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-200 h-7 w-7"
                    onClick={() => handleCopyText(curlCode, 'Đã sao chép mã cURL')}
                    title="Sao chép mã"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TabsContent>
                
                <TabsContent value="javascript" className="mt-2 relative">
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre pr-10 min-h-[100px]">
                    {jsCode}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-200 h-7 w-7"
                    onClick={() => handleCopyText(jsCode, 'Đã sao chép mã JavaScript')}
                    title="Sao chép mã"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TabsContent>
                
                <TabsContent value="python" className="mt-2 relative">
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre pr-10 min-h-[100px]">
                    {pythonCode}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-200 h-7 w-7"
                    onClick={() => handleCopyText(pythonCode, 'Đã sao chép mã Python')}
                    title="Sao chép mã"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-800" />
              Tra Cứu Endpoint & Trạng Thái Quyền Hạn
            </h3>
            
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                  <tr>
                    <th scope="col" className="px-4 py-3">Phương thức</th>
                    <th scope="col" className="px-4 py-3">Endpoint Path</th>
                    <th scope="col" className="px-4 py-3">Quyền yêu cầu (Scope)</th>
                    <th scope="col" className="px-4 py-3">Trạng thái quyền lực</th>
                    <th scope="col" className="px-4 py-3 hidden md:table-cell">Mô tả</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {commonEndpoints.map((ep, idx) => {
                    const allowed = hasScope(ep.scope);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            ep.method === 'GET' ? 'bg-green-100 text-green-800' :
                            ep.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                            ep.method === 'PATCH' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {ep.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-800">{ep.path}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{ep.scope}</td>
                        <td className="px-4 py-3">
                          {allowed ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold py-0">
                              ✓ Được phép
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold py-0">
                              ✗ Chưa cấp
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{ep.desc}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regenerate Key Dialog */}
      <AlertDialog open={regenerateDialog} onOpenChange={setRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tạo Lại API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn tạo lại API key cho <strong>{partner.partner_name}</strong>?
              <br />
              <br />
              <span className="text-red-600 font-semibold">
                ⚠️ API key hiện tại sẽ ngừng hoạt động ngay lập tức.
              </span>
              <br />
              Đối tác sẽ cần cập nhật key mới trong hệ thống của họ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateKey} disabled={loading}>
              {loading ? 'Đang tạo...' : 'Tạo Lại Key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rate Limit Customization Dialog */}
      <RateLimitCustomizationDialog
        partner={partner}
        open={rateLimitDialog}
        onOpenChange={setRateLimitDialog}
      />
    </div>
  );
}
