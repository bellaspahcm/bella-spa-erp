/**
 * Decision Engine Platform - Error Handling Utilities
 * 
 * Centralized error definitions and utilities for Decision Engine Platform.
 * All errors follow frozen architecture error handling strategy.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 18
 */

// Re-export errors from core modules
export { ProviderConflictError, ProviderNotFoundError } from '../core/DecisionProviderRegistry';
export { TimeoutError } from '../core/DecisionEngine';

/**
 * Base error for all Decision Engine errors
 */
export class DecisionEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DecisionEngineError';
  }
}

/**
 * Validation error (invalid context or result)
 */
export class ValidationError extends DecisionEngineError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Configuration error (invalid configuration)
 */
export class ConfigurationError extends DecisionEngineError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

/**
 * Provider evaluation error (provider failed to evaluate)
 */
export class ProviderEvaluationError extends DecisionEngineError {
  constructor(
    message: string,
    public readonly providerName: string,
    public readonly originalError?: Error
  ) {
    super(message, 'PROVIDER_EVALUATION_ERROR');
    this.name = 'ProviderEvaluationError';
  }
}

/**
 * Rule parsing error (invalid rule definition)
 */
export class RuleParsingError extends DecisionEngineError {
  constructor(message: string, public readonly rule?: unknown) {
    super(message, 'RULE_PARSING_ERROR');
    this.name = 'RuleParsingError';
  }
}

/**
 * Error code enum for programmatic error handling
 */
export enum DecisionEngineErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_CONTEXT = 'INVALID_CONTEXT',
  INVALID_RESULT = 'INVALID_RESULT',

  // Provider errors
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_CONFLICT = 'PROVIDER_CONFLICT',
  PROVIDER_EVALUATION_ERROR = 'PROVIDER_EVALUATION_ERROR',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',

  // Rule errors
  RULE_PARSING_ERROR = 'RULE_PARSING_ERROR',
  INVALID_RULE = 'INVALID_RULE',
  INVALID_CONDITION = 'INVALID_CONDITION',
  UNSUPPORTED_OPERATOR = 'UNSUPPORTED_OPERATOR',

  // Configuration errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',

  // System errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CATASTROPHIC_ERROR = 'CATASTROPHIC_ERROR',
}

/**
 * Check if error is a Decision Engine error
 */
export function isDecisionEngineError(error: unknown): error is DecisionEngineError {
  return error instanceof DecisionEngineError;
}

/**
 * Check if error is a specific error type
 */
export function isErrorOfType(
  error: unknown,
  errorType: new (...args: any[]) => Error
): boolean {
  return error instanceof errorType;
}

/**
 * Get error code from error
 */
export function getErrorCode(error: unknown): string {
  if (isDecisionEngineError(error)) {
    return error.code;
  }

  if (error instanceof Error) {
    return error.name;
  }

  return DecisionEngineErrorCode.UNKNOWN_ERROR;
}

/**
 * Format error message for logging
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

/**
 * Create error details object for logging
 */
export function createErrorDetails(error: unknown): {
  message: string;
  code: string;
  name: string;
  stack?: string;
  originalError?: unknown;
} {
  if (error instanceof DecisionEngineError) {
    return {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: getErrorCode(error),
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    code: DecisionEngineErrorCode.UNKNOWN_ERROR,
    name: 'UnknownError',
  };
}

/**
 * Wrap error with context
 */
export function wrapError(
  error: unknown,
  context: string,
  additionalInfo?: Record<string, unknown>
): DecisionEngineError {
  const originalMessage = error instanceof Error ? error.message : String(error);
  const message = `${context}: ${originalMessage}`;

  if (isDecisionEngineError(error)) {
    // Preserve original error type
    return error;
  }

  // Wrap in generic DecisionEngineError
  const wrappedError = new DecisionEngineError(
    message,
    getErrorCode(error)
  );

  if (error instanceof Error) {
    wrappedError.stack = error.stack;
  }

  if (additionalInfo) {
    Object.assign(wrappedError, additionalInfo);
  }

  return wrappedError;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error) => void | Promise<void>;

/**
 * Safe error handler (catches errors in error handler)
 */
export function safeErrorHandler(handler: ErrorHandler): ErrorHandler {
  return async (error: Error) => {
    try {
      await handler(error);
    } catch (handlerError) {
      console.error('Error handler failed:', handlerError);
      console.error('Original error:', error);
    }
  };
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    factor = 2,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelayMs * Math.pow(factor, attempt),
          maxDelayMs
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Error recovery strategies
 */
export const ErrorRecoveryStrategies = {
  /**
   * Return safe default (reject decision)
   */
  SAFE_DEFAULT: 'safe-default' as const,

  /**
   * Trigger manual review workflow
   */
  MANUAL_REVIEW: 'manual-review' as const,

  /**
   * Retry evaluation
   */
  RETRY: 'retry' as const,

  /**
   * Fallback to alternative provider
   */
  FALLBACK_PROVIDER: 'fallback-provider' as const,

  /**
   * Re-throw error (no recovery)
   */
  RETHROW: 'rethrow' as const,
};

export type ErrorRecoveryStrategy =
  (typeof ErrorRecoveryStrategies)[keyof typeof ErrorRecoveryStrategies];

/**
 * Get recommended recovery strategy for error
 */
export function getRecoveryStrategy(error: unknown): ErrorRecoveryStrategy {
  // Provider not found → Use safe default
  if (
    isErrorOfType(error, ProviderNotFoundError) ||
    getErrorCode(error) === DecisionEngineErrorCode.PROVIDER_NOT_FOUND
  ) {
    return ErrorRecoveryStrategies.SAFE_DEFAULT;
  }

  // Timeout → Retry
  if (
    isErrorOfType(error, TimeoutError) ||
    getErrorCode(error) === DecisionEngineErrorCode.PROVIDER_TIMEOUT
  ) {
    return ErrorRecoveryStrategies.RETRY;
  }

  // Provider evaluation error → Fallback provider
  if (
    isErrorOfType(error, ProviderEvaluationError) ||
    getErrorCode(error) === DecisionEngineErrorCode.PROVIDER_EVALUATION_ERROR
  ) {
    return ErrorRecoveryStrategies.FALLBACK_PROVIDER;
  }

  // Validation/parsing error → Safe default
  if (
    isErrorOfType(error, ValidationError) ||
    isErrorOfType(error, RuleParsingError)
  ) {
    return ErrorRecoveryStrategies.SAFE_DEFAULT;
  }

  // Default: Safe default
  return ErrorRecoveryStrategies.SAFE_DEFAULT;
}
