/**
 * SLA Mock Data Generator
 * 
 * Generates realistic mock data for testing SLA monitoring features
 * 
 * @module lib/mock-data/sla-generator
 * @since 2026-06-18
 */

import {
  SLAMetrics,
  SLAAlert,
  SLAAlertSeverity,
  SLAAlertStatus,
  SLAAlertType,
  SLATimeRange,
  SLAComplianceStatus,
} from '@/types/api-gateway';

/**
 * Generate mock SLA metrics for testing
 */
export function generateMockSLAMetrics(
  partnerId: string,
  timeRange: SLATimeRange = '24h',
  scenario: 'healthy' | 'degraded' | 'critical' = 'healthy'
): SLAMetrics {
  const now = new Date();

  // Scenario-based metrics
  let uptimePercent: number;
  let p95ResponseTime: number;
  let errorRatePercent: number;
  let availabilityStatus: 'up' | 'down' | 'degraded';
  let complianceStatus: SLAComplianceStatus;

  switch (scenario) {
    case 'critical':
      uptimePercent = 97.5 + Math.random() * 1; // 97.5-98.5%
      p95ResponseTime = 400 + Math.random() * 300; // 400-700ms
      errorRatePercent = 5 + Math.random() * 3; // 5-8%
      availabilityStatus = 'degraded';
      complianceStatus = 'breached';
      break;

    case 'degraded':
      uptimePercent = 98.5 + Math.random() * 1; // 98.5-99.5%
      p95ResponseTime = 300 + Math.random() * 150; // 300-450ms
      errorRatePercent = 3 + Math.random() * 2; // 3-5%
      availabilityStatus = 'degraded';
      complianceStatus = 'at_risk';
      break;

    case 'healthy':
    default:
      uptimePercent = 99.5 + Math.random() * 0.5; // 99.5-100%
      p95ResponseTime = 100 + Math.random() * 150; // 100-250ms
      errorRatePercent = Math.random() * 2; // 0-2%
      availabilityStatus = 'up';
      complianceStatus = 'compliant';
      break;
  }

  // Calculate derived metrics
  const totalRequests = Math.floor(1000 + Math.random() * 9000); // 1k-10k
  const failedRequests = Math.floor((totalRequests * errorRatePercent) / 100);
  const successfulRequests = totalRequests - failedRequests;

  const avgResponseTime = p95ResponseTime * 0.6; // avg ~60% of p95
  const p99ResponseTime = p95ResponseTime * 1.4; // p99 ~140% of p95
  const maxResponseTime = p95ResponseTime * 2; // max ~200% of p95

  const timeWindows: Record<SLATimeRange, number> = {
    '1h': 60,
    '24h': 1440,
    '7d': 10080,
    '30d': 43200,
  };
  const windowMinutes = timeWindows[timeRange];
  const downtimeMinutes = ((100 - uptimePercent) / 100) * windowMinutes;

  const requestsPerMinute = totalRequests / windowMinutes;
  const requestsPerMinutePeak = requestsPerMinute * (1.5 + Math.random() * 0.5); // 1.5-2x avg

  // Compliance calculation
  const uptimeTarget = 99.5;
  const p95LatencyTarget = 300;
  const errorRateTarget = 3.0;

  const uptimeCompliance = Math.min((uptimePercent / uptimeTarget) * 100, 100);
  const latencyCompliance = p95ResponseTime > 0
    ? Math.max(100 - ((p95ResponseTime / p95LatencyTarget) - 1) * 100, 0)
    : 100;
  const errorRateCompliance = errorRatePercent > 0
    ? Math.max(100 - ((errorRatePercent / errorRateTarget) - 1) * 100, 0)
    : 100;
  
  const compliancePercent = (uptimeCompliance + latencyCompliance + errorRateCompliance) / 3;

  // Generate time series data
  const bucketCount = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    const timestamp = new Date(now.getTime() - (bucketCount - i) * (windowMinutes / bucketCount) * 60 * 1000);
    const bucketRequests = Math.floor(totalRequests / bucketCount);
    const bucketErrors = Math.floor(failedRequests / bucketCount);
    const bucketUptime = 98 + Math.random() * 2; // Vary between 98-100%

    return {
      timestamp: timestamp.toISOString(),
      requests: bucketRequests + Math.floor(Math.random() * 100 - 50),
      errors: bucketErrors + Math.floor(Math.random() * 10 - 5),
      avg_response_time: Math.round(avgResponseTime + Math.random() * 50 - 25),
      uptime_percent: Math.round(bucketUptime * 100) / 100,
    };
  });

  return {
    partner_id: partnerId,
    time_range: timeRange,
    
    uptime_percent: Math.round(uptimePercent * 100) / 100,
    downtime_minutes: Math.round(downtimeMinutes * 100) / 100,
    availability_status: availabilityStatus,
    
    avg_response_time_ms: Math.round(avgResponseTime),
    p95_response_time_ms: Math.round(p95ResponseTime),
    p99_response_time_ms: Math.round(p99ResponseTime),
    max_response_time_ms: Math.round(maxResponseTime),
    
    total_requests: totalRequests,
    successful_requests: successfulRequests,
    failed_requests: failedRequests,
    error_rate_percent: Math.round(errorRatePercent * 100) / 100,
    
    requests_per_minute_avg: Math.round(requestsPerMinute * 100) / 100,
    requests_per_minute_peak: Math.round(requestsPerMinutePeak),
    
    compliance_status: complianceStatus,
    compliance_percent: Math.round(compliancePercent * 100) / 100,
    
    time_series: timeSeries,
    
    calculated_at: now.toISOString(),
    last_updated_at: now.toISOString(),
  };
}

/**
 * Generate mock SLA alerts for testing
 */
