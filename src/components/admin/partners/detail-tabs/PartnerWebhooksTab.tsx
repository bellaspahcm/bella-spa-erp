/**
 * Tab Quản Lý Webhooks
 * 
 * Hiển thị và cấu hình webhooks:
 * - Webhook URL và secret
 * - Danh sách events đã đăng ký
 * - Test webhook
 * - Webhook delivery logs (nếu có)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Webhook, 
  Link as LinkIcon, 
  Key, 
  Check, 
  AlertCircle, 
  Send,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { APIPartner } from '@/types/api-gateway';

interface PartnerWebhooksTabProps {
  partner: APIPartner;
}

const AVAILABLE_EVENTS = [
  { value: 'order.created', label: 'Đơn Hàng Tạo', description: 'Khi có đơn hàng mới' },
  { value: 'order.updated', label: 'Đơn Hàng Cập Nhật', description: 'Khi đơn hàng được cập nhật' },
  { value: 'order.completed', label: 'Đơn Hàng Hoàn Tất', description: 'Khi đơn hàng hoàn thành' },
  { value: 'order.cancelled', label: 'Đơn Hàng Hủy', description: 'Khi đơn hàng bị hủy' },
  { value: 'payment.received', label: 'Thanh Toán Nhận', description: 'Khi nhận được thanh toán' },
  { value: 'payment.refunded', label: 'Thanh Toán Hoàn', description: 'Khi hoàn tiền' },
  { value: 'invoice.created', label: 'Hóa Đơn Tạo', description: 'Khi tạo hóa đơn mới' },
  { value: 'invoice.cancelled', label: 'Hóa Đơn Hủy', description: 'Khi hủy hóa đơn' },
];

export function PartnerWebhooksTab({ partner }: PartnerWebhooksTabProps) {
  const router = useRouter();
  
  // State
  const [webhookUrl, setWebhookUrl] = useState(partner.webhook_url || '');
  const [webhookSecret, setWebhookSecret] = useState(partner.webhook_secret || '');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(partner.webhook_events || []);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    statusCode?: number;
    responseTime?: number;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Toggle event
  const toggleEvent = (event: string) => {
    const newEvents = selectedEvents.includes(event)
      ? selectedEvents.filter((e) => e !== event)
      : [...selectedEvents, event];

    setSelectedEvents(newEvents);
    checkForChanges(webhookUrl, webhookSecret, newEvents);
  };

  // Check for changes
  const checkForChanges = (url: string, secret: string, events: string[]) => {
    const changed =
      url !== (partner.webhook_url || '') ||
      secret !== (partner.webhook_secret || '') ||
      JSON.stringify(events.sort()) !== JSON.stringify((partner.webhook_events || []).sort());
    
    setHasChanges(changed);
  };

  // Handle URL change
  const handleUrlChange = (value: string) => {
    setWebhookUrl(value);
    checkForChanges(value, webhookSecret, selectedEvents);
  };

  // Handle Secret change
  const handleSecretChange = (value: string) => {
    setWebhookSecret(value);
    checkForChanges(webhookUrl, value, selectedEvents);
  };

  // Save webhook configuration
  const handleSave = async () => {
    // Validation
    if (webhookUrl && !webhookUrl.startsWith('https://')) {
      toast.error('Webhook URL phải sử dụng HTTPS');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: webhookUrl || null,
          webhook_secret: webhookSecret || null,
          webhook_events: selectedEvents.length > 0 ? selectedEvents : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể cập nhật webhook');
      }

      toast.success('Đã cập nhật cấu hình webhook');
      setHasChanges(false);
      router.refresh();
    } catch (error) {
      toast.error('Không thể cập nhật cấu hình webhook');
    } finally {
      setLoading(false);
    }
  };

  // Reset changes
  const handleReset = () => {
    setWebhookUrl(partner.webhook_url || '');
    setWebhookSecret(partner.webhook_secret || '');
    setSelectedEvents(partner.webhook_events || []);
    setHasChanges(false);
    toast.info('Đã khôi phục cấu hình ban đầu');
  };

  // Test webhook
  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error('Vui lòng nhập Webhook URL');
      return;
    }

    if (!webhookUrl.startsWith('https://')) {
      toast.error('Webhook URL phải sử dụng HTTPS');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const startTime = Date.now();
      
      const response = await fetch(`/api/admin/partners/${partner.id}/test-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          webhook_secret: webhookSecret,
        }),
      });

      const endTime = Date.now();
      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: 'Webhook test thành công! Endpoint phản hồi đúng.',
          statusCode: data.statusCode,
          responseTime: endTime - startTime,
        });
        toast.success('Webhook test thành công');
      } else {
        setTestResult({
          success: false,
          message: data.error?.message || 'Webhook test thất bại',
          statusCode: data.statusCode,
          responseTime: endTime - startTime,
        });
        toast.error('Webhook test thất bại');
      }
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: error.message || 'Không thể kết nối với webhook endpoint',
      });
      toast.error('Không thể test webhook');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">Có thay đổi chưa lưu</p>
                <p className="text-sm text-blue-700">
                  Webhook configuration đã được thay đổi
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} disabled={loading}>
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Cấu Hình Webhook
          </CardTitle>
          <CardDescription>
            Thiết lập endpoint để nhận thông báo real-time về các sự kiện
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhook_url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Webhook URL
            </Label>
            <Input
              id="webhook_url"
              type="url"
              placeholder="https://your-domain.com/webhooks/bella"
              value={webhookUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUrlChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              HTTPS endpoint nơi webhook events sẽ được gửi đến
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label htmlFor="webhook_secret" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Webhook Secret
            </Label>
            <Input
              id="webhook_secret"
              type="text"
              placeholder="whsec_..."
              value={webhookSecret}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSecretChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Secret key để verify webhook signature (khuyến nghị)
            </p>
          </div>

          {/* Test Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!webhookUrl || testing}
            >
              <Send className="mr-2 h-4 w-4" />
              {testing ? 'Đang test...' : 'Test Webhook'}
            </Button>

            {testResult && (
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Thành công
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">
                    <XCircle className="mr-1 h-3 w-3" />
                    Thất bại
                  </Badge>
                )}
                {testResult.responseTime && (
                  <Badge variant="outline">
                    <Clock className="mr-1 h-3 w-3" />
                    {testResult.responseTime}ms
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Test Result Details */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <p
                className={`text-sm ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {testResult.message}
              </p>
              {testResult.statusCode && (
                <p className="text-xs text-muted-foreground mt-1">
                  Status Code: {testResult.statusCode}
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>💡 Lưu ý:</strong> Webhook endpoint phải:
            </p>
            <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
              <li>Sử dụng HTTPS (không chấp nhận HTTP)</li>
              <li>Phản hồi với status code 200-299 trong vòng 5 giây</li>
              <li>Verify webhook signature nếu có secret</li>
              <li>Xử lý idempotent (có thể nhận cùng event nhiều lần)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Event Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Đăng Ký Sự Kiện</CardTitle>
          <CardDescription>
            Chọn các sự kiện mà webhook sẽ nhận thông báo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Event List */}
            <div className="grid gap-2">
              {AVAILABLE_EVENTS.map((event) => {
                const isSelected = selectedEvents.includes(event.value);

                return (
                  <button
                    key={event.value}
                    onClick={() => toggleEvent(event.value)}
                    className={`flex items-start gap-3 p-3 border rounded-lg hover:border-primary transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center h-5 w-5 rounded border-2 ${
                        isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{event.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.description}
                      </p>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                        {event.value}
                      </code>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">
                Tổng kết: {selectedEvents.length} sự kiện được chọn
              </p>
              {selectedEvents.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedEvents.map((event) => (
                    <Badge key={event} variant="secondary" className="text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Chưa chọn sự kiện nào
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Payload Example */}
      <Card>
        <CardHeader>
          <CardTitle>Ví Dụ Webhook Payload</CardTitle>
          <CardDescription>
            Cấu trúc JSON mà webhook endpoint sẽ nhận được
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
{`{
  "event": "order.created",
  "timestamp": "2026-06-18T14:30:00Z",
  "data": {
    "id": "ord_abc123",
    "customer_id": "cus_xyz789",
    "total_amount": 500000,
    "status": "pending",
    "items": [
      {
        "service_id": "srv_123",
        "service_name": "Chăm Sóc Sau Sinh",
        "quantity": 1,
        "price": 500000
      }
    ]
  },
  "metadata": {
    "partner_id": "${partner.id}",
    "tenant_id": "${partner.tenant_id}",
    "request_id": "req_def456"
  }
}`}
          </pre>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>🔐 Webhook Signature Verification:</strong>
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Mỗi webhook request sẽ có header <code className="bg-yellow-100 px-1">X-Webhook-Signature</code> 
              {' '}chứa HMAC-SHA256 hash của payload. Sử dụng webhook secret để verify tính xác thực.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Configuration Summary */}
      {(partner.webhook_url || partner.webhook_events?.length) && (
        <Card>
          <CardHeader>
            <CardTitle>Cấu Hình Hiện Tại</CardTitle>
            <CardDescription>Thiết lập webhook đang hoạt động</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {partner.webhook_url && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">URL</p>
                <code className="text-sm bg-muted px-2 py-1 rounded block break-all">
                  {partner.webhook_url}
                </code>
              </div>
            )}

            {partner.webhook_secret && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Secret</p>
                <code className="text-sm bg-muted px-2 py-1 rounded">••••••••</code>
              </div>
            )}

            {partner.webhook_events && partner.webhook_events.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Events</p>
                <div className="flex flex-wrap gap-1">
                  {partner.webhook_events.map((event) => (
                    <Badge key={event} variant="secondary">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
