/**
 * Integration Adapter Interface
 * 
 * Abstraction cho external integrations. Cho phép thêm integration connectors
 * mới (Zalo, Meta, SAP, Google, Banking) mà không cần sửa Core logic.
 * 
 * @example
 * ```typescript
 * class ZaloAdapter implements IIntegrationAdapter {
 *   readonly provider = 'zalo';
 *   readonly version = '1.0.0';
 *   
 *   async send(payload: IntegrationPayload) {
 *     const response = await zaloApi.sendMessage(payload.data);
 *     return { success: true, messageId: response.id };
 *   }
 *   
 *   async receive(webhook: WebhookPayload) {
 *     // Handle incoming Zalo webhook
 *     await processZaloEvent(webhook.data);
 *   }
 *   
 *   validate(config: IntegrationConfig) {
 *     if (!config.accessToken) {
 *       return { valid: false, errors: ['Missing accessToken'] };
 *     }
 *     return { valid: true };
 *   }
 *   
 *   async healthCheck() {
 *     const ok = await zaloApi.ping();
 *     return { healthy: ok, latency: 50 };
 *   }
 * }
 * ```
 */

/**
 * Integration payload for outgoing requests
 */
export interface IntegrationPayload<T = unknown> {
  /** Integration action type (e.g., 'send_message', 'create_order', 'sync_contact') */
  action: string;
  
  /** Action-specific data */
  data: T;
  
  /** Tenant context */
  tenantId: string;
  
  /** User context (optional) */
  userId?: string;
  
  /** Idempotency key (for retry safety) */
  idempotencyKey?: string;
  
  /** Request timeout in ms */
  timeout?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Integration result from outgoing requests
 */
export interface IntegrationResult<T = unknown> {
  /** Whether integration succeeded */
  success: boolean;
  
  /** Response data from external service */
  data?: T;
  
  /** Error message if failed */
  error?: string;
  
  /** Error code from external service */
  errorCode?: string;
  
  /** Whether request can be retried */
  retryable?: boolean;
  
  /** External service response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Webhook payload for incoming requests
 */
export interface WebhookPayload<T = unknown> {
  /** Webhook event type (e.g., 'message_received', 'payment_completed') */
  eventType: string;
  
  /** Event data from external service */
  data: T;
  
  /** Webhook signature for verification */
  signature?: string;
  
  /** Timestamp when webhook was sent */
  timestamp?: Date;
  
  /** External service's request ID */
  externalId?: string;
  
  /** Additional headers from webhook request */
  headers?: Record<string, string>;
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /** Integration provider (e.g., 'zalo', 'meta', 'sap') */
  provider: string;
  
  /** Whether integration is enabled */
  enabled: boolean;
  
  /** Tenant-specific configuration */
  tenantId: string;
  
  /** Provider-specific configuration (credentials, endpoints, etc.) */
  config: Record<string, unknown>;
  
  /** Rate limiting configuration (optional) */
  rateLimit?: {
    /** Max requests per window */
    maxRequests: number;
    /** Window duration in ms */
    windowMs: number;
  };
  
  /** Retry configuration (optional) */
  retry?: {
    /** Max retry attempts */
    maxAttempts: number;
    /** Initial delay in ms */
    initialDelay: number;
    /** Max delay in ms */
    maxDelay: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  
  /** Validation errors (if invalid) */
  errors?: string[];
  
  /** Validation warnings (non-blocking) */
  warnings?: string[];
}

/**
 * Health check status
 */
export interface HealthStatus {
  /** Whether integration is healthy */
  healthy: boolean;
  
  /** Response latency in ms */
  latency?: number;
  
  /** Error message if unhealthy */
  error?: string;
  
  /** Last successful check timestamp */
  lastCheck?: Date;
  
  /** Additional status details */
  details?: Record<string, unknown>;
}

/**
 * Integration Adapter Interface
 * 
 * Core abstraction for external integrations. All integration adapters must
 * implement this interface.
 * 
 * Design principles:
 * - Async: All operations are async
 * - Idempotent: Support idempotency keys for retry safety
 * - Reliable: Handle errors gracefully, support retries
 * - Secure: Validate webhook signatures, encrypt credentials
 * - Observable: Emit metrics and logs for monitoring
 */
export interface IIntegrationAdapter {
  /**
   * Provider unique identifier (e.g., 'zalo', 'meta', 'sap', 'google')
   */
  readonly provider: string;
  
  /**
   * Adapter version (semver format)
   */
  readonly version: string;
  
