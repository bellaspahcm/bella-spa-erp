/**
 * Runtime Configuration Types
 * 
 * Configuration for Common Integration Runtime
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

/**
 * Runtime Configuration
 * 
 * Core runtime behavior configuration
 */
export interface RuntimeConfig {
  // Retry configuration
  retry: RetryConfig;
  
  // Outbox worker configuration
  outbox: OutboxConfig;
  
  // Idempotency configuration
  idempotency: IdempotencyConfig;
  
  // Quarantine configuration
  quarantine: QuarantineConfig;
  
  // Observability configuration
  observability: ObservabilityConfig;
}

/**
 * Retry Configuration
 * 
 * Exponential backoff with jitter
 */
export interface RetryConfig {
  // Maximum retry attempts before quarantine
  maxAttempts: number;
  
  // Initial delay (milliseconds)
  initialDelayMs: number;
  
  // Maximum delay (milliseconds)
  maxDelayMs: number;
  
  // Backoff multiplier
  backoffMultiplier: number;
  
  // Jitter (0.0 to 1.0, randomness added to delay)
  jitter: number;
  
  // Retryable error codes
  retryableErrors: string[];
}

/**
 * Outbox Configuration
 * 
 * Transactional outbox worker settings
 */
export interface OutboxConfig {
  // Polling interval (milliseconds)
  pollIntervalMs: number;
  
  // Batch size (number of intents per poll)
  batchSize: number;
  
  // Processing timeout (milliseconds)
  processingTimeoutMs: number;
  
  // Stale threshold (milliseconds, intent considered stuck)
  staleThresholdMs: number;
}

/**
 * Idempotency Configuration
 * 
 * Duplicate detection settings
 */
export interface IdempotencyConfig {
  // TTL for idempotency records (milliseconds)
  // After TTL, key can be reused (intentional replay allowed)
  ttlMs: number;
  
  // Hash algorithm (for idempotency key derivation)
  hashAlgorithm: 'sha256' | 'sha512';
}

/**
 * Quarantine Configuration
 * 
 * Poison message handling
 */
export interface QuarantineConfig {
  // Auto-retry from quarantine (dangerous, default false)
  autoRetry: boolean;
  
  // Alert threshold (number of quarantined intents triggers alert)
  alertThreshold: number;
  
  // Retention period (days)
  retentionDays: number;
}

/**
 * Observability Configuration
 * 
 * Tracing and audit settings
 */
export interface ObservabilityConfig {
  // Enable distributed tracing
  tracingEnabled: boolean;
  
  // Audit log retention (days)
  auditRetentionDays: number;
  
  // Log level
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  
  // Correlation ID propagation
  propagateCorrelationId: boolean;
}

/**
 * Default Runtime Configuration
 * 
 * Production-safe defaults
 */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  retry: {
    maxAttempts: 5,
    initialDelayMs: 1000,      // 1 second
    maxDelayMs: 60000,         // 1 minute
    backoffMultiplier: 2,
    jitter: 0.1,               // 10% jitter
    retryableErrors: [
      'NETWORK_ERROR',
      'TIMEOUT',
      'SERVICE_UNAVAILABLE',
      'TEMPORARY_FAILURE',
    ],
  },
  outbox: {
    pollIntervalMs: 5000,      // 5 seconds
    batchSize: 10,
    processingTimeoutMs: 30000, // 30 seconds
    staleThresholdMs: 300000,  // 5 minutes
  },
  idempotency: {
    ttlMs: 86400000,           // 24 hours
    hashAlgorithm: 'sha256',
  },
  quarantine: {
    autoRetry: false,          // Manual review required
    alertThreshold: 10,
    retentionDays: 30,
  },
  observability: {
    tracingEnabled: true,
    auditRetentionDays: 90,
    logLevel: 'INFO',
    propagateCorrelationId: true,
  },
};

/**
 * Tenant Context
 * 
 * Tenant identification and validation
 */
export interface TenantContext {
  tenantId: string;
  tenantName?: string;
  isActive: boolean;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Correlation Context
 * 
 * Distributed tracing context
 */
export interface CorrelationContext {
  correlationId: string;
  causationId?: string;      // Parent correlation ID (if nested)
  source: string;            // Originating service/module
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Idempotency Key Components
 * 
 * Components used to derive idempotency key
 */
export interface IdempotencyKeyComponents {
  tenantId: string;
  correlationId: string;
  intentType: string;
}
