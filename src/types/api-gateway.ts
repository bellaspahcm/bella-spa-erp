/**
 * API Gateway Types - Phase 1
 * 
 * TypeScript types for Partner Management System
 * Generated from database schema: 20260617000000_api_gateway_partner_management.sql
 * 
 * @module types/api-gateway
 * @since 2026-06-17
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Partner Type Categories
 */
export type PartnerType =
  | 'pos'           // POS system integration (KiotViet, MISA, Sapo)
  | 'payment'       // Payment gateway (Casso, SePay, PayOS)
  | 'invoice'       // E-Invoice provider (VNPT, Viettel, MISA)
  | 'franchise'     // Franchise partner
  | 'hr'            // HR platform integration
  | 'analytics'     // Analytics/BI tool
  | 'mobile_app'    // Mobile app
  | 'other';        // Other integrations

/**
 * API Scope Permissions
 * Format: <resource>:<action>
 */
export type APIScope =
  // Orders
  | 'order:read'
  | 'order:write'
  | 'order:complete'
  | 'order:cancel'
  // Payments
  | 'payment:read'
  | 'payment:write'
  | 'payment:refund'
  // Invoices
  | 'invoice:read'
  | 'invoice:create'
  | 'invoice:cancel'
  // POS Sync
  | 'pos:sync'
  | 'pos:read'
  // HR Sync
  | 'hr:sync'
  | 'hr:read'
  // Analytics
  | 'analytics:read'
  // Webhooks
  | 'webhook:subscribe'
  | 'webhook:read'
  // Wildcard (admin)
  | 'order:*'
  | 'payment:*'
  | 'invoice:*'
  | 'pos:*'
  | 'hr:*'
  | 'analytics:*'
  | 'webhook:*';

/**
 * HTTP Methods
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Rate Limit Window Types
 */
export type RateLimitWindow = 'minute' | 'hour' | 'day';

// ============================================================================
// DATABASE TABLES
// ============================================================================

/**
 * API Partner Record (from api_partners table)
 */
export interface APIPartner {
  id: string;
  tenant_id: string;
  
  // Partner Identity
  partner_name: string;
  partner_type: PartnerType;
  partner_description?: string;
  contact_email?: string;
  contact_phone?: string;
  
  // API Authentication
  api_key: string;  // Format: pk_live_... or pk_test_...
  api_secret?: string;
  
  // Webhook Configuration
  webhook_url?: string;
  webhook_secret?: string;
  webhook_events?: string[];  // ['order.created', 'payment.received']
  
  // Access Control
  allowed_scopes: APIScope[];
  is_active: boolean;
  is_sandbox: boolean;
  
  // Rate Limiting
  rate_limit_tier: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  rate_limit_per_minute: number; // Legacy, prefer rate_limit_tier
  rate_limit_per_day: number; // Legacy, prefer rate_limit_tier
  rate_limit_burst: number; // Legacy
  
  // Usage Statistics
  last_request_at?: string;  // ISO timestamp
  total_requests_count: number;
  failed_requests_count: number;
  last_error_at?: string;
  last_error_message?: string;
  
  // Metadata
  metadata?: Record<string, unknown>;
  notes?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}


/**
 * API Request Log Record (from api_request_logs table)
 */
export interface APIRequestLog {
  id: string;
  partner_id: string;
  tenant_id: string;
  
  // Request Information
  method: HTTPMethod;
  endpoint: string;
  request_body?: Record<string, unknown>;
  request_headers?: Record<string, unknown>;
  query_params?: Record<string, unknown>;
  
  // Response Information
  status_code: number;
  response_body?: Record<string, unknown>;
  response_time_ms: number;
  
  // Error Tracking
  is_error: boolean;
  error_message?: string;
  error_code?: string;
  error_stack?: string;
  
  // Security & Audit
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  idempotency_key?: string;
  