  /**
   * Provider display name (optional, for UI)
   */
  readonly displayName?: string;
  
  /**
   * Provider description (optional, for UI)
   */
  readonly description?: string;
  
  /**
   * Send data to external service
   * 
   * @param payload - Integration payload
   * @returns Integration result
   * @throws Error if request fails critically (non-retryable)
   * 
   * @example
   * ```typescript
   * const result = await adapter.send({
   *   action: 'send_message',
   *   data: {
   *     to: 'user-123',
   *     message: 'Hello from Bella ERP!'
   *   },
   *   tenantId: 'tenant-1',
   *   idempotencyKey: 'msg-456'
   * });
   * 
   * if (result.success) {
   *   console.log('Message sent:', result.data);
   * }
   * ```
   */
  send<TPayload = unknown, TResult = unknown>(
    payload: IntegrationPayload<TPayload>
  ): Promise<IntegrationResult<TResult>>;
  
  /**
   * Receive and process incoming webhook
   * 
   * @param webhook - Webhook payload
   * @returns void (throws on processing error)
   * 
   * @example
   * ```typescript
   * app.post('/webhooks/zalo', async (req, res) => {
   *   try {
   *     await adapter.receive({
   *       eventType: 'message_received',
   *       data: req.body,
   *       signature: req.headers['x-zalo-signature'],
   *       timestamp: new Date(),
   *       headers: req.headers
   *     });
   *     res.status(200).send('OK');
   *   } catch (err: unknown) {
   *     res.status(400).send('Invalid webhook');
   *   }
   * });
   * ```
   */
  receive<T = unknown>(webhook: WebhookPayload<T>): Promise<void>;
  
  /**
   * Validate integration configuration
   * 
   * @param config - Integration configuration
   * @returns Validation result
   * 
   * @example
   * ```typescript
   * const validation = adapter.validate({
   *   provider: 'zalo',
   *   enabled: true,
   *   tenantId: 'tenant-1',
   *   config: {
   *     accessToken: 'xxx',
   *     oaId: '123'
   *   }
   * });
   * 
   * if (!validation.valid) {
   *   console.error('Invalid config:', validation.errors);
   * }
   * ```
   */
  validate(config: IntegrationConfig): ConfigValidationResult;
  
  /**
   * Check if integration is healthy
   * 
   * Used for health checks and monitoring.
   * 
   * @returns Health status
   * 
   * @example
   * ```typescript
   * const health = await adapter.healthCheck();
   * if (!health.healthy) {
   *   console.error('Integration unhealthy:', health.error);
   * }
   * ```
   */
  healthCheck(): Promise<HealthStatus>;
  
  /**
   * Get supported actions (optional, for UI)
   * 
   * Returns list of actions this adapter supports.
   * Used by workflow designer UI.
   * 
   * @returns Array of action names
   * 
   * @example
   * ```typescript
   * adapter.getSupportedActions()
   * // ['send_message', 'send_notification', 'create_broadcast']
   * ```
   */
  getSupportedActions?(): string[];
  
  /**
   * Get action schema (optional, for UI)
   * 
   * Returns JSON Schema for action payload.
   * Used by workflow designer UI for validation.
   * 
   * @param action - Action name
   * @returns JSON Schema or undefined
   */
  getActionSchema?(action: string): Record<string, unknown> | undefined;
  
  /**
   * Close adapter and cleanup resources (optional)
   * 
   * Called on application shutdown.
   */
  close?(): Promise<void>;
}

/**
 * Helper function to create integration payload
 * 
 * @example
 * ```typescript
 * const payload = createIntegrationPayload({
 *   action: 'send_message',
 *   data: { to: 'user-123', message: 'Hello' },
 *   tenantId: 'tenant-1',
 *   idempotencyKey: 'msg-456'
 * });
 * ```
 */
export function createIntegrationPayload<T = unknown>(
  partial: Omit<IntegrationPayload<T>, 'metadata'> & { metadata?: Record<string, unknown> }
): IntegrationPayload<T> {
  return {
    timeout: 30000, // Default 30s
    ...partial
  };
}

/**
 * Helper function to create integration result
 * 
 * @example
 * ```typescript
 * return createIntegrationResult({
 *   success: true,
 *   data: { messageId: '123' }
 * });
 * ```
 */
export function createIntegrationResult<T = unknown>(
  partial: Partial<IntegrationResult<T>>
): IntegrationResult<T> {
  return {
    success: partial.success ?? false,
    data: partial.data,
    error: partial.error,
    errorCode: partial.errorCode,
    retryable: partial.retryable ?? false,
    metadata: partial.metadata
  };
}

/**
 * Base integration adapter class with common functionality
 * 
 * @example
 * ```typescript
 * class MyAdapter extends BaseIntegrationAdapter {
 *   readonly provider = 'my-service';
 *   readonly version = '1.0.0';
 *   
 *   async send(payload: IntegrationPayload) {
 *     // Implementation
 *     return this.successResult({ sent: true });
 *   }
 *   
 *   async receive(webhook: WebhookPayload) {
 *     if (!this.verifySignature(webhook)) {
 *       throw new Error('Invalid signature');
 *     }
 *     // Process webhook
 *   }
 * }
 * ```
 */
export abstract class BaseIntegrationAdapter implements IIntegrationAdapter {
  abstract readonly provider: string;
  abstract readonly version: string;
  readonly displayName?: string;
  readonly description?: string;
  
