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
  metadata?: Record<string, any>;
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
  request_body?: Record<string, any>;
  request_headers?: Record<string, any>;
  query_params?: Record<string, any>;
  
  // Response Information
  status_code: number;
  response_body?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  request_body?: Record<string, any>;
  request_headers?: Record<string, any>;
  query_params?: Record<string, any>;
  
  status_code: number;
  response_body?: Record<string, any>;
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
  
  metadata?: Record<string, any>;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Standard API Response Wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
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
export interface PaginatedAPIResponse<T = any> {
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
    public details?: any,
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

