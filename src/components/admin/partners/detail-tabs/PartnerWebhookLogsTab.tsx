/**
 * Tab Webhook Logs với Retry Mechanism
 * 
 * Features:
 * - Hiển thị tất cả webhook delivery attempts
 * - Retry individual failed webhooks
 * - Batch retry multiple webhooks
 * - Auto-retry configuration
 * - Delivery status tracking với timestamps
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Filter,
  Download,
  Settings,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface PartnerWebhookLogsTabProps {
  partnerId: string;
}

interface WebhookLog {
  id: string;
  partner_id: string;
  event_type: string;
  webhook_url: string;
  request_payload: unknown;
  request_headers: Record<string, string>;
  response_status: number | null;
  response_body: unknown;
  response_time_ms: number | null;
  attempt_number: number;
  max_attempts: number;
  is_success: boolean;
  error_message: string | null;
  next_retry_at: string | null;
  created_at: string;
  delivered_at: string | null;
}

interface RetryConfig {
  enabled: boolean;
  max_attempts: number;
  retry_delay_seconds: number;
  backoff_multiplier: number;
}

export function PartnerWebhookLogsTab({ partnerId }: PartnerWebhookLogsTabProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryConfig, setRetryConfig] = useState<RetryConfig>({
    enabled: true,
    max_attempts: 3,
    retry_delay_seconds: 60,
    backoff_multiplier: 2,
  });
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [selectedLogDetails, setSelectedLogDetails] = useState<WebhookLog | null>(null);

  // Fetch webhook logs
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/webhook-logs`);

      if (!response.ok) {
        throw new Error('Không thể tải webhook logs');
      }

      const data = await response.json();
      setLogs(data.data || []);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
      toast.error('Không thể tải webhook logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [partnerId]);

  // Retry single webhook
  const retryWebhook = async (logId: string) => {
    setRetryingLogId(logId);
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/webhook-logs/${logId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Không thể retry webhook');
      }

      toast.success('Đã gửi lại webhook thành công!');
      await fetchLogs();
    } catch (error) {
      console.error('Error retrying webhook:', error);
      toast.error('Không thể retry webhook');
    } finally {
      setRetryingLogId(null);
    }
  };

  // Batch retry selected webhooks
  const batchRetry = async () => {
    if (selectedLogs.length === 0) {
      toast.error('Vui lòng chọn ít nhất một webhook để retry');
      return;
    }

    setShowRetryDialog(false);
    const toastId = toast.loading(`Đang retry ${selectedLogs.length} webhooks...`);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/webhook-logs/batch-retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_ids: selectedLogs }),
      });

      if (!response.ok) {
        throw new Error('Không thể batch retry webhooks');
      }

      const data = await response.json();
      toast.success(`Đã retry thành công ${data.success_count}/${selectedLogs.length} webhooks`, {
        id: toastId,
      });
      setSelectedLogs([]);
      await fetchLogs();
    } catch (error) {
      console.error('Error batch retrying webhooks:', error);
      toast.error('Không thể batch retry webhooks', { id: toastId });
    }
  };

  // Save retry config
  const saveRetryConfig = async () => {
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/webhook-retry-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryConfig),
      });

      if (!response.ok) {
        throw new Error('Không thể lưu cấu hình');
      }

      toast.success('Đã lưu cấu hình retry thành công!');
      setShowConfigDialog(false);
    } catch (error) {
      console.error('Error saving retry config:', error);
      toast.error('Không thể lưu cấu hình retry');
    }
  };

  // Export logs to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    const headers = [
      'Event Type',
      'Status',
      'Attempt',
      'Response Status',
      'Response Time (ms)',
      'Error Message',
      'Created At',
      'Delivered At',
    ];

    const rows = filteredLogs.map((log) => [
      log.event_type,
      log.is_success ? 'Success' : log.next_retry_at ? 'Pending Retry' : 'Failed',
      `${log.attempt_number}/${log.max_attempts}`,
      log.response_status || 'N/A',
      log.response_time_ms || 'N/A',
      log.error_message || '',
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.delivered_at ? format(new Date(log.delivered_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-logs-${partnerId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Đã xuất webhook logs');
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'success' && !log.is_success) return false;
      if (filterStatus === 'failed' && (log.is_success || log.next_retry_at)) return false;
      if (filterStatus === 'pending' && (!log.next_retry_at || log.is_success)) return false;
    }

    // Event filter
    if (filterEvent !== 'all' && log.event_type !== filterEvent) return false;

    // Search filter
    if (searchQuery && !log.event_type.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Get unique event types
  const eventTypes = Array.from(new Set(logs.map((log) => log.event_type)));

  // Stats
  const stats = {
    total: logs.length,
    success: logs.filter((log) => log.is_success).length,
    failed: logs.filter((log) => !log.is_success && !log.next_retry_at).length,
    pending: logs.filter((log) => log.next_retry_at && !log.is_success).length,
  };

  // Toggle selection
  const toggleSelect = (logId: string) => {
    setSelectedLogs((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLogs.length === filteredLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(filteredLogs.map((log) => log.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Thành Công
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Thất Bại
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Đang Chờ Retry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterStatus}
            onValueChange={(value: string | null) =>
              value && setFilterStatus(value as 'all' | 'success' | 'failed' | 'pending')
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="success">Thành công</SelectItem>
              <SelectItem value="failed">Thất bại</SelectItem>
              <SelectItem value="pending">Chờ retry</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterEvent} onValueChange={(value: string | null) => value && setFilterEvent(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả events</SelectItem>
              {eventTypes.map((event) => (
                <SelectItem key={event} value={event}>
                  {event}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Tìm kiếm event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px]"
          />
        </div>

        <div className="flex items-center gap-2">
          {selectedLogs.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowRetryDialog(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry ({selectedLogs.length})
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Xuất CSV
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowConfigDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Cấu hình Retry
          </Button>

          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Delivery Logs</CardTitle>
          <CardDescription>
            Lịch sử gửi webhook và trạng thái delivery ({filteredLogs.length} logs)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="space-y-2">
              {/* Select All */}
              <div className="flex items-center gap-2 p-2 border-b">
                <Checkbox
                  checked={selectedLogs.length === filteredLogs.length && filteredLogs.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">Chọn tất cả</span>
              </div>

              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedLogs.includes(log.id)}
                    onCheckedChange={() => toggleSelect(log.id)}
                  />

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.is_success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : log.next_retry_at ? (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">{log.event_type}</span>
                        <Badge variant="outline">
                          Lần thử {log.attempt_number}/{log.max_attempts}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        {log.response_status && (
                          <Badge
                            variant={
                              log.response_status >= 200 && log.response_status < 300
                                ? 'default'
                                : 'destructive'
                            }
                          >
                            {log.response_status}
                          </Badge>
                        )}
                        {!log.is_success && log.attempt_number < log.max_attempts && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryWebhook(log.id)}
                            disabled={retryingLogId === log.id}
                          >
                            {retryingLogId === log.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLogDetails(log)}
                        >
                          Chi tiết
                        </Button>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>URL: {log.webhook_url}</div>
                      {log.response_time_ms && (
                        <div>Response time: {log.response_time_ms}ms</div>
                      )}
                      {log.error_message && (
                        <div className="text-red-600 flex items-start gap-1">
                          <AlertTriangle className="h-4 w-4 mt-0.5" />
                          <span>{log.error_message}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <span>
                          Tạo lúc: {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                        </span>
                        {log.delivered_at && (
                          <span>
                            Delivered: {format(new Date(log.delivered_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                          </span>
                        )}
                        {log.next_retry_at && (
                          <span className="text-yellow-600">
                            Retry lúc: {format(new Date(log.next_retry_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Send className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Chưa có webhook logs</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Webhook logs sẽ xuất hiện ở đây khi có events được gửi
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retry Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cấu Hình Auto-Retry</DialogTitle>
            <DialogDescription>
              Thiết lập chính sách retry tự động cho failed webhooks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Bật Auto-Retry</Label>
              <Checkbox
                checked={retryConfig.enabled}
                onCheckedChange={(checked) =>
                  setRetryConfig({ ...retryConfig, enabled: checked as boolean })
                }
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Số lần thử tối đa</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={retryConfig.max_attempts}
                onChange={(e) =>
                  setRetryConfig({ ...retryConfig, max_attempts: parseInt(e.target.value) || 3 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Số lần hệ thống sẽ thử gửi lại webhook khi thất bại
              </p>
            </div>

            <div className="space-y-2">
              <Label>Delay giữa các lần retry (giây)</Label>
              <Input
                type="number"
                min={10}
                max={3600}
                value={retryConfig.retry_delay_seconds}
                onChange={(e) =>
                  setRetryConfig({
                    ...retryConfig,
                    retry_delay_seconds: parseInt(e.target.value) || 60,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Thời gian chờ trước khi retry lần đầu tiên
              </p>
            </div>

            <div className="space-y-2">
              <Label>Backoff Multiplier</Label>
              <Input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={retryConfig.backoff_multiplier}
                onChange={(e) =>
                  setRetryConfig({
                    ...retryConfig,
                    backoff_multiplier: parseFloat(e.target.value) || 2,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Hệ số nhân delay sau mỗi lần retry (exponential backoff)
              </p>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Ví dụ retry schedule:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Lần 1: Sau {retryConfig.retry_delay_seconds}s</li>
                <li>
                  • Lần 2: Sau{' '}
                  {retryConfig.retry_delay_seconds * retryConfig.backoff_multiplier}s
                </li>
                <li>
                  • Lần 3: Sau{' '}
                  {retryConfig.retry_delay_seconds *
                    Math.pow(retryConfig.backoff_multiplier, 2)}
                  s
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Hủy
            </Button>
            <Button onClick={saveRetryConfig}>
              <Settings className="h-4 w-4 mr-2" />
              Lưu Cấu Hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Retry Confirmation */}
      <Dialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác Nhận Batch Retry</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn retry {selectedLogs.length} webhooks đã chọn?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Hệ thống sẽ gửi lại tất cả {selectedLogs.length} webhooks đã chọn. Quá trình này có
              thể mất vài phút.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetryDialog(false)}>
              Hủy
            </Button>
            <Button onClick={batchRetry}>
              <Play className="h-4 w-4 mr-2" />
              Retry Ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Details Dialog */}
      {selectedLogDetails && (
        <Dialog open={!!selectedLogDetails} onOpenChange={() => setSelectedLogDetails(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Chi Tiết Webhook Log</DialogTitle>
              <DialogDescription>{selectedLogDetails.event_type}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Request Payload:</h4>
                <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedLogDetails.request_payload, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">Request Headers:</h4>
                <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedLogDetails.request_headers, null, 2)}
                </pre>
              </div>

              {selectedLogDetails.response_body && (
                <div>
                  <h4 className="font-medium mb-2">Response Body:</h4>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLogDetails.response_body, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLogDetails.error_message && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Error Message:</h4>
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    {selectedLogDetails.error_message}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLogDetails(null)}>
                Đóng
              </Button>
              {!selectedLogDetails.is_success &&
                selectedLogDetails.attempt_number < selectedLogDetails.max_attempts && (
                  <Button
                    onClick={() => {
                      retryWebhook(selectedLogDetails.id);
                      setSelectedLogDetails(null);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Webhook
                  </Button>
                )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