  abstract send<TPayload = unknown, TResult = unknown>(
    payload: IntegrationPayload<TPayload>
  ): Promise<IntegrationResult<TResult>>;
  
  abstract receive<T = unknown>(webhook: WebhookPayload<T>): Promise<void>;
  abstract healthCheck(): Promise<HealthStatus>;
  
  /**
   * Default validation: check if provider matches
   */
  validate(config: IntegrationConfig): ConfigValidationResult {
    if (config.provider !== this.provider) {
      return {
        valid: false,
        errors: [`Expected provider '${this.provider}', got '${config.provider}'`]
      };
    }
    if (!config.tenantId) {
      return {
        valid: false,
        errors: ['tenantId is required']
      };
    }
    return { valid: true };
  }
  
  /**
   * Helper: Create success result
   */
  protected successResult<T = unknown>(
    data?: T,
    metadata?: Record<string, unknown>
  ): IntegrationResult<T> {
    return { success: true, data, metadata };
  }
  
  /**
   * Helper: Create failure result
   */
  protected failureResult(
    error: string,
    errorCode?: string,
    retryable = false,
    metadata?: Record<string, unknown>
  ): IntegrationResult {
    return { success: false, error, errorCode, retryable, metadata };
  }
  
  /**
   * Helper: Create healthy status
   */
  protected healthyStatus(latency?: number, details?: Record<string, unknown>): HealthStatus {
    return {
      healthy: true,
      latency,
      lastCheck: new Date(),
      details
    };
  }
  
  /**
   * Helper: Create unhealthy status
   */
  protected unhealthyStatus(error: string, details?: Record<string, unknown>): HealthStatus {
    return {
      healthy: false,
      error,
      lastCheck: new Date(),
      details
    };
  }
}

/**
 * Integration adapter registry for managing multiple adapters
 * 
 * @example
 * ```typescript
 * const registry = new IntegrationAdapterRegistry();
 * registry.register(new ZaloAdapter());
 * registry.register(new MetaAdapter());
 * registry.register(new SAPAdapter());
 * 
 * const adapter = registry.getAdapter('zalo');
 * const result = await adapter.send(payload);
 * ```
 */
export class IntegrationAdapterRegistry {
  private adapters: Map<string, IIntegrationAdapter> = new Map();
  
  /**
   * Register a new adapter
   * @throws Error if adapter with same provider already exists
   */
  register(adapter: IIntegrationAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`Adapter '${adapter.provider}' already registered`);
    }
    this.adapters.set(adapter.provider, adapter);
  }
  
  /**
   * Get adapter by provider name
   * @throws Error if provider not found
   */
  getAdapter(provider: string): IIntegrationAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Adapter not found: ${provider}`);
    }
    return adapter;
  }
  
  /**
   * Check if provider is registered
   */
  hasAdapter(provider: string): boolean {
    return this.adapters.has(provider);
  }
  
  /**
   * Get all registered adapters
   */
  getAllAdapters(): IIntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * Get all registered provider names
   */
  getProviders(): string[] {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * Close all adapters
   */
  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.adapters.values())
        .filter(a => a.close)
        .map(a => a.close!())
    );
  }
  
  /**
   * Health check all adapters
   */
  async healthCheckAll(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};
    
    await Promise.all(
      Array.from(this.adapters.entries()).map(async ([provider, adapter]) => {
        try {
          results[provider] = await adapter.healthCheck();
        } catch (err: unknown) {
          results[provider] = {
            healthy: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            lastCheck: new Date()
          };
        }
      })
    );
    
    return results;
  }
}