  // Rate Limiting Context
  rate_limit_remaining?: number;
  rate_limit_reset_at?: string;
  
  // Metadata
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * API Rate Limit Counter Record (from api_rate_limit_counters table)
 */
export interface APIRateLimitCounter {
  id: string;
  partner_id: string;
  
  // Time Window
  window_start: string;
  window_type: RateLimitWindow;
  
  // Counters
  request_count: number;
  error_count: number;
  
  // Audit
  created_at: string;
  updated_at: string;
}

/**
 * Sandbox Metadata Record (from sandbox.sandbox_metadata table)
 * Tracks sandbox reset history per partner
 */
export interface SandboxMetadata {
  id: string;
  partner_id: string;
  
  // Reset tracking
  last_reset_at?: string;  // ISO timestamp of last sandbox reset
  reset_count: number;     // Number of times sandbox has been reset
  
  // Audit
  created_at: string;
  updated_at: string;
}

/**
 * API Partner Usage Summary (from api_partner_usage_summary view)
 */
export interface APIPartnerUsageSummary {
  partner_id: string;
  partner_name: string;
  partner_type: PartnerType;
  is_sandbox: boolean;
  tenant_id: string;
  
  // Stats (last 30 days)
  total_requests_30d: number;
  error_requests_30d: number;
  error_rate_percent: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  last_request_at?: string;
  
  // Rate Limits
  rate_limit_tier: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

// ============================================================================
// INPUT TYPES (for creating/updating partners)
// ============================================================================

/**
 * Create API Partner Input
 */
export interface CreateAPIPartnerInput {
  tenant_id: string;
  partner_name: string;
  partner_type: PartnerType;
  partner_description?: string;
  contact_email?: string;
  contact_phone?: string;
  
  // Authentication (api_key generated automatically if not provided)
  api_key?: string;
  api_secret?: string;
  
  // Webhook config
  webhook_url?: string;
  webhook_secret?: string;
  webhook_events?: string[];
  
  // Access control
  allowed_scopes: APIScope[];
  is_active?: boolean;
  is_sandbox?: boolean;
  
  // Rate limiting (defaults applied if not provided)
  rate_limit_tier?: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  rate_limit_per_minute?: number; // Legacy, prefer rate_limit_tier
  rate_limit_per_day?: number; // Legacy, prefer rate_limit_tier
  rate_limit_burst?: number; // Legacy
  
  // Metadata
  metadata?: Record<string, unknown>;
  notes?: string;
}

/**
 * Update API Partner Input
 */
export interface UpdateAPIPartnerInput {
  partner_name?: string;
  partner_description?: string;
  contact_email?: string;
  contact_phone?: string;
  
  // Webhook config
  webhook_url?: string;
  webhook_secret?: string;
  webhook_events?: string[];
  
  // Access control
  allowed_scopes?: APIScope[];
  is_active?: boolean;
  
  // Rate limiting
  rate_limit_tier?: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  rate_limit_per_minute?: number; // Legacy
  rate_limit_per_day?: number; // Legacy
  rate_limit_burst?: number; // Legacy
  
  // Metadata
  metadata?: Record<string, unknown>;
  notes?: string;
}

/**
 * Create API Request Log Input
 */
export interface CreateAPIRequestLogInput {
  partner_id: string;
  tenant_id: string;
  
  method: HTTPMethod;
  endpoint: string;
  request_body?: Record<string, unknown>;
  request_headers?: Record<string, unknown>;
  query_params?: Record<string, unknown>;
  
  status_code: number;
  response_body?: Record<string, unknown>;
  response_time_ms: number;
  
  is_error?: boolean;
  error_message?: string;
  error_code?: string;
  error_stack?: string;
  
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  idempotency_key?: string;
  
  rate_limit_remaining?: number;
  rate_limit_reset_at?: string;
  
