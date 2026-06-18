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

interface PartnerOverviewTabProps {
  partner: APIPartner;
}

export function PartnerOverviewTab({ partner }: PartnerOverviewTabProps) {
  const router = useRouter();
  const [showApiKey, setShowApiKey] = useState(false);
  const [regenerateDialog, setRegenerateDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Copy API key
  const handleCopyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(partner.api_key);
      toast.success('Đã sao chép API key');
    } catch (error) {
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
    </div>
  );
}
