/**
 * Mock SLA Data Generator
 * 
 * Provides comprehensive test data for SLA monitoring dashboard.
 * Generates realistic metrics, alerts, and time series data.
 */

import {
  SLAMetrics,
  SLAAlert,
  SLAAlertSeverity,
  SLAAlertType,
  SLAAlertStatus
} from '@/types/api-gateway';

// Extract time series data type from SLAMetrics
type SLATimeSeriesData = NonNullable<SLAMetrics['time_series']>[number];

// ============================================================================
// SCENARIO TYPES
// ============================================================================

export type SLAScenario = 'healthy' | 'degraded' | 'critical';

export interface MockSLAOptions {
  scenario?: SLAScenario;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  includeTimeSeries?: boolean;
  partnerId?: string;
}

// ============================================================================
// METRICS GENERATOR
// ============================================================================

/**
 * Generate mock SLA metrics based on scenario
 */
export function generateMockSLAMetrics(options: MockSLAOptions = {}): SLAMetrics {
  const {
    scenario = 'healthy',
    timeRange = '24h',
    includeTimeSeries = false,
    partnerId = 'partner_123'
  } = options;

  // Base metrics by scenario
  const scenarioData = {
    healthy: {
      uptime: 99.95 + Math.random() * 0.04, // 99.95-99.99%
      downtime: Math.floor(Math.random() * 5),
      avgLatency: 85 + Math.random() * 15, // 85-100ms
      p95: 140 + Math.random() * 20, // 140-160ms
      p99: 195 + Math.random() * 15, // 195-210ms
      max: 280 + Math.random() * 40, // 280-320ms
      errorRate: 0.1 + Math.random() * 0.3, // 0.1-0.4%
      totalReq: 45000 + Math.floor(Math.random() * 15000),
      failedReq: 25 + Math.floor(Math.random() * 35),
      compliance: 'compliant' as const,
      compliancePercent: 99.5 + Math.random() * 0.5,
      status: 'up' as const
    },
    degraded: {
      uptime: 97.5 + Math.random() * 1.5, // 97.5-99%
      downtime: 35 + Math.floor(Math.random() * 25),
      avgLatency: 185 + Math.random() * 40, // 185-225ms
      p95: 480 + Math.random() * 60, // 480-540ms
      p99: 850 + Math.random() * 100, // 850-950ms
      max: 1800 + Math.random() * 400, // 1.8-2.2s
      errorRate: 1.8 + Math.random() * 1.2, // 1.8-3%
      totalReq: 38000 + Math.floor(Math.random() * 10000),
      failedReq: 780 + Math.floor(Math.random() * 420),
      compliance: 'at_risk' as const,
      compliancePercent: 85 + Math.random() * 10,
      status: 'degraded' as const
    },
    critical: {
      uptime: 92.3 + Math.random() * 2, // 92-94%
      downtime: 110 + Math.floor(Math.random() * 50),
      avgLatency: 420 + Math.random() * 80, // 420-500ms
      p95: 1250 + Math.random() * 250, // 1.25-1.5s
      p99: 2800 + Math.random() * 500, // 2.8-3.3s
      max: 5500 + Math.random() * 1500, // 5.5-7s
      errorRate: 6.5 + Math.random() * 2.5, // 6.5-9%
      totalReq: 28000 + Math.floor(Math.random() * 8000),
      failedReq: 2100 + Math.floor(Math.random() * 900),
      compliance: 'breached' as const,
      compliancePercent: 55 + Math.random() * 20,
      status: 'down' as const
    }
  };

  const data = scenarioData[scenario];
  const now = new Date().toISOString();

  const metrics: SLAMetrics = {
    partner_id: partnerId,
    time_range: timeRange,
    uptime_percent: Number(data.uptime.toFixed(2)),
    downtime_minutes: data.downtime,
    availability_status: data.status,
    avg_response_time_ms: Number(data.avgLatency.toFixed(1)),
    p95_response_time_ms: Number(data.p95.toFixed(1)),
    p99_response_time_ms: Number(data.p99.toFixed(1)),
    max_response_time_ms: Number(data.max.toFixed(1)),
    total_requests: data.totalReq,
    successful_requests: data.totalReq - data.failedReq,
    failed_requests: data.failedReq,
    error_rate_percent: Number(data.errorRate.toFixed(2)),
    requests_per_minute_avg: Number((data.totalReq / getMinutesInRange(timeRange)).toFixed(1)),
    requests_per_minute_peak: Number((data.totalReq / getMinutesInRange(timeRange) * 4).toFixed(1)),
    compliance_status: data.compliance,
    compliance_percent: Number(data.compliancePercent.toFixed(1)),
    calculated_at: now,
    last_updated_at: now
  };

  // Add time series if requested
  if (includeTimeSeries) {
    metrics.time_series = generateTimeSeries(timeRange, scenario);
  }

  return metrics;
}