  metadata?: Record<string, unknown>;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Standard API Response Wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    request_id?: string;
    rate_limit?: {
      limit: number;
      remaining: number;
      reset_at: string;
    };
    deprecation?: {
      message: string;
      sunset_date: string;
      replacement_endpoint?: string;
    };
  };
}

/**
 * Paginated API Response
 */
export interface PaginatedAPIResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  error?: {
    message: string;
    code: string;
  };
  meta?: {
    timestamp: string;
  };
}

/**
 * Partner Validation Result (from validate_api_partner function)
 */
export interface PartnerValidationResult {
  partner_id: string;
  tenant_id: string;
  partner_name: string;
  allowed_scopes: APIScope[];
  is_active: boolean;
  is_sandbox: boolean;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * API Error Codes
 */
export const API_ERROR_CODES = {
  // Authentication
  AUTH_001: 'Invalid API key',
  AUTH_002: 'API key inactive',
  AUTH_003: 'API key expired',
  
  // Authorization
  AUTHZ_001: 'Insufficient permissions',
  AUTHZ_002: 'Scope required',
  AUTHZ_003: 'Tenant mismatch',
  
  // Rate Limiting
  RATE_001: 'Rate limit exceeded (per minute)',
  RATE_002: 'Rate limit exceeded (per day)',
  RATE_003: 'Burst limit exceeded',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  
  // Validation
  VAL_001: 'Invalid request body',
  VAL_002: 'Missing required field',
  VAL_003: 'Invalid field format',
  
  // Tenant
  TENANT_001: 'Tenant not found',
  TENANT_002: 'Tenant inactive',
  
  // General
  SERVER_001: 'Internal server error',
  SERVER_002: 'Database error',
  SERVER_003: 'External service error',
} as const;

export type APIErrorCode = keyof typeof API_ERROR_CODES;

/**
 * API Error Class
 */
export class APIError extends Error {
  constructor(
    public code: APIErrorCode,
    message?: string,
    public details?: unknown,
    public statusCode: number = 500
  ) {
    super(message || API_ERROR_CODES[code]);
    this.name = 'APIError';
  }
}

// ============================================================================
// SCOPE PRESETS
// ============================================================================

/**
 * Predefined scope bundles for common partner types
 */
export const SCOPE_PRESETS: Record<string, APIScope[]> = {
  basic: [
    'order:read',
    'payment:read',
    'analytics:read',
  ],
  
  pos_integration: [
    'order:read',
    'order:write',
    'payment:read',
    'payment:write',
    'pos:sync',
    'pos:read',
  ],
  
  payment_gateway: [
    'order:read',
    'payment:read',
    'payment:write',
    'webhook:subscribe',
  ],
  
  hr_platform: [
    'hr:sync',
    'hr:read',
    'order:read',
    'analytics:read',
  ],
  
  invoice_provider: [
    'invoice:read',
    'invoice:create',
    'invoice:cancel',
    'order:read',
    'payment:read',
  ],
  
  admin: [
    'order:*',
    'payment:*',
    'invoice:*',
    'pos:*',
    'hr:*',
    'analytics:*',
    'webhook:*',
  ],
};


// ============================================================================
// SLA MONITORING & ALERTS (Phase 4 - Task #6)
// ============================================================================

/**
 * SLA Alert Severity Levels
 */
export type SLAAlertSeverity = 'info' | 'warning' | 'critical';

/**
 * SLA Alert Types
 */
export type SLAAlertType = 
  | 'uptime'          // Uptime dropped below threshold
  | 'latency'         // Response time exceeded threshold
  | 'error_rate'      // Error rate exceeded threshold
  | 'availability';   // Service unavailable

/**
 * SLA Alert Status
 */
export type SLAAlertStatus = 'active' | 'resolved' | 'acknowledged';

/**
 * Time Range Options for SLA Metrics
 */
export type SLATimeRange = '1h' | '24h' | '7d' | '30d';

/**
 * Notification Channel Types
 */
export type NotificationChannel = 'email' | 'webhook' | 'telegram' | 'slack';

/**
 * SLA Compliance Status
 */
export type SLAComplianceStatus = 'compliant' | 'at_risk' | 'breached' | 'unknown';

/**
 * SLA Metrics Summary
 */
export interface SLAMetrics {
  partner_id: string;
  time_range: SLATimeRange;
  