export function generateMockSLAAlerts(
  partnerId: string,
  tenantId: string,
  count: number = 30,
  scenario: 'healthy' | 'degraded' | 'critical' = 'healthy'
): SLAAlert[] {
  const alerts: SLAAlert[] = [];
  const now = new Date();

  // Alert templates with severity based on scenario
  const alertTemplates: Array<{
    alert_type: SLAAlertType;
    severity: SLAAlertSeverity;
    title: string;
    message: string;
    metric_name: string;
    metric_value: number;
    threshold_value: number;
  }> = [];

  if (scenario === 'critical' || scenario === 'degraded') {
    alertTemplates.push(
      {
        alert_type: 'latency',
        severity: scenario === 'critical' ? 'critical' : 'warning',
        title: 'High Response Time Detected',
        message: 'P95 response time exceeded threshold',
        metric_name: 'p95_response_time_ms',
        metric_value: scenario === 'critical' ? 650 : 456,
        threshold_value: 300,
      },
      {
        alert_type: 'error_rate',
        severity: scenario === 'critical' ? 'critical' : 'warning',
        title: 'Error Rate Spike',
        message: 'Error rate exceeded threshold',
        metric_name: 'error_rate_percent',
        metric_value: scenario === 'critical' ? 8.5 : 4.2,
        threshold_value: 3.0,
      }
    );
  }

  if (scenario === 'critical') {
    alertTemplates.push(
      {
        alert_type: 'uptime',
        severity: 'critical',
        title: 'Uptime Below Target',
        message: 'Service uptime dropped below 99.5%',
        metric_name: 'uptime_percent',
        metric_value: 98.2,
        threshold_value: 99.5,
      },
      {
        alert_type: 'availability',
        severity: 'critical',
        title: 'Service Unavailable',
        message: 'Multiple consecutive failures detected',
        metric_name: 'consecutive_failures',
        metric_value: 5,
        threshold_value: 3,
      }
    );
  }

  // Add some info alerts for all scenarios
  alertTemplates.push({
    alert_type: 'latency',
    severity: 'info',
    title: 'Response Time Elevated',
    message: 'Average response time slightly elevated',
    metric_name: 'avg_response_time_ms',
    metric_value: 250,
    threshold_value: 200,
  });

  const statuses: SLAAlertStatus[] = scenario === 'critical' 
    ? ['active', 'active', 'acknowledged']
    : scenario === 'degraded'
    ? ['active', 'acknowledged', 'resolved']
    : ['acknowledged', 'resolved', 'resolved'];

  for (let i = 0; i < count; i++) {
    const template = alertTemplates[i % alertTemplates.length];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const hoursAgo = Math.floor(Math.random() * 168); // Random within last 7 days
    const triggeredAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    let acknowledgedAt: string | undefined;
    let resolvedAt: string | undefined;
    let durationMinutes: number | undefined;

    if (status === 'acknowledged' || status === 'resolved') {
      const ackMinutesAfter = Math.floor(Math.random() * 60) + 5; // 5-65 minutes
      acknowledgedAt = new Date(triggeredAt.getTime() + ackMinutesAfter * 60 * 1000).toISOString();
    }

    if (status === 'resolved') {
      const resolveMinutesAfterAck = Math.floor(Math.random() * 120) + 10; // 10-130 minutes
      resolvedAt = new Date(
        new Date(acknowledgedAt!).getTime() + resolveMinutesAfterAck * 60 * 1000
      ).toISOString();
      durationMinutes = Math.floor((new Date(resolvedAt).getTime() - triggeredAt.getTime()) / 60000);
    }

    const notificationChannels: ('email' | 'webhook' | 'telegram')[] = [];
    if (template.severity === 'critical') {
      notificationChannels.push('email', 'webhook', 'telegram');
    } else if (template.severity === 'warning') {
      notificationChannels.push('email', 'webhook');
    } else {
      notificationChannels.push('webhook');
    }

    alerts.push({
      id: `alert_${partnerId.slice(0, 8)}_${i + 1}`,
      partner_id: partnerId,
      tenant_id: tenantId,
      
      alert_type: template.alert_type,
      severity: template.severity,
      status,
      
      title: template.title,
      message: template.message,
      
      metric_name: template.metric_name,
      metric_value: template.metric_value,
      threshold_value: template.threshold_value,
      
      triggered_at: triggeredAt.toISOString(),
      acknowledged_at: acknowledgedAt,
      resolved_at: resolvedAt,
      
      duration_minutes: durationMinutes,
      
      notification_sent: true,
      notification_channels_used: notificationChannels,
      
      metadata: {
        triggered_by: 'system',
        acknowledged_by: acknowledgedAt ? 'Admin User' : undefined,
        resolved_by: resolvedAt ? 'Admin User' : undefined,
      },
      
      created_at: triggeredAt.toISOString(),
      updated_at: resolvedAt || acknowledgedAt || triggeredAt.toISOString(),
    });
  }

  // Sort by triggered_at desc
  return alerts.sort((a, b) => 
    new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
  );
}

/**
 * Generate a complete mock SLA dataset for comprehensive testing
 */
export function generateCompleteMockSLAData(
  partnerId: string,
  tenantId: string,
  scenario: 'healthy' | 'degraded' | 'critical' = 'healthy'
) {
  return {
    metrics_1h: generateMockSLAMetrics(partnerId, '1h', scenario),
    metrics_24h: generateMockSLAMetrics(partnerId, '24h', scenario),
    metrics_7d: generateMockSLAMetrics(partnerId, '7d', scenario),
    metrics_30d: generateMockSLAMetrics(partnerId, '30d', scenario),
    alerts: generateMockSLAAlerts(partnerId, tenantId, 30, scenario),
  };
}
