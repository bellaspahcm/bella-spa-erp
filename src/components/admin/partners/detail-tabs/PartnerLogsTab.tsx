/**
 * Tab Nhật Ký Request (Logs)
 * 
 * Hiển thị lịch sử API requests:
 * - Table với filters (method, status code, date range)
 * - Pagination
 * - Chi tiết request/response
 * - Export logs
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, RefreshCw, Eye, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { APIRequestLog, HTTPMethod } from '@/types/api-gateway';

interface PartnerLogsTabProps {
  partnerId: string;
}

interface LogsResponse {
  data: APIRequestLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export function PartnerLogsTab({ partnerId }: PartnerLogsTabProps) {
  const [logs, setLogs] = useState<APIRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<APIRequestLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | HTTPMethod>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false,
  });

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        partner_id: partnerId,
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      if (search) params.set('search', search);
      if (methodFilter !== 'all') params.set('method', methodFilter);
      if (statusFilter === 'success') params.set('is_error', 'false');
      if (statusFilter === 'error') params.set('is_error', 'true');

      const response = await fetch(`/api/admin/partners/logs?${params}`);
      
      if (!response.ok) {
        throw new Error('Không thể tải logs');
      }

      const data: LogsResponse = await response.json();
      setLogs(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Không thể tải nhật ký request');
    } finally {
      setLoading(false);
    }
  }, [partnerId, pagination.limit, pagination.offset, search, methodFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handlers
  const handleViewDetails = (log: APIRequestLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        partner_id: partnerId,
        format: 'csv',
      });

      const response = await fetch(`/api/admin/partners/logs/export?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partner-${partnerId}-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Đã xuất nhật ký thành công');
    } catch (error) {
      toast.error('Không thể xuất nhật ký');
    }
  };

  const handlePageChange = (newOffset: number) => {
    setPagination((prev) => ({ ...prev, offset: newOffset }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Get status badge
  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge className="bg-green-100 text-green-800">{statusCode}</Badge>;
    } else if (statusCode >= 400 && statusCode < 500) {
      return <Badge className="bg-yellow-100 text-yellow-800">{statusCode}</Badge>;
    } else if (statusCode >= 500) {
      return <Badge className="bg-red-100 text-red-800">{statusCode}</Badge>;
    }
    return <Badge variant="outline">{statusCode}</Badge>;
  };

  // Get method badge color
  const getMethodBadge = (method: HTTPMethod) => {
    const colors: Record<HTTPMethod, string> = {
      GET: 'bg-blue-100 text-blue-800',
      POST: 'bg-green-100 text-green-800',
      PUT: 'bg-yellow-100 text-yellow-800',
      PATCH: 'bg-orange-100 text-orange-800',
      DELETE: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[method]}>{method}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bộ Lọc & Tìm Kiếm</CardTitle>
          <CardDescription>Lọc nhật ký theo tiêu chí</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm endpoint..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Method Filter */}
            <Select
              value={methodFilter}
              onValueChange={(value: string | null) => value && setMethodFilter(value as 'all' | HTTPMethod)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value: string | null) => value && setStatusFilter(value as 'all' | 'success' | 'error')}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="success">Thành công</SelectItem>
                <SelectItem value="error">Lỗi</SelectItem>
              </SelectContent>
            </Select>

            {/* Actions */}
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Xuất CSV
            </Button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Hiển thị {logs.length} / {pagination.total} requests
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Nhật Ký Requests</CardTitle>
          <CardDescription>Lịch sử các API requests gần đây</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Chưa có nhật ký</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Chưa có request nào được ghi nhận
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời Gian</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: vi })}
                      </TableCell>
                      <TableCell>{getMethodBadge(log.method)}</TableCell>
                      <TableCell className="font-mono text-sm max-w-[300px] truncate">
                        {log.endpoint}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status_code)}</TableCell>
                      <TableCell>
                        <span
                          className={`text-sm ${
                            log.response_time_ms > 1000
                              ? 'text-red-600 font-semibold'
                              : log.response_time_ms > 500
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {log.response_time_ms}ms
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Trang {Math.floor(pagination.offset / pagination.limit) + 1} /{' '}
                {Math.ceil(pagination.total / pagination.limit)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.offset - pagination.limit)}
                  disabled={pagination.offset === 0}
                >
                  Trước
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                  disabled={!pagination.has_more}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <AlertDialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Chi Tiết Request</AlertDialogTitle>
            <AlertDialogDescription>
              Thông tin đầy đủ về request và response
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Method</p>
                  {getMethodBadge(selectedLog.method)}
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Status Code</p>
                  {getStatusBadge(selectedLog.status_code)}
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Response Time</p>
                  <p className="text-sm">{selectedLog.response_time_ms}ms</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Timestamp</p>
                  <p className="text-sm font-mono">
                    {format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                  </p>
                </div>
              </div>

              {/* Endpoint */}
              <div>
                <p className="text-sm font-medium mb-1">Endpoint</p>
                <code className="text-sm bg-muted px-3 py-2 rounded block break-all">
                  {selectedLog.endpoint}
                </code>
              </div>

              {/* Query Params */}
              {selectedLog.query_params && Object.keys(selectedLog.query_params).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Query Parameters</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.query_params, null, 2)}
                  </pre>
                </div>
              )}

              {/* Request Headers */}
              {selectedLog.request_headers && (
                <div>
                  <p className="text-sm font-medium mb-1">Request Headers</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.request_headers, null, 2)}
                  </pre>
                </div>
              )}

              {/* Request Body */}
              {selectedLog.request_body && (
                <div>
                  <p className="text-sm font-medium mb-1">Request Body</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.request_body, null, 2)}
                  </pre>
                </div>
              )}

              {/* Response Body */}
              {selectedLog.response_body && (
                <div>
                  <p className="text-sm font-medium mb-1">Response Body</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.response_body, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Details */}
              {selectedLog.is_error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900 mb-2">Error Details</p>
                  {selectedLog.error_code && (
                    <p className="text-sm text-red-800 mb-1">
                      <strong>Code:</strong> {selectedLog.error_code}
                    </p>
                  )}
                  {selectedLog.error_message && (
                    <p className="text-sm text-red-800 mb-1">
                      <strong>Message:</strong> {selectedLog.error_message}
                    </p>
                  )}
                  {selectedLog.error_stack && (
                    <pre className="text-xs bg-red-100 p-2 rounded mt-2 overflow-x-auto">
                      {selectedLog.error_stack}
                    </pre>
                  )}
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedLog.ip_address && (
                  <div>
                    <p className="font-medium">IP Address</p>
                    <p className="text-muted-foreground">{selectedLog.ip_address}</p>
                  </div>
                )}
                {selectedLog.user_agent && (
                  <div>
                    <p className="font-medium">User Agent</p>
                    <p className="text-muted-foreground truncate" title={selectedLog.user_agent}>
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}
                {selectedLog.request_id && (
                  <div>
                    <p className="font-medium">Request ID</p>
                    <p className="text-muted-foreground font-mono text-xs">{selectedLog.request_id}</p>
                  </div>
                )}
                {selectedLog.idempotency_key && (
                  <div>
                    <p className="font-medium">Idempotency Key</p>
                    <p className="text-muted-foreground font-mono text-xs">{selectedLog.idempotency_key}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Đóng</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
