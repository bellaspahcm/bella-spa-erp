/**
 * Advanced Analytics Dashboard
 * 
 * Features:
 * - Multi-partner comparison
 * - Trend analysis (7d, 30d, 90d)
 * - Cost tracking per partner
 * - Performance benchmarks
 * - Revenue impact analysis
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Zap,
  AlertTriangle,
  BarChart3,
  Download,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { APIPartner } from '@/types/api-gateway';

interface AdvancedAnalyticsDashboardProps {
  partners: APIPartner[];
  tenantId: string;
}

interface PartnerAnalytics {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  is_sandbox: boolean;
  
  // Request metrics
  total_requests: number;
  error_requests: number;
  error_rate: number;
  
  // Performance metrics
  avg_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  uptime_percent: number;
  
  // Cost metrics (hypothetical pricing model)
  estimated_cost_usd: number;
  cost_per_request: number;
  
  // Revenue impact (hypothetical business value)
  revenue_generated: number;
  roi_percent: number;
  
  // Trend data (daily breakdown)
  daily_stats: Array<{
    date: string;
    requests: number;
    errors: number;
    avg_response_time: number;
  }>;
}

interface AggregatedMetrics {
  total_requests: number;
  total_errors: number;
  avg_error_rate: number;
  avg_response_time: number;
  total_cost: number;
  total_revenue: number;
  avg_uptime: number;
}

export function AdvancedAnalyticsDashboard({
  partners,
  tenantId,
}: AdvancedAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [analyticsData, setAnalyticsData] = useState<PartnerAnalytics[]>([]);

  // Initialize selection with all active partners
  useEffect(() => {
    const activePartners = partners.filter(p => p.is_active && !p.is_sandbox);
    setSelectedPartners(activePartners.map(p => p.id));
  }, [partners]);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    if (selectedPartners.length === 0) {
      setAnalyticsData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/partners/analytics?range=${timeRange}&partner_ids=${selectedPartners.join(',')}`
      );

      if (!response.ok) {
        throw new Error('Không thể tải dữ liệu analytics');
      }

      const data = await response.json();
      setAnalyticsData(data.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Không thể tải dữ liệu analytics');
      setAnalyticsData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, selectedPartners]);

  // Calculate aggregated metrics
  const aggregatedMetrics = useMemo<AggregatedMetrics>(() => {
    if (analyticsData.length === 0) {
      return {
        total_requests: 0,
        total_errors: 0,
        avg_error_rate: 0,
        avg_response_time: 0,
        total_cost: 0,
        total_revenue: 0,
        avg_uptime: 0,
      };
    }

    const total_requests = analyticsData.reduce((sum, p) => sum + p.total_requests, 0);
    const total_errors = analyticsData.reduce((sum, p) => sum + p.error_requests, 0);
    const avg_error_rate = total_requests > 0 ? (total_errors / total_requests) * 100 : 0;
    
    const avg_response_time =
      analyticsData.reduce((sum, p) => sum + p.avg_response_time * p.total_requests, 0) /
      total_requests || 0;
    
    const total_cost = analyticsData.reduce((sum, p) => sum + p.estimated_cost_usd, 0);
    const total_revenue = analyticsData.reduce((sum, p) => sum + p.revenue_generated, 0);
    
    const avg_uptime =
      analyticsData.reduce((sum, p) => sum + p.uptime_percent, 0) / analyticsData.length || 0;

    return {
      total_requests,
      total_errors,
      avg_error_rate,
      avg_response_time,
      total_cost,
      total_revenue,
      avg_uptime,
    };
  }, [analyticsData]);

  // Toggle partner selection
  const togglePartner = (partnerId: string) => {
    setSelectedPartners(prev =>
      prev.includes(partnerId)
        ? prev.filter(id => id !== partnerId)
        : [...prev, partnerId]
    );
  };

  // Export to CSV
  const exportToCSV = () => {
    if (analyticsData.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    const headers = [
      'Partner Name',
      'Partner Type',
      'Total Requests',
      'Error Rate (%)',
      'Avg Response Time (ms)',
      'P95 Response Time (ms)',
      'Uptime (%)',
      'Estimated Cost (USD)',
      'Revenue Generated (USD)',
      'ROI (%)',
    ];

    const rows = analyticsData.map(p => [
      p.partner_name,
      p.partner_type,
      p.total_requests,
      p.error_rate.toFixed(2),
      p.avg_response_time.toFixed(0),
      p.p95_response_time.toFixed(0),
      p.uptime_percent.toFixed(2),
      p.estimated_cost_usd.toFixed(2),
      p.revenue_generated.toFixed(2),
      p.roi_percent.toFixed(1),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Đã xuất dữ liệu analytics');
  };

  // Get trend indicator
  const getTrendIndicator = (current: number, previous: number, inverse = false) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    
    if (Math.abs(change) < 1) return null;
    
    const isPositive = inverse ? change < 0 : change > 0;
    
    return isPositive ? (
      <div className="flex items-center gap-1 text-green-600 text-xs">
        <TrendingUp className="h-3 w-3" />
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-red-600 text-xs">
        <TrendingDown className="h-3 w-3" />
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    );
  };

  // Get performance badge
  const getPerformanceBadge = (errorRate: number, responseTime: number, uptime: number) => {
    if (errorRate < 1 && responseTime < 200 && uptime > 99.5) {
      return <Badge className="bg-green-100 text-green-800">Xuất sắc</Badge>;
    } else if (errorRate < 3 && responseTime < 500 && uptime > 98) {
      return <Badge className="bg-blue-100 text-blue-800">Tốt</Badge>;
    } else if (errorRate < 5 && responseTime < 1000 && uptime > 95) {
      return <Badge className="bg-yellow-100 text-yellow-800">Trung bình</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Cần cải thiện</Badge>;
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
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onValueChange={(value: string | null) => value && setTimeRange(value as '7d' | '30d' | '90d')}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 ngày qua</SelectItem>
              <SelectItem value="30d">30 ngày qua</SelectItem>
              <SelectItem value="90d">90 ngày qua</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Xuất CSV
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Đang so sánh {selectedPartners.length} / {partners.length} đối tác
        </div>
      </div>

      {/* Partner Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chọn Đối Tác Để So Sánh</CardTitle>
          <CardDescription>
            Chọn các đối tác bạn muốn phân tích và so sánh
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {partners.map(partner => (
              <div
                key={partner.id}
                className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                onClick={() => togglePartner(partner.id)}
              >
                <Checkbox
                  checked={selectedPartners.includes(partner.id)}
                  onCheckedChange={() => togglePartner(partner.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{partner.partner_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {partner.partner_type}
                    {partner.is_sandbox && ' (Sandbox)'}
                  </div>
                </div>
                {partner.is_active ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedPartners.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Chưa chọn đối tác</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Vui lòng chọn ít nhất một đối tác để xem analytics
          </p>
        </div>
      ) : (
        <>
          {/* Aggregated KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Requests */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Tổng Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {aggregatedMetrics.total_requests.toLocaleString('vi-VN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Từ {selectedPartners.length} đối tác
                </p>
              </CardContent>
            </Card>

            {/* Avg Error Rate */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Tỷ Lệ Lỗi TB
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {aggregatedMetrics.avg_error_rate.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {aggregatedMetrics.total_errors.toLocaleString('vi-VN')} lỗi
                </p>
              </CardContent>
            </Card>

            {/* Avg Response Time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Response Time TB
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {aggregatedMetrics.avg_response_time.toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Trung bình tất cả partners
                </p>
              </CardContent>
            </Card>

            {/* Avg Uptime */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Uptime TB
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {aggregatedMetrics.avg_uptime.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Thời gian hoạt động
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost & Revenue Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Total Cost */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Tổng Chi Phí Ước Tính
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ${aggregatedMetrics.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Trong {timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} ngày qua
                </p>
                <div className="mt-3 text-sm text-muted-foreground">
                  Chi phí / request TB:{' '}
                  <span className="font-medium">
                    $
                    {aggregatedMetrics.total_requests > 0
                      ? (aggregatedMetrics.total_cost / aggregatedMetrics.total_requests).toFixed(4)
                      : '0.0000'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Total Revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Doanh Thu Tạo Ra
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  ${aggregatedMetrics.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ước tính business value
                </p>
                <div className="mt-3 text-sm">
                  <span className="text-muted-foreground">ROI TB: </span>
                  <span className="font-medium text-green-600">
                    {aggregatedMetrics.total_cost > 0
                      ? (((aggregatedMetrics.total_revenue - aggregatedMetrics.total_cost) /
                          aggregatedMetrics.total_cost) *
                          100).toFixed(1)
                      : '0'}
                    %
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Partner Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>So Sánh Chi Tiết Theo Đối Tác</CardTitle>
              <CardDescription>
                Metrics performance của từng đối tác được chọn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Đối Tác</th>
                      <th className="text-right p-2 font-medium">Requests</th>
                      <th className="text-right p-2 font-medium">Lỗi (%)</th>
                      <th className="text-right p-2 font-medium">Resp. Time (ms)</th>
                      <th className="text-right p-2 font-medium">P95 (ms)</th>
                      <th className="text-right p-2 font-medium">Uptime</th>
                      <th className="text-right p-2 font-medium">Chi Phí</th>
                      <th className="text-right p-2 font-medium">Doanh Thu</th>
                      <th className="text-right p-2 font-medium">ROI</th>
                      <th className="text-center p-2 font-medium">Đánh Giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData
                      .sort((a, b) => b.total_requests - a.total_requests)
                      .map(partner => (
                        <tr key={partner.partner_id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div className="font-medium">{partner.partner_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {partner.partner_type}
                              {partner.is_sandbox && ' (Sandbox)'}
                            </div>
                          </td>
                          <td className="text-right p-2">
                            {partner.total_requests.toLocaleString('vi-VN')}
                          </td>
                          <td className="text-right p-2">
                            <span
                              className={
                                partner.error_rate < 1
                                  ? 'text-green-600'
                                  : partner.error_rate < 5
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }
                            >
                              {partner.error_rate.toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right p-2">{partner.avg_response_time.toFixed(0)}</td>
                          <td className="text-right p-2">{partner.p95_response_time.toFixed(0)}</td>
                          <td className="text-right p-2">
                            <span
                              className={
                                partner.uptime_percent > 99.5
                                  ? 'text-green-600'
                                  : partner.uptime_percent > 98
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }
                            >
                              {partner.uptime_percent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right p-2">
                            ${partner.estimated_cost_usd.toFixed(2)}
                          </td>
                          <td className="text-right p-2 text-green-600">
                            ${partner.revenue_generated.toFixed(2)}
                          </td>
                          <td className="text-right p-2">
                            <span
                              className={
                                partner.roi_percent > 100
                                  ? 'text-green-600'
                                  : partner.roi_percent > 0
                                  ? 'text-blue-600'
                                  : 'text-red-600'
                              }
                            >
                              {partner.roi_percent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-center p-2">
                            {getPerformanceBadge(
                              partner.error_rate,
                              partner.avg_response_time,
                              partner.uptime_percent
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Performance Benchmarks */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Benchmarks</CardTitle>
              <CardDescription>
                So sánh với các mức chuẩn industry-standard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Rate Benchmark */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Tỷ Lệ Lỗi</span>
                  <span className="text-muted-foreground">
                    {aggregatedMetrics.avg_error_rate.toFixed(2)}% (Mục tiêu: &lt; 1%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      aggregatedMetrics.avg_error_rate < 1
                        ? 'bg-green-500'
                        : aggregatedMetrics.avg_error_rate < 3
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(aggregatedMetrics.avg_error_rate * 10, 100)}%` }}
                  />
                </div>
              </div>

              {/* Response Time Benchmark */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Response Time</span>
                  <span className="text-muted-foreground">
                    {aggregatedMetrics.avg_response_time.toFixed(0)}ms (Mục tiêu: &lt; 200ms)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      aggregatedMetrics.avg_response_time < 200
                        ? 'bg-green-500'
                        : aggregatedMetrics.avg_response_time < 500
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min((aggregatedMetrics.avg_response_time / 1000) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Uptime Benchmark */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Uptime</span>
                  <span className="text-muted-foreground">
                    {aggregatedMetrics.avg_uptime.toFixed(2)}% (Mục tiêu: &gt; 99.5%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      aggregatedMetrics.avg_uptime > 99.5
                        ? 'bg-green-500'
                        : aggregatedMetrics.avg_uptime > 98
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${aggregatedMetrics.avg_uptime}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Efficiency Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Phân Tích Hiệu Quả Chi Phí</CardTitle>
              <CardDescription>
                Partners có ROI và cost efficiency tốt nhất
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData
                  .sort((a, b) => b.roi_percent - a.roi_percent)
                  .slice(0, 5)
                  .map((partner, index) => (
                    <div key={partner.partner_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{partner.partner_name}</span>
                          {index === 0 && <Badge className="bg-yellow-100 text-yellow-800">Top 1</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Chi phí: ${partner.estimated_cost_usd.toFixed(2)} | Doanh thu: $
                          {partner.revenue_generated.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {partner.roi_percent.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">ROI</div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