  // Uptime Metrics
  uptime_percent: number;           // e.g., 99.95
  downtime_minutes: number;         // Total downtime in minutes
  availability_status: 'up' | 'down' | 'degraded';
  
  // Latency Metrics
  avg_response_time_ms: number;     // Average response time
  p95_response_time_ms: number;     // 95th percentile
  p99_response_time_ms: number;     // 99th percentile
  max_response_time_ms: number;     // Maximum response time
  
  // Error Metrics
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  error_rate_percent: number;       // e.g., 2.5
  
  // Request Volume
  requests_per_minute_avg: number;
  requests_per_minute_peak: number;
  
  // Compliance
  compliance_status: SLAComplianceStatus;
  compliance_percent: number;       // Overall SLA compliance score (0-100)
  
  // Time Series Data for Charts
  time_series?: {
    timestamp: string;              // ISO timestamp
    requests: number;
    errors: number;
    avg_response_time: number;
    uptime_percent: number;
  }[];
  
  // Metadata
  calculated_at: string;            // ISO timestamp
  last_updated_at: string;
}

/**
 * SLA Threshold Configuration
 */
export interface SLAThresholds {
  // Uptime Target
  uptime_target_percent: number;    // e.g., 99.9 for "three nines"
  
  // Latency Targets
  p95_latency_ms: number;           // Max acceptable p95 latency
  p99_latency_ms: number;           // Max acceptable p99 latency
  
  // Error Rate Target
  error_rate_threshold_percent: number;  // e.g., 5.0
  
  // Availability
  max_consecutive_failures: number; // Trigger alert after N failures
}

/**
 * SLA Alert Rule Configuration
 */
export interface SLAAlertRule {
  id: string;
  partner_id: string;
  
  // Rule Settings
  alert_type: SLAAlertType;
  severity: SLAAlertSeverity;
  enabled: boolean;
  
  // Threshold
  threshold_value: number;          // Numeric threshold
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';  // Greater than, less than, etc.
  
  // Cooldown (prevent alert spam)
  cooldown_minutes: number;         // Wait N minutes before re-alerting
  
  // Notification Channels
  notification_channels: NotificationChannel[];
  
  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * SLA Alert Record
 */
export interface SLAAlert {
  id: string;
  partner_id: string;
  tenant_id: string;
  
  // Alert Details
  alert_type: SLAAlertType;
  severity: SLAAlertSeverity;
  status: SLAAlertStatus;
  
  // Alert Message
  title: string;                    // e.g., "High Error Rate Detected"
  message: string;                  // Detailed description
  
  // Metrics Snapshot
  metric_name: string;              // e.g., "error_rate_percent"
  metric_value: number;             // Actual value when alert triggered
  threshold_value: number;          // Configured threshold
  
  // Timeline
  triggered_at: string;             // ISO timestamp when alert fired
  acknowledged_at?: string;         // When someone acknowledged
  resolved_at?: string;             // When issue was resolved
  
  // Duration
  duration_minutes?: number;        // How long the issue lasted
  
  // Notification Status
  notification_sent: boolean;
  notification_channels_used: NotificationChannel[];
  
  // Metadata
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * SLA Configuration (per partner)
 */
export interface SLAConfig {
  partner_id: string;
  
  // Thresholds
  thresholds: SLAThresholds;
  
  // Alert Rules
  alert_rules: SLAAlertRule[];
  
