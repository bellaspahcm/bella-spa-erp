/**
 * Decision Engine Platform - DecisionContext Type Definition
 * 
 * Standard input contract for all decision evaluations.
 * Carries business context, decision metadata, provider instructions, and input data.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 7
 */

/**
 * User context for decision evaluation
 */
export interface DecisionUser {
  /** User ID */
  id: string;
  
  /** User role (e.g., 'admin', 'manager', 'staff', 'ktv') */
  role: string;
  
  /** User email (optional) */
  email?: string;
  
  /** User display name (optional) */
  name?: string;
  
  /** User permissions (optional) */
  permissions?: string[];
}

/**
 * Execution options for decision evaluation
 */
export interface DecisionOptions {
  /** Enable caching for this decision (default: true) */
  cache?: boolean;
  
  /** Cache TTL in seconds (default: 300) */
  cacheTTL?: number;
  
  /** Timeout for provider evaluation in ms (default: 5000) */
  timeout?: number;
  
  /** Fallback strategy if primary provider fails */
  fallback?: 'default' | 'manual' | 'error';
  
  /** Dry-run mode (evaluate but don't apply) */
  dryRun?: boolean;
}

/**
 * DecisionContext - Standard input contract for Decision Engine Platform
 * 
 * This is the input structure for all decision evaluations. Business modules
 * prepare this context and pass it to the Decision Engine.
 * 
 * @example
 * ```typescript
 * const context: DecisionContext = {
 *   tenantId: 'bella-spa-vietnam',
 *   module: 'booking',
 *   decisionType: 'auto-approval',
 *   ruleType: 'if-then',
 *   rule: {
 *     condition: { field: 'amount', operator: '<', value: 5000000 },
 *     action: { approve: true }
 *   },
 *   data: {
 *     amount: 3000000,
 *     customerTier: 'vip'
 *   }
 * };
 * ```
 */
export interface DecisionContext {
  // ============ Tenant & Module Context ============
  
  /**
   * Tenant identifier (multi-tenancy support)
   * @example 'bella-spa-vn', 'clinic-medcenter', 'factory-xyz'
   */
  tenantId: string;

  /**
   * Business module making the decision
   * @example 'payroll', 'booking', 'crm', 'inventory', 'finance'
   */
  module: string;

  /**
   * Type of decision being made (module-specific)
   * @example 'auto-approval', 'kpi-eligibility', 'discount-calculation'
   */
  decisionType: string;

  // ============ User & Authorization Context ============
  
  /**
   * User initiating the decision (optional)
   * Used for audit trail and authorization
   */
  user?: DecisionUser;

  // ============ Tracing & Correlation ============
  
  /**
   * Correlation ID for distributed tracing
   * Links decisions across services and workflows
   * Auto-generated if not provided
   */
  correlationId?: string;

  /**
   * Parent decision ID (for chained decisions)
   * @example Discount decision → Approval decision
   */
  parentDecisionId?: string;

  /**
   * Request timestamp (when decision was initiated)
   * Auto-set if not provided
   */
  timestamp?: Date;

  // ============ Provider Selection ============
  
  /**
   * Rule type determines which provider handles this decision
   * 
   * Supported types (extensible):
   * - 'if-then': Simple conditional rules (RuleProvider)
   * - 'decision-table': Table-based rules (RuleProvider)
   * - 'decision-tree': Tree-based rules (RuleProvider)
   * - 'bi-query': Business Intelligence queries (BIProvider - future)
   * - 'sql-query': Direct SQL queries (BIProvider - future)
   * - 'ml-model': Machine Learning models (AIProvider - future)
   * - 'ai-prediction': AI predictions (AIProvider - future)
   * - 'external-api': External service calls (ExternalProvider - future)
   * - 'manual-review': Human review (ManualProvider - future)
   * - 'composite': Chain multiple providers (CompositeProvider - future)
   */
  ruleType: string;

