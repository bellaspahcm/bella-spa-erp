/**
 * Decision Engine Platform - DecisionResult Type Definition
 * 
 * Standard output contract returned by all decision evaluations.
 * Provides primary decision, confidence level, rationale, recommended actions,
 * and execution metadata.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 8
 */

/**
 * Recommended action from decision evaluation
 */
export interface DecisionAction {
  /** Action type (e.g., 'approve', 'reject', 'escalate', 'discount') */
  type: string;
  
  /** Action data (action-specific parameters) */
  data: Record<string, unknown>;
}

/**
 * Error information (if evaluation failed but returned fallback result)
 */
export interface DecisionError {
  /** Error message */
  message: string;
  
  /** Error code (for programmatic handling) */
  code: string;
  
  /** Stack trace (for debugging) */
  stack?: string;
}

/**
 * DecisionResult - Standard output contract for Decision Engine Platform
 * 
 * This is the output structure returned by all decision evaluations. Business
 * modules receive this result and handle it according to their needs.
 * 
 * @example Simple Approval
 * ```typescript
 * {
 *   approved: true,
 *   confidence: 1.0,
 *   reason: 'Amount below auto-approval threshold',
 *   matchedRules: ['auto-approval-threshold-basic'],
 *   executionTime: 12,
 *   provider: 'RuleProvider',
 *   timestamp: new Date()
 * }
 * ```
 * 
 * @example Conditional Approval with Recommendations
 * ```typescript
 * {
 *   approved: true,
 *   confidence: 0.95,
 *   action: {
 *     type: 'approve-with-conditions',
 *     data: { suggestedDiscount: 0.05 }
 *   },
 *   reason: 'VIP customer with excellent history',
 *   recommendations: ['Offer 5% discount', 'Send VIP confirmation'],
 *   nextActions: ['Send confirmation', 'Notify assigned staff'],
 *   executionTime: 45,
 *   provider: 'RuleProvider',
 *   timestamp: new Date()
 * }
 * ```
 * 
 * @example Rejection with Alternatives
 * ```typescript
 * {
 *   approved: false,
 *   confidence: 1.0,
 *   action: {
 *     type: 'reject',
 *     data: { alternativeDates: ['2026-06-24', '2026-06-26'] }
 *   },
 *   reason: 'Requested date at full capacity',
 *   recommendations: ['Suggest alternative dates', 'Offer waiting list'],
 *   executionTime: 18,
 *   provider: 'RuleProvider',
 *   timestamp: new Date()
 * }
 * ```
 */
export interface DecisionResult {
  // ============ Core Decision ============
  
  /**
   * Primary decision outcome
   * - true = approved/accepted/positive
   * - false = rejected/declined/negative
   */
  approved: boolean;

  /**
   * Confidence level of the decision (0.0 to 1.0)
   * 
   * Confidence ranges:
   * - 1.0: Deterministic (e.g., rule-based exact match)
   * - 0.9-0.99: High confidence (e.g., BI with strong data)
   * - 0.7-0.89: Medium confidence (e.g., AI prediction)
   * - 0.5-0.69: Low confidence (e.g., insufficient data)
   * - <0.5: Very low confidence (consider manual review)
   */
  confidence: number;

  // ============ Decision Details ============
  
  /**
   * Recommended action (optional)
   * Tells business module what to do next
   */
  action?: DecisionAction;

  /**
   * Human-readable reason for the decision
   * Used for UI display and audit logs
   */
  reason?: string;

  /**
   * Matched rules (for rule-based providers)
   * Array of rule IDs that matched
   */
  matchedRules?: string[];

  /**
   * Recommendations (optional)
   * Suggestions for business user
   */
  recommendations?: string[];

  /**
   * Next actions (optional)
   * Workflow steps after this decision
   */
  nextActions?: string[];

  // ============ Metadata & Context ============
  
  /**
   * Provider-specific metadata
   * 
   * Examples:
   * - RuleProvider: { evaluatedConditions, matchedPath }
   * - BIProvider: { queryResult, threshold, actualValue }
   * - AIProvider: { modelVersion, featureImportance, explainability }
   */
  metadata?: Record<string, unknown>;

  // ============ Execution Context ============
  
  /**
   * Execution time in milliseconds
   * Used for performance monitoring
   */
  executionTime: number;

  /**
   * Provider that generated this result
   * @example 'RuleProvider', 'BIProvider', 'AIProvider'
   */
  provider: string;

  /**
   * Result timestamp
   * When the decision was made
   */
  timestamp: Date;

  // ============ Error Handling ============
  
  /**
   * Error information (if evaluation failed but returned fallback result)
   */
  error?: DecisionError;

  /**
   * Whether this is a fallback result (due to provider failure)
   */
  isFallback?: boolean;
}

/**
 * Create a successful DecisionResult
 * 
 * @param approved - Whether decision is approved
 * @param confidence - Confidence level (0.0 to 1.0)
 * @param options - Additional options
 * @returns DecisionResult
 * 
 * @example
 * ```typescript
 * const result = createSuccessResult(true, 1.0, {
 *   reason: 'Amount below threshold',
 *   matchedRules: ['auto-approval'],
 *   provider: 'RuleProvider',
 *   executionTime: 25
 * });
 * ```
 */
