/**
 * Base Provider Class
 * 
 * Abstract class cung cấp common functionality cho tất cả Booking Engine Providers
 */

import type { ProviderResult } from '../types';

export abstract class BaseBookingProvider {
  protected tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Create success result
   */
  protected success<T>(data: T, confidence?: number, metadata?: Record<string, any>): ProviderResult<T> {
    return {
      success: true,
      data,
      confidence,
      metadata,
    };
  }

  /**
   * Create error result
   */
  protected error(message: string, metadata?: Record<string, any>): ProviderResult {
    return {
      success: false,
      error: message,
      metadata,
    };
  }

  /**
   * Log provider activity (for observability)
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, context?: any): void {
    const logData = {
      provider: this.constructor.name,
      tenantId: this.tenantId,
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // TODO: Integrate với Observability Layer
    console.log(JSON.stringify(logData));
  }

  /**
   * Validate required fields
   */
  protected validateRequired(fields: Record<string, any>): void {
    const missing = Object.entries(fields)
      .filter(([_, value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}
