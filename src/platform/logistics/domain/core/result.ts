/**
 * Result<T> Pattern for Domain Layer
 * 
 * Functional error handling without exceptions.
 * Ensures domain operations return explicit success/failure.
 * 
 * @example
 * ```typescript
 * const result = ItemDomain.create(props);
 * if (result.isSuccess) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */

export type Result<T> = Success<T> | Failure;

interface Success<T> {
  isSuccess: true;
  isFailure: false;
  value: T;
  error: null;
}

interface Failure {
  isSuccess: false;
  isFailure: true;
  value: null;
  error: string;
  errorCode?: string;
}

export const Result = {
  /**
   * Create success result
   */
  ok<T>(value: T): Result<T> {
    return {
      isSuccess: true,
      isFailure: false,
      value,
      error: null,
    };
  },

  /**
   * Create failure result
   */
  fail<T>(error: string, errorCode?: string): Result<T> {
    return {
      isSuccess: false,
      isFailure: true,
      value: null,
      error,
      errorCode,
    };
  },

  /**
   * Combine multiple results (all must succeed)
   */
  combine<T>(results: Result<T>[]): Result<T[]> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isFailure) {
        return result as Result<T[]>;
      }
      values.push(result.value);
    }
    return Result.ok(values);
  },
};