export function createSuccessResult(
  approved: boolean,
  confidence: number,
  options: {
    reason?: string;
    action?: DecisionAction;
    matchedRules?: string[];
    recommendations?: string[];
    nextActions?: string[];
    metadata?: Record<string, unknown>;
    provider: string;
    executionTime: number;
  }
): DecisionResult {
  return {
    approved,
    confidence: Math.max(0, Math.min(1, confidence)), // Clamp to [0, 1]
    reason: options.reason,
    action: options.action,
    matchedRules: options.matchedRules,
    recommendations: options.recommendations,
    nextActions: options.nextActions,
    metadata: options.metadata,
    executionTime: options.executionTime,
    provider: options.provider,
    timestamp: new Date(),
    isFallback: false,
  };
}

/**
 * Create a fallback DecisionResult (safe default on error)
 * 
 * @param error - Error that triggered fallback
 * @param provider - Provider name (or 'error-handler')
 * @param executionTime - Time until error occurred
 * @returns Fallback DecisionResult (rejected with zero confidence)
 * 
 * @example
 * ```typescript
 * const result = createFallbackResult(
 *   new Error('Provider timeout'),
 *   'RuleProvider',
 *   5000
 * );
 * ```
 */
export function createFallbackResult(
  error: Error,
  provider: string,
  executionTime: number
): DecisionResult {
  return {
    approved: false, // Safe default: reject when uncertain
    confidence: 0.0,
    reason: `Decision evaluation failed: ${error.message}. Safe default applied (reject).`,
    error: {
      message: error.message,
      code: error.name || 'UNKNOWN_ERROR',
      stack: error.stack,
    },
    isFallback: true,
    executionTime,
    provider: provider || 'error-handler',
    timestamp: new Date(),
  };
}

/**
 * Create error DecisionResult (provider not found, validation failed, etc.)
 * 
 * @param errorCode - Error code
 * @param errorMessage - Error message
 * @param provider - Provider name
 * @returns Error DecisionResult
 * 
 * @example
 * ```typescript
 * const result = createErrorResult(
 *   'PROVIDER_NOT_FOUND',
 *   'No provider found for rule type: ml-model',
 *   'error-handler'
 * );
 * ```
 */
export function createErrorResult(
  errorCode: string,
  errorMessage: string,
  provider: string = 'error-handler'
): DecisionResult {
  return {
    approved: false,
    confidence: 0.0,
    reason: errorMessage,
    error: {
      message: errorMessage,
      code: errorCode,
    },
    isFallback: true,
    executionTime: 0,
    provider,
    timestamp: new Date(),
  };
}

/**
 * Interpret DecisionResult and suggest handling strategy
 * 
 * @param result - Decision result to interpret
 * @returns Interpretation string
 * 
 * @example
 * ```typescript
 * const interpretation = interpretResult(result);
 * // "Auto-approve with high confidence"
 * ```
 */
export function interpretResult(result: DecisionResult): string {
  // Fallback result (error)
  if (result.isFallback) {
    return 'Manual review required due to system error';
  }

  // High confidence approval
  if (result.approved && result.confidence >= 0.9) {
    return 'Auto-approve with high confidence';
  }

  // Medium confidence approval
  if (result.approved && result.confidence >= 0.7) {
    return 'Approve but monitor closely';
  }

  // Low confidence approval (escalate)
  if (result.approved && result.confidence < 0.7) {
    return 'Requires manual review before approval';
  }

  // High confidence rejection
  if (!result.approved && result.confidence >= 0.9) {
    return 'Auto-reject with clear reason';
  }

  return 'Standard rejection';
}

/**
 * Validate DecisionResult structure
 * 
 * @param result - Result to validate
 * @throws Error if validation fails
 */
export function validateDecisionResult(result: DecisionResult): void {
  const errors: string[] = [];

  if (typeof result.approved !== 'boolean') {
    errors.push('approved must be boolean');
  }

  if (typeof result.confidence !== 'number') {
    errors.push('confidence must be number');
  } else if (result.confidence < 0 || result.confidence > 1) {
    errors.push('confidence must be between 0 and 1');
  }

  if (!result.provider) {
    errors.push('provider is required');
  }

  if (typeof result.executionTime !== 'number') {
    errors.push('executionTime must be number');
  }

  if (!(result.timestamp instanceof Date)) {
    errors.push('timestamp must be Date');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid DecisionResult: ${errors.join(', ')}`);
  }
}

/**
 * Sanitize DecisionResult for logging (remove sensitive metadata)
 * 
 * @param result - Result to sanitize
 * @returns Sanitized result safe for logging
 */
export function sanitizeDecisionResult(
  result: DecisionResult
): Partial<DecisionResult> {
  return {
    ...result,
    metadata: result.metadata
      ? {
          // Keep only non-sensitive metadata
          ...Object.fromEntries(
            Object.entries(result.metadata).filter(
              ([key]) =>
                !['credentials', 'token', 'apiKey'].some((s) =>
                  key.toLowerCase().includes(s)
                )
            )
          ),
        }
      : undefined,
    error: result.error
      ? {
          message: result.error.message,
          code: result.error.code,
          // Redact stack trace in production
          stack: process.env.NODE_ENV === 'development' ? result.error.stack : undefined,
        }
      : undefined,
  };
}
