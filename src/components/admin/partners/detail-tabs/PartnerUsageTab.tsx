/**
 * Tab Thống Kê Sử Dụng API
 * 
 * Hiển thị:
 * - Request count over time (7 ngày, 30 ngày)
 * - Error rate
 * - Average response time
 * - Rate limit status
 * - Top endpoints
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';

interface PartnerUsageTabProps {
  partnerId: string;
}

interface UsageStats {
  total_requests: number;
  error_requests: number;
  error_rate: number;
  avg_response_time: number;
  p95_response_time: number;
  requests_by_day: Array<{
    date: string;
    count: number;
    errors: number;
  }>;
  top_endpoints: Array<{
    endpoint: string;
    count: number;
    avg_time: number;
  }>;
  rate_limit_status: {
    limit_per_minute: number;
    limit_per_day: number;
    current_usage_minute: number;
    current_usage_day: number;
  };
}

export function PartnerUsageTab({ partnerId }: PartnerUsageTabProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  // Fetch usage stats
  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/partners/${partnerId}/usage?range=${timeRange}`
      );

      if (!response.ok) {
        throw new Error('Không thể tải thống kê');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Không thể tải thống kê sử dụng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  // Calculate percentage
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  // Get trend indicator
  const getTrendIndicator = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    
    if (Math.abs(change) < 1) return null;
    
    return change > 0 ? (
      <div className="flex items-center gap-1 text-green-600 text-sm">
        <TrendingUp className="h-4 w-4" />
        <span>+{change.toFixed(1)}%</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-red-600 text-sm">
        <TrendingDown className="h-4 w-4" />
        <span>{change.toFixed(1)}%</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Chưa có dữ liệu</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Chưa có dữ liệu thống kê để hiển thị
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header với Time Range Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Thống Kê Sử Dụng API</h3>
          <p className="text-sm text-muted-foreground">
            Tổng quan về hoạt động và hiệu suất
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onValueChange={(value: string | null) => value && setTimeRange(value as '7d' | '30d')}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 ngày qua</SelectItem>
              <SelectItem value="30d">30 ngày qua</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Requests */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_requests.toLocaleString('vi-VN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeRange === '7d' ? '7 ngày qua' : '30 ngày qua'}
            </p>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tỷ Lệ Lỗi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.error_rate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.error_requests.toLocaleString('vi-VN')} requests lỗi
            </p>
          </CardContent>
        </Card>

        {/* Avg Response Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Response Time (TB)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avg_response_time.toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Trung bình
            </p>
          </CardContent>
        </Card>

        {/* P95 Response Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Response Time (P95)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.p95_response_time.toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              95th percentile
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Over Time Chart (Simple Bar Chart) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Requests Theo Thời Gian
          </CardTitle>
          <CardDescription>
            Số lượng requests mỗi ngày trong {timeRange === '7d' ? '7' : '30'} ngày qua
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.requests_by_day.map((day, index) => {
              const maxCount = Math.max(...stats.requests_by_day.map(d => d.count));
              const widthPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              const errorPercent = day.count > 0 ? (day.errors / day.count) * 100 : 0;

              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {format(new Date(day.date), 'dd/MM', { locale: vi })}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{day.count.toLocaleString('vi-VN')}</span>
                      {day.errors > 0 && (
                        <span className="text-red-600 text-xs">
                          {day.errors} lỗi ({errorPercent.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Top Endpoints</CardTitle>
          <CardDescription>
            Các endpoint được gọi nhiều nhất
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.top_endpoints.length > 0 ? (
              stats.top_endpoints.map((endpoint, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono truncate block">
                      {endpoint.endpoint}
                    </code>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {endpoint.count.toLocaleString('vi-VN')} requests
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {endpoint.avg_time.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    #{index + 1}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                Chưa có dữ liệu endpoint
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rate Limit Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Trạng Thái Rate Limit
          </CardTitle>
          <CardDescription>
            Giới hạn và sử dụng hiện tại
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Per Minute */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Giới hạn / Phút</span>
              <span className="text-muted-foreground">
                {stats.rate_limit_status.current_usage_minute.toLocaleString('vi-VN')} /{' '}
                {stats.rate_limit_status.limit_per_minute.toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (stats.rate_limit_status.current_usage_minute /
                    stats.rate_limit_status.limit_per_minute) *
                    100 >
                  80
                    ? 'bg-red-500'
                    : (stats.rate_limit_status.current_usage_minute /
                        stats.rate_limit_status.limit_per_minute) *
                        100 >
                      50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min(
                    (stats.rate_limit_status.current_usage_minute /
                      stats.rate_limit_status.limit_per_minute) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {getPercentage(
                stats.rate_limit_status.current_usage_minute,
                stats.rate_limit_status.limit_per_minute
              )}
              % đã sử dụng
            </p>
          </div>

          {/* Per Day */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Giới hạn / Ngày</span>
              <span className="text-muted-foreground">
                {stats.rate_limit_status.current_usage_day.toLocaleString('vi-VN')} /{' '}
                {stats.rate_limit_status.limit_per_day.toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (stats.rate_limit_status.current_usage_day /
                    stats.rate_limit_status.limit_per_day) *
                    100 >
                  80
                    ? 'bg-red-500'
                    : (stats.rate_limit_status.current_usage_day /
                        stats.rate_limit_status.limit_per_day) *
                        100 >
                      50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min(
                    (stats.rate_limit_status.current_usage_day /
                      stats.rate_limit_status.limit_per_day) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {getPercentage(
                stats.rate_limit_status.current_usage_day,
                stats.rate_limit_status.limit_per_day
              )}
              % đã sử dụng
            </p>
          </div>

          {/* Warning if approaching limit */}
          {((stats.rate_limit_status.current_usage_minute /
            stats.rate_limit_status.limit_per_minute) *
            100 >
            80 ||
            (stats.rate_limit_status.current_usage_day /
              stats.rate_limit_status.limit_per_day) *
              100 >
              80) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Cảnh báo:</strong> Đối tác đang tiếp cận giới hạn rate limit.
                Cân nhắc nâng cấp tier hoặc tối ưu số lượng requests.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>Tình Trạng Sức Khỏe API</CardTitle>
          <CardDescription>
            Đánh giá tổng quan về chất lượng integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Error Rate Health */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Tỷ lệ lỗi</span>
              {stats.error_rate < 1 ? (
                <Badge className="bg-green-100 text-green-800">Tốt</Badge>
              ) : stats.error_rate < 5 ? (
                <Badge className="bg-yellow-100 text-yellow-800">Chấp nhận được</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Cần cải thiện</Badge>
              )}
            </div>

            {/* Response Time Health */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Response time</span>
              {stats.avg_response_time < 200 ? (
                <Badge className="bg-green-100 text-green-800">Nhanh</Badge>
              ) : stats.avg_response_time < 500 ? (
                <Badge className="bg-yellow-100 text-yellow-800">Trung bình</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Chậm</Badge>
              )}
            </div>

            {/* Request Volume Health */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Khối lượng requests</span>
              {stats.total_requests > 1000 ? (
                <Badge className="bg-green-100 text-green-800">Cao</Badge>
              ) : stats.total_requests > 100 ? (
                <Badge className="bg-blue-100 text-blue-800">Trung bình</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">Thấp</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
