/**
 * Partner SLA Monitor Tab Component
 * 
 * Tab #9 in partner detail page
 * 
 * Features:
 * - SLA compliance status cards
 * - Real-time metrics charts (response time, uptime)
 * - Alert history table with filters
 * - Quick stats KPIs
 * - Time range selector
 * - Configure SLA button
 * 
 * @module components/admin/partners/detail-tabs/PartnerSLAMonitorTab
 * @since 2026-06-18
 */

'use client';

import { useState, useEffect } from 'react';
import { APIPartner, SLAMetrics, SLAAlert, SLATimeRange, SLAAlertSeverity, SLAAlertStatus, SLAAlertType } from '@/types/api-gateway';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  XCircle,
  Bell,
  Filter,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { SLAAlertConfigDialog } from '@/components/admin/partners/SLAAlertConfigDialog';

interface PartnerSLAMonitorTabProps {
  partner: APIPartner;
}

export function PartnerSLAMonitorTab({ partner }: PartnerSLAMonitorTabProps) {
  const [timeRange, setTimeRange] = useState<SLATimeRange>('24h');
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);
  const [alerts, setAlerts] = useState<SLAAlert[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  // Alert filters
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<SLAAlertSeverity | 'all'>('all');
  const [alertStatusFilter, setAlertStatusFilter] = useState<SLAAlertStatus | 'all'>('all');
  const [alertTypeFilter, setAlertTypeFilter] = useState<SLAAlertType | 'all'>('all');
  const [alertSearchQuery, setAlertSearchQuery] = useState('');


  const fetchMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const response = await fetch(
        `/api/admin/partners/${partner.id}/sla-metrics?time_range=${timeRange}&include_time_series=true`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch SLA metrics');
      }
      const { data } = await response.json();
      setMetrics(data);
    } catch (error: unknown) {
      console.error('Error fetching SLA metrics:', error);
      toast.error('Failed to load SLA metrics');
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const fetchAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const params = new URLSearchParams({
        time_range: timeRange,
        limit: '50',
      });
      
      if (alertSeverityFilter !== 'all') params.append('severity', alertSeverityFilter);
      if (alertStatusFilter !== 'all') params.append('status', alertStatusFilter);
      if (alertTypeFilter !== 'all') params.append('alert_type', alertTypeFilter);

      const response = await fetch(
        `/api/admin/partners/${partner.id}/sla-alerts?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const { data } = await response.json();
      setAlerts(data);
    } catch (error: unknown) {
      console.error('Error fetching alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/sla-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge',
          alert_id: alertId,
          notes: 'Acknowledged via admin UI',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      toast.success('Alert acknowledged');
      fetchAlerts();
    } catch (error: unknown) {
      console.error('Error acknowledging alert:', error);
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/sla-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          alert_id: alertId,
          resolution_notes: 'Resolved via admin UI',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve alert');
      }

      toast.success('Alert resolved');
      fetchAlerts();
    } catch (error: unknown) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };

  const handleExportAlerts = () => {
    // Convert alerts to CSV
    const headers = ['Time', 'Type', 'Severity', 'Status', 'Title', 'Message', 'Metric Value', 'Threshold'];
    const rows = alerts.map(alert => [
      new Date(alert.triggered_at).toLocaleString(),
      alert.alert_type,
      alert.severity,
      alert.status,
      alert.title,
      alert.message,
      alert.metric_value.toString(),
      alert.threshold_value.toString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${partner.partner_name}_sla_alerts_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Alerts exported to CSV');
  };

  // Filter alerts by search query
  const filteredAlerts = alerts.filter(alert =>
    alert.title.toLowerCase().includes(alertSearchQuery.toLowerCase()) ||
    alert.message.toLowerCase().includes(alertSearchQuery.toLowerCase())
  );

  // Active alerts count
  const activeAlertsCount = alerts.filter(a => a.status === 'active').length;
  const criticalAlertsCount = alerts.filter(a => a.severity === 'critical' && a.status === 'active').length;

  if (isLoadingMetrics || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SLA Monitoring</h2>
          <p className="text-muted-foreground mt-1">
            Track uptime, latency, and error rates in real-time
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as SLATimeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Configure SLA Button */}
          <Button onClick={() => setConfigDialogOpen(true)} variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configure SLA
          </Button>
        </div>
      </div>

      {/* SLA Compliance Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Compliance */}
        <div className={`rounded-xl border p-6 ${
          metrics.compliance_status === 'compliant' ? 'bg-green-50 border-green-200 dark:bg-green-950/20' :
          metrics.compliance_status === 'at_risk' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20' :
          'bg-red-50 border-red-200 dark:bg-red-950/20'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overall Compliance</p>
              <p className="text-3xl font-bold mt-2">{metrics.compliance_percent.toFixed(1)}%</p>
            </div>
            {metrics.compliance_status === 'compliant' ? (
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            ) : metrics.compliance_status === 'at_risk' ? (
              <AlertTriangle className="h-10 w-10 text-yellow-600" />
            ) : (
              <XCircle className="h-10 w-10 text-red-600" />
            )}
          </div>
          <Badge className="mt-3" variant={
            metrics.compliance_status === 'compliant' ? 'default' :
            metrics.compliance_status === 'at_risk' ? 'outline' : 'destructive'
          }>
            {metrics.compliance_status === 'compliant' ? '✓ Compliant' :
             metrics.compliance_status === 'at_risk' ? '⚠ At Risk' : '✗ Breached'}
          </Badge>
        </div>

        {/* Uptime */}
        <div className="rounded-xl border bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Uptime</p>
              <p className="text-3xl font-bold mt-2">{metrics.uptime_percent.toFixed(2)}%</p>
            </div>
            <Activity className="h-10 w-10 text-blue-600" />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Badge variant="outline">{metrics.availability_status}</Badge>
            <span className="text-muted-foreground">
              {metrics.downtime_minutes.toFixed(1)}m downtime
            </span>
          </div>
        </div>

        {/* Response Time */}
        <div className="rounded-xl border bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">P95 Latency</p>
              <p className="text-3xl font-bold mt-2">{metrics.p95_response_time_ms}ms</p>
            </div>
            <Clock className="h-10 w-10 text-purple-600" />
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Avg: {metrics.avg_response_time_ms}ms | Max: {metrics.max_response_time_ms}ms
          </div>
        </div>

        {/* Error Rate */}
        <div className="rounded-xl border bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
              <p className="text-3xl font-bold mt-2">{metrics.error_rate_percent.toFixed(2)}%</p>
            </div>
            <AlertTriangle className={`h-10 w-10 ${
              metrics.error_rate_percent > 5 ? 'text-red-600' :
              metrics.error_rate_percent > 3 ? 'text-yellow-600' : 'text-green-600'
            }`} />
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {metrics.failed_requests} / {metrics.total_requests} requests
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold mt-1">{metrics.total_requests.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="rounded-lg border bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Requests/min (avg)</p>
              <p className="text-2xl font-bold mt-1">{metrics.requests_per_minute_avg.toFixed(1)}</p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="rounded-lg border bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Peak Requests/min</p>
              <p className="text-2xl font-bold mt-1">{metrics.requests_per_minute_peak}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Alert Summary Banner */}
      {activeAlertsCount > 0 && (
        <div className={`rounded-xl border p-4 ${
          criticalAlertsCount > 0 
            ? 'bg-red-50 border-red-200 dark:bg-red-950/20'
            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20'
        }`}>
          <div className="flex items-center gap-3">
            <Bell className={`h-5 w-5 ${criticalAlertsCount > 0 ? 'text-red-600' : 'text-yellow-600'}`} />
            <div className="flex-1">
              <p className="font-semibold">
                {activeAlertsCount} Active Alert{activeAlertsCount > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                {criticalAlertsCount > 0 && `${criticalAlertsCount} critical, `}
                {activeAlertsCount - criticalAlertsCount} warning/info alerts
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAlertStatusFilter('active')}>
              View Alerts
            </Button>
          </div>
        </div>
      )}

      {/* Alerts Section */}
      <div className="rounded-xl border bg-white dark:bg-gray-800 p-6">
        <div className="space-y-4">
          {/* Alerts Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Alert History</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportAlerts}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search */}
            <Input
              placeholder="Search alerts..."
              value={alertSearchQuery}
              onChange={(e) => setAlertSearchQuery(e.target.value)}
              className="col-span-1"
            />

            {/* Severity Filter */}
            <Select value={alertSeverityFilter} onValueChange={(value) => setAlertSeverityFilter(value as unknown)}>
              <SelectTrigger>
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={alertStatusFilter} onValueChange={(value) => setAlertStatusFilter(value as unknown)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={alertTypeFilter} onValueChange={(value) => setAlertTypeFilter(value as unknown)}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="uptime">Uptime</SelectItem>
                <SelectItem value="latency">Latency</SelectItem>
                <SelectItem value="error_rate">Error Rate</SelectItem>
                <SelectItem value="availability">Availability</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alerts Table */}
          <div className="border rounded-lg overflow-hidden">
            {isLoadingAlerts ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p>No alerts found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Alert</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Metric</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredAlerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(alert.triggered_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{alert.alert_type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={
                            alert.severity === 'critical' ? 'destructive' :
                            alert.severity === 'warning' ? 'outline' : 'default'
                          }>
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={
                            alert.status === 'active' ? 'destructive' :
                            alert.status === 'acknowledged' ? 'outline' : 'default'
                          }>
                            {alert.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-sm">{alert.title}</p>
                            <p className="text-xs text-muted-foreground">{alert.message}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-mono">
                            {alert.metric_value} / {alert.threshold_value}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {alert.status === 'active' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAcknowledgeAlert(alert.id)}
                                >
                                  Acknowledge
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleResolveAlert(alert.id)}
                                >
                                  Resolve
                                </Button>
                              </>
                            )}
                            {alert.status === 'acknowledged' && (
                              <Button
                                size="sm"
                                onClick={() => handleResolveAlert(alert.id)}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SLA Config Dialog */}
      <SLAAlertConfigDialog
        partner={partner}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onConfigSaved={() => {
          fetchMetrics();
          toast.success('SLA configuration updated');
        }}
      />
    </div>
  );
}