  /**
   * Rule definition (provider-specific structure)
   * 
   * For RuleProvider (if-then):
   * ```typescript
   * {
   *   condition: { field: 'amount', operator: '<', value: 5000000 },
   *   action: { approve: true }
   * }
   * ```
   * 
   * For BIProvider (bi-query - future):
   * ```typescript
   * {
   *   query: 'SELECT approval_rate FROM metrics WHERE segment = :segment',
   *   params: { segment: 'vip' },
   *   threshold: 0.8
   * }
   * ```
   * 
   * For AIProvider (ml-model - future):
   * ```typescript
   * {
   *   modelId: 'booking-approval-v2',
   *   features: ['amount', 'customerHistory', 'seasonality']
   * }
   * ```
   */
  rule: unknown;

  // ============ Input Data ============
  
  /**
   * Data to evaluate (facts for decision-making)
   * 
   * Example for booking approval:
   * ```typescript
   * {
   *   amount: 8000000,
   *   customerTier: 'vip',
   *   bookingHistory: { total: 15, cancelled: 1 },
   *   capacity: 0.8,
   *   seasonality: 'peak'
   * }
   * ```
   * 
   * Example for KPI eligibility:
   * ```typescript
   * {
   *   totalSessions: 28,
   *   avgRating: 4.7,
   *   violations: 0
   * }
   * ```
   */
  data: Record<string, unknown>;

  // ============ Metadata & Extensions ============
  
  /**
   * Additional context (module-specific)
   * 
   * Examples:
   * - Booking: { customerId, packageId, serviceDate }
   * - Payroll: { employeeId, month, year }
   * - CRM: { leadId, campaignId, source }
   */
  metadata?: Record<string, unknown>;

  /**
   * Execution options (advanced)
   */
  options?: DecisionOptions;
}

/**
 * Factory function to create DecisionContext with defaults
 * 
 * @param partial - Partial context (required fields must be provided)
 * @returns Complete DecisionContext with defaults applied
 * 
 * @example
 * ```typescript
 * const context = createDecisionContext({
 *   tenantId: 'bella-spa-vn',
 *   module: 'booking',
 *   decisionType: 'auto-approval',
 *   ruleType: 'if-then',
 *   rule: autoApprovalRule,
 *   data: { amount: 3000000 }
 * });
 * ```
 */
export function createDecisionContext(
  partial: Omit<DecisionContext, 'correlationId' | 'timestamp'> & {
    correlationId?: string;
    timestamp?: Date;
  }
): DecisionContext {
  return {
    ...partial,
    correlationId: partial.correlationId || generateCorrelationId(),
    timestamp: partial.timestamp || new Date(),
    options: {
      cache: true,
      cacheTTL: 300,
      timeout: 5000,
      fallback: 'default',
      dryRun: false,
      ...partial.options,
    },
  };
}

/**
 * Validate DecisionContext structure
 * 
 * @param context - Context to validate
 * @throws Error if validation fails
 */
export function validateDecisionContext(context: DecisionContext): void {
  const errors: string[] = [];

  if (!context.tenantId) errors.push('tenantId is required');
  if (!context.module) errors.push('module is required');
  if (!context.decisionType) errors.push('decisionType is required');
  if (!context.ruleType) errors.push('ruleType is required');
  if (!context.rule) errors.push('rule is required');
  if (!context.data) errors.push('data is required');

  if (errors.length > 0) {
    throw new Error(`Invalid DecisionContext: ${errors.join(', ')}`);
  }
}

/**
 * Sanitize DecisionContext for logging (remove sensitive data)
 * 
 * @param context - Context to sanitize
 * @returns Sanitized context safe for logging
 */
export function sanitizeDecisionContext(
  context: DecisionContext
): Partial<DecisionContext> {
  const sensitiveFields = ['password', 'token', 'apiKey', 'ssn', 'creditCard'];

  return {
    ...context,
    data: Object.fromEntries(
      Object.entries(context.data).map(([key, value]) => {
        if (sensitiveFields.some((s) => key.toLowerCase().includes(s))) {
          return [key, '***REDACTED***'];
        }
        return [key, value];
      })
    ),
    user: context.user
      ? {
          id: context.user.id,
          role: context.user.role,
          // Redact email
          email: context.user.email ? '***@***' : undefined,
        }
      : undefined,
  };
}

/**
 * Generate unique correlation ID
 * @returns UUID v4 string
 */
function generateCorrelationId(): string {
  // Simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