  // Notification Settings
  notification_channels: {
    email?: {
      enabled: boolean;
      recipients: string[];         // Email addresses
    };
    webhook?: {
      enabled: boolean;
      url: string;
      secret?: string;
    };
    telegram?: {
      enabled: boolean;
      chat_id: string;
      bot_token: string;
    };
    slack?: {
      enabled: boolean;
      webhook_url: string;
    };
  };
  
  // Monitoring Settings
  monitoring_enabled: boolean;
  check_interval_seconds: number;   // How often to check SLA metrics
  
  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * SLA Report Summary
 */
export interface SLAReportSummary {
  partner_id: string;
  partner_name: string;
  time_range: SLATimeRange;
  
  // Overall Status
  overall_compliance: SLAComplianceStatus;
  compliance_score: number;         // 0-100
  
  // Individual Metrics Compliance
  uptime_compliant: boolean;
  latency_compliant: boolean;
  error_rate_compliant: boolean;
  
  // Alert Summary
  total_alerts: number;
  active_alerts: number;
  resolved_alerts: number;
  critical_alerts: number;
  warning_alerts: number;
  
  // Trends
  compliance_trend: 'improving' | 'stable' | 'degrading';
  
  // Report Metadata
  generated_at: string;
}

/**
 * Input: Get SLA Metrics
 */
export interface GetSLAMetricsInput {
  partner_id: string;
  time_range?: SLATimeRange;
  include_time_series?: boolean;   // Include time series data for charts
}

/**
 * Input: Get SLA Alerts
 */
export interface GetSLAAlertsInput {
  partner_id: string;
  severity?: SLAAlertSeverity;
  status?: SLAAlertStatus;
  alert_type?: SLAAlertType;
  time_range?: SLATimeRange;
  limit?: number;
  offset?: number;
}

/**
 * Input: Create/Update SLA Config
 */
export interface UpsertSLAConfigInput {
  partner_id: string;
  thresholds?: Partial<SLAThresholds>;
  alert_rules?: Partial<SLAAlertRule>[];
  notification_channels?: SLAConfig['notification_channels'];
  monitoring_enabled?: boolean;
  check_interval_seconds?: number;
}

/**
 * Input: Acknowledge Alert
 */
export interface AcknowledgeSLAAlertInput {
  alert_id: string;
  acknowledged_by: string;          // User ID or name
  notes?: string;
}

/**
 * Input: Resolve Alert
 */
export interface ResolveSLAAlertInput {
  alert_id: string;
  resolved_by: string;
  resolution_notes?: string;
}

/**
 * SLA Health Score Calculation
 */
export interface SLAHealthScore {
  overall_score: number;            // 0-100
  uptime_score: number;             // 0-100
  latency_score: number;            // 0-100
  error_rate_score: number;         // 0-100
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Predefined SLA Tier Presets
 */
export const SLA_TIER_PRESETS: Record<string, SLAThresholds> = {
  // 99% uptime, 500ms p95, 5% error rate
  basic: {
    uptime_target_percent: 99.0,
    p95_latency_ms: 500,
    p99_latency_ms: 1000,
    error_rate_threshold_percent: 5.0,
    max_consecutive_failures: 5,
  },
  
  // 99.5% uptime, 300ms p95, 3% error rate
  standard: {
    uptime_target_percent: 99.5,
    p95_latency_ms: 300,
    p99_latency_ms: 600,
    error_rate_threshold_percent: 3.0,
    max_consecutive_failures: 3,
  },
  
  // 99.9% uptime (three nines), 200ms p95, 1% error rate
  premium: {
    uptime_target_percent: 99.9,
    p95_latency_ms: 200,
    p99_latency_ms: 400,
    error_rate_threshold_percent: 1.0,
    max_consecutive_failures: 2,
  },
  
  // 99.99% uptime (four nines), 100ms p95, 0.5% error rate
  enterprise: {
    uptime_target_percent: 99.99,
    p95_latency_ms: 100,
    p99_latency_ms: 200,
    error_rate_threshold_percent: 0.5,
    max_consecutive_failures: 1,
  },
};
