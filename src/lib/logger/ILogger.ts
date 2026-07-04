/**
 * Logger Interface
 * 
 * Simple logger abstraction for Decision Engine Platform.
 * Providers can be replaced (ConsoleLogger, FileLogger, CloudLogger, etc.)
 */

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log metadata (structured logging)
 */
export type LogMetadata = Record<string, unknown>;

/**
 * ILogger - Logger abstraction interface
 * 
 * @example
 * ```typescript
 * logger.info('Decision evaluated', {
 *   tenantId: 'bella-spa-vn',
 *   approved: true,
 *   executionTime: 42
 * });
 * ```
 */
export interface ILogger {
  /**
   * Log debug message (verbose, for development)
   */
  debug(message: string, metadata?: LogMetadata): void;

  /**
   * Log info message (normal operations)
   */
  info(message: string, metadata?: LogMetadata): void;

  /**
   * Log warning message (unexpected but handled)
   */
  warn(message: string, metadata?: LogMetadata): void;

  /**
   * Log error message (failures)
   */
  error(message: string, metadata?: LogMetadata): void;
}

/**
 * Console Logger (default implementation)
 */
export class ConsoleLogger implements ILogger {
  debug(message: string, metadata?: LogMetadata): void {
    console.debug(`[DEBUG] ${message}`, metadata || '');
  }

  info(message: string, metadata?: LogMetadata): void {
    console.info(`[INFO] ${message}`, metadata || '');
  }

  warn(message: string, metadata?: LogMetadata): void {
    console.warn(`[WARN] ${message}`, metadata || '');
  }

  error(message: string, metadata?: LogMetadata): void {
    console.error(`[ERROR] ${message}`, metadata || '');
  }
}

/**
 * No-op Logger (for testing)
 */
export class NoOpLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