// ============================================================================
// TIME SERIES GENERATOR
// ============================================================================

function generateTimeSeries(
  timeRange: '1h' | '24h' | '7d' | '30d',
  scenario: SLAScenario
): SLATimeSeriesData[] {
  const intervals = {
    '1h': { count: 12, minutes: 5 },      // 5-minute intervals
    '24h': { count: 24, minutes: 60 },    // 1-hour intervals
    '7d': { count: 28, minutes: 360 },    // 6-hour intervals
    '30d': { count: 30, minutes: 1440 }   // 1-day intervals
  };

  const config = intervals[timeRange];
  const now = Date.now();
  const series: SLATimeSeriesData[] = [];

  for (let i = config.count - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * config.minutes * 60 * 1000).toISOString();
    
    // Base values by scenario with random variations
    const baseValues = {
      healthy: { uptime: 99.9, latency: 95, errors: 10, requests: 2500 },
      degraded: { uptime: 98.5, latency: 220, errors: 60, requests: 2100 },
      critical: { uptime: 93.0, latency: 480, errors: 200, requests: 1600 }
    };

    const base = baseValues[scenario];
    
    // Add realistic variations
    const variation = () => (Math.random() - 0.5) * 0.15; // ±7.5% variation
    
    series.push({
      timestamp,
      uptime_percent: Number((base.uptime + base.uptime * variation() * 0.01).toFixed(2)),
      avg_response_time: Number((base.latency + base.latency * variation()).toFixed(1)),
      errors: Math.floor(Math.max(0, base.errors + base.errors * variation())),
      requests: Math.floor(base.requests + base.requests * variation())
    });
  }

  return series;
}

// ============================================================================
// ALERTS GENERATOR
// ============================================================================

/**
 * Generate mock SLA alerts
 */
