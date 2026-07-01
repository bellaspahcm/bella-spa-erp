/**
 * Base Connector for Marketing Intelligence
 * 
 * Abstract base class for all advertising platform connectors
 * (Facebook, Google, TikTok, Zalo)
 * 
 * Provides:
 * - Common sync logic and error handling
 * - Rate limiting with exponential backoff
 * - Retry mechanism for failed requests
 * - Connection testing
 * - Data validation
 */

import type { Platform, ExternalAdsDataRow } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConnectorConfig {
  platform: Platform;
  accessToken: string;
  accountId: string;
  tenantId: string;
  rateLimit?: number; // Requests per minute, default: 60
}

export interface SyncParams {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  level: 'campaign' | 'adset' | 'ad';
  campaignIds?: string[]; // Filter specific campaigns
}

export interface SyncResult {
  success: boolean;
  recordsCount: number;
  errorCount: number;
  errors: SyncError[];
  duration: number; // milliseconds
}

export interface SyncError {
  code: string;
  message: string;
  timestamp: string;
  retryable: boolean;
}

export type ConnectorErrorCode =
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'INVALID_ACCOUNT'
  | 'INVALID_PARAMS'
  | 'API_ERROR'
  | 'UNKNOWN_ERROR';

// ─── Connector Error Class ──────────────────────────────────────────────────

export class ConnectorError extends Error {
  code: ConnectorErrorCode;
  retryable: boolean;
  originalError?: any;

  constructor(
    code: ConnectorErrorCode,
    message: string,
    retryable: boolean = false,
    originalError?: any
  ) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.retryable = retryable;
    this.originalError = originalError;
  }
}


// ─── Base Connector Abstract Class ─────────────────────────────────────────

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected rateLimitDelay: number; // milliseconds between requests
  protected lastRequestTime: number = 0;

  constructor(config: ConnectorConfig) {
    this.config = config;
    // Calculate delay based on rate limit (default 60 req/min = 1000ms delay)
    const rateLimit = config.rateLimit || 60;
    this.rateLimitDelay = Math.ceil(60000 / rateLimit);
  }

  // ─── Abstract Methods (must be implemented by subclasses) ─────────────────

  /**
   * Fetch ad insights from platform API
   * Must be implemented by each connector
   */
  protected abstract fetchInsights(params: SyncParams): Promise<any[]>;

  /**
   * Map platform-specific response to internal format
   * Must be implemented by each connector
   */
  protected abstract mapToInternalFormat(data: any): Partial<ExternalAdsDataRow>;

  /**
   * Test API connection
   * Must be implemented by each connector
   */
  public abstract testConnection(): Promise<boolean>;

  // ─── Common Methods ────────────────────────────────────────────────────────

  /**
   * Main sync method - orchestrates the sync process
   */
  public async sync(params: SyncParams): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let recordsCount = 0;
    let errorCount = 0;

    try {
      // Validate params
      this.validateSyncParams(params);

      // Fetch data from platform
      const rawData = await this.fetchInsights(params);

      // Transform and validate each record
      for (const item of rawData) {
        try {
          const mapped = this.mapToInternalFormat(item);
          this.validateMappedData(mapped);
          recordsCount++;
          
          // TODO: Insert into database (external_ads_data table)
          // This would be done by the service layer, not connector
        } catch (error) {
          errorCount++;
          errors.push({
            code: 'MAPPING_ERROR',
            message: error instanceof Error ? error.message : 'Unknown mapping error',
            timestamp: new Date().toISOString(),
            retryable: false,
          });
        }
      }

      return {
        success: errorCount === 0,
        recordsCount,
        errorCount,
        errors,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        recordsCount,
        errorCount: errorCount + 1,
        errors: [
          ...errors,
          {
            code: error instanceof ConnectorError ? error.code : 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            retryable: error instanceof ConnectorError ? error.retryable : false,
          },
        ],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Rate limiting - enforce delay between requests
   */
  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await this.sleep(delay);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Retry with exponential backoff
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry non-retryable errors
        if (error instanceof ConnectorError && !error.retryable) {
          throw error;
        }
        
        // Calculate backoff delay: 1s, 2s, 4s, 8s, ...
        const delay = initialDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate sync parameters
   */
  protected validateSyncParams(params: SyncParams): void {
    if (!params.startDate || !params.endDate) {
      throw new ConnectorError('INVALID_PARAMS', 'Start date and end date are required');
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.startDate) || !dateRegex.test(params.endDate)) {
      throw new ConnectorError('INVALID_PARAMS', 'Invalid date format. Use YYYY-MM-DD');
    }

    // Validate level
    if (!['campaign', 'adset', 'ad'].includes(params.level)) {
      throw new ConnectorError('INVALID_PARAMS', 'Invalid level. Must be campaign, adset, or ad');
    }
  }

  /**
   * Validate mapped data before inserting to database
   */
  protected validateMappedData(data: Partial<ExternalAdsDataRow>): void {
    if (!data.platform) {
      throw new Error('Missing required field: platform');
    }
    if (!data.date) {
      throw new Error('Missing required field: date');
    }
    if (!data.external_campaign_id && !data.external_ad_id) {
      throw new Error('Missing required field: external_campaign_id or external_ad_id');
    }
  }

  /**
   * Get platform name
   */
  public getPlatform(): Platform {
    return this.config.platform;
  }

  /**
   * Get tenant ID
   */
  public getTenantId(): string {
    return this.config.tenantId;
  }
}
