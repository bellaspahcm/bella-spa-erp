/**
 * Base application error class
 * 
 * All custom errors in the application should extend this class.
 * Provides structured error handling with error codes and optional details
 * for logging and debugging.
 */
export class AppError extends Error {
  /**
   * Creates a new AppError instance
   * 
   * @param message - Human-readable error message
   * @param code - Machine-readable error code (e.g., 'BOOKING_NOT_FOUND')
   * @param details - Optional additional context about the error
   * 
   * @example
   * ```typescript
   * throw new AppError('Resource not available', 'RESOURCE_UNAVAILABLE', {
   *   resourceId: 123,
   *   requestedTime: '2024-01-15T10:00:00Z'
   * });
   * ```
   */
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes the error to JSON format for logging
   * 
   * @returns Object containing error name, message, code, and optional details
   * 
   * @example
   * ```typescript
   * const error = new AppError('Something went wrong', 'UNKNOWN_ERROR');
   * console.log(JSON.stringify(error.toJSON()));
   * // Output: {"name":"AppError","message":"Something went wrong","code":"UNKNOWN_ERROR"}
   * ```
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * Booking/Order related errors
 * 
 * Used for errors occurring during booking creation, modification,
 * cancellation, or resource scheduling operations.
 * 
 * @example
 * ```typescript
 * throw new BookingError(
 *   'KTV is not available at requested time',
 *   'KTV_UNAVAILABLE',
 *   { ktvId: 42, requestedTime: '2024-01-15T14:00:00Z' }
 * );
 * ```
 */
export class BookingError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'BookingError';
  }
}

/**
 * Payment processing errors
 * 
 * Used for errors during payment processing, refunds, transaction
 * validation, or payment gateway integration.
 * 
 * @example
 * ```typescript
 * throw new PaymentError(
 *   'Payment gateway timeout',
 *   'PAYMENT_GATEWAY_TIMEOUT',
 *   { transactionId: 'txn_123', gateway: 'stripe' }
 * );
 * ```
 */
export class PaymentError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'PaymentError';
  }
}

/**
 * Inventory management errors
 * 
 * Used for errors related to stock management, product availability,
 * inventory deduction, or stock level validation.
 * 
 * @example
 * ```typescript
 * throw new InventoryError(
 *   'Insufficient stock for checkout',
 *   'INSUFFICIENT_STOCK',
 *   { productId: 789, requested: 10, available: 5 }
 * );
 * ```
 */
export class InventoryError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'InventoryError';
  }
}

/**
 * Salary calculation errors
 * 
 * Used for errors during salary calculation, commission computation,
 * bonus determination, or payroll processing.
 * 
 * @example
 * ```typescript
 * throw new SalaryError(
 *   'Cannot calculate salary: attendance data incomplete',
 *   'INCOMPLETE_ATTENDANCE',
 *   { ktvId: 15, month: '2024-01', missingDays: 5 }
 * );
 * ```
 */
export class SalaryError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'SalaryError';
  }
}

/**
 * Validation errors
 * 
 * Used for input validation failures, schema validation errors,
 * or business rule validation violations.
 * 
 * @example
 * ```typescript
 * throw new ValidationError(
 *   'Invalid email format',
 *   'INVALID_EMAIL',
 *   { field: 'email', value: 'not-an-email' }
 * );
 * ```
 */
export class ValidationError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'ValidationError';
  }
}