export function generateMockSLAAlerts(options: MockSLAOptions = {}): SLAAlert[] {
  const {
    scenario = 'healthy',
    partnerId = 'partner_123'
  } = options;

  const alertCount = {
    healthy: 0,
    degraded: 3,
    critical: 8
  };

  const count = alertCount[scenario];
  if (count === 0) return [];

  const alerts: SLAAlert[] = [];
  const now = Date.now();

  // Alert templates
  const templates: Array<{
    type: SLAAlertType;
    severity: SLAAlertSeverity;
    title: string;
    message: string;
    metricName: string;
    threshold: number;
    actual: number;
  }> = [
    {
      type: 'latency',
      severity: 'critical',
      title: 'P95 Latency Vượt Ngưỡng Nghiêm Trọng',
      message: 'P95 latency đã vượt ngưỡng 500ms trong 5 phút liên tiếp',
      metricName: 'p95_response_time_ms',
      threshold: 500,
      actual: scenario === 'critical' ? 1350 : 620
    },
    {
      type: 'error_rate',
      severity: 'warning',
      title: 'Tỷ Lệ Lỗi Cao Bất Thường',
      message: 'Error rate đạt mức cao hơn 5% trong 10 phút qua',
      metricName: 'error_rate_percent',
      threshold: 5,
      actual: scenario === 'critical' ? 8.2 : 6.1
    },
    {
      type: 'uptime',
      severity: 'critical',
      title: 'Mất Kết Nối API',
      message: 'API không phản hồi trong 3 phút. Có thể dịch vụ đang gặp sự cố',
      metricName: 'uptime_percent',
      threshold: 99.9,
      actual: scenario === 'critical' ? 92.8 : 97.5
    },
    {
      type: 'availability',
      severity: 'info',
      title: 'Availability Giảm',
      message: 'Availability giảm xuống dưới 98% do nhiều request thất bại',
      metricName: 'uptime_percent',
      threshold: 98,
      actual: 96.4
    },
    {
      type: 'latency',
      severity: 'warning',
      title: 'P99 Latency Vượt Ngưỡng',
      message: 'P99 latency đạt 2.8s, vượt ngưỡng cho phép 1s',
      metricName: 'p99_response_time_ms',
      threshold: 1000,
      actual: 2850
    },
    {
      type: 'error_rate',
      severity: 'critical',
      title: 'Tỷ Lệ Lỗi Cực Kỳ Cao',
      message: 'Error rate vượt 10% - cần điều tra ngay lập tức',
      metricName: 'error_rate_percent',
      threshold: 10,
      actual: 12.3
    },
    {
      type: 'uptime',
      severity: 'warning',
      title: 'Downtime Kéo Dài',
      message: 'API đã offline trong 15 phút. Tổng downtime: 45 phút trong 24h',
      metricName: 'uptime_percent',
      threshold: 99,
      actual: 94.2
    },
    {
      type: 'availability',
      severity: 'info',
      title: 'Nhiều Request Timeout',
      message: 'Phát hiện nhiều request timeout liên tiếp trong 5 phút',
      metricName: 'uptime_percent',
      threshold: 97,
      actual: 95.8
    }
  ];

  // Select alerts based on count
  const selectedTemplates = templates.slice(0, Math.min(count, templates.length));

  selectedTemplates.forEach((template, index) => {
    const minutesAgo = index * (scenario === 'critical' ? 5 : 15);
    const isResolved = scenario === 'degraded' && index < 1; // Degraded: 1 resolved alert
    const triggeredAt = new Date(now - minutesAgo * 60 * 1000).toISOString();

    alerts.push({
      id: `alert_${partnerId}_${Date.now()}_${index}`,
      partner_id: partnerId,
      tenant_id: 'tenant_123',
      alert_type: template.type,
      severity: template.severity,
      status: isResolved ? 'resolved' : (index === 0 ? 'active' : 'acknowledged'),
      title: template.title,
      message: template.message,
      metric_name: template.metricName,
      metric_value: template.actual,
      threshold_value: template.threshold,
      triggered_at: triggeredAt,
      acknowledged_at: !isResolved && index > 0 
        ? new Date(now - (minutesAgo - 2) * 60 * 1000).toISOString() 
        : undefined,
      resolved_at: isResolved 
        ? new Date(now - (minutesAgo - 10) * 60 * 1000).toISOString() 
        : undefined,
      duration_minutes: isResolved ? 10 : undefined,
      notification_sent: true,
      notification_channels_used: ['email', 'webhook'],
      metadata: {
        resolved_by: isResolved ? 'admin@bella.vn' : undefined,
        resolution_notes: isResolved ? 'Đã tăng cường server capacity, metrics đã ổn định.' : undefined
      },
      created_at: triggeredAt,
      updated_at: new Date().toISOString()
    });
  });

  return alerts;
}

// ============================================================================
// COMPLETE MOCK DATA
// ============================================================================

/**
 * Generate complete mock SLA data (metrics + alerts)
 */
export function generateCompleteMockSLAData(options: MockSLAOptions = {}) {
  return {
    metrics: generateMockSLAMetrics(options),
    alerts: generateMockSLAAlerts(options)
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTimeRangeStart(timeRange: '1h' | '24h' | '7d' | '30d'): string {
  const now = Date.now();
  const durations = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  return new Date(now - durations[timeRange]).toISOString();
}

function getMinutesInRange(timeRange: '1h' | '24h' | '7d' | '30d'): number {
  const minutes = {
    '1h': 60,
    '24h': 24 * 60,
    '7d': 7 * 24 * 60,
    '30d': 30 * 24 * 60
  };
  
  return minutes[timeRange];
}
