/**
 * Notification Provider Interface
 * 
 * Abstract interface for notification providers (SMS, Email, Zalo).
 * All providers must implement this interface.
 * 
 * @module services/notifications/providers/provider-interface
 */

import type {
  SendNotificationInput,
  SendNotificationResult,
  ProviderConfig,
} from '../types';

/**
 * Abstract Notification Provider
 * 
 * All notification providers (SMS, Email, Zalo) must implement this interface.
 */
export abstract class NotificationProvider {
  protected config: ProviderConfig;
  protected providerName: string;

  constructor(config: ProviderConfig, providerName: string) {
    this.config = config;
    this.providerName = providerName;
  }

  /**
   * Send a notification via this provider
   * 
   * @param input - Notification details
   * @returns Result with success status, message ID, and error (if failed)
   */
  abstract send(input: SendNotificationInput): Promise<SendNotificationResult>;

  /**
   * Validate input before sending
   * 
   * @param input - Notification details
   * @returns True if valid, throws error if invalid
   */
  protected validateInput(input: SendNotificationInput): void {
    if (!input.entryId) {
      throw new Error('entryId is required');
    }
    if (!input.customerId) {
      throw new Error('customerId is required');
    }
    if (!input.tenantId) {
      throw new Error('tenantId is required');
    }
    if (!input.type) {
      throw new Error('notification type is required');
    }
    if (!input.data) {
      throw new Error('template data is required');
    }
    if (!input.recipient || !input.recipient.name) {
      throw new Error('recipient name is required');
    }
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.providerName;
  }

  /**
   * Format error for consistent logging
   */
  protected formatError(error: unknown): { message: string; code: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: (error as any).code || 'UNKNOWN_ERROR',
      };
    }
    return {
      message: String(error),
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Mock Provider (for testing/development)
 * 
 * Always returns success without actually sending anything.
 */
export class MockNotificationProvider extends NotificationProvider {
  constructor() {
    super(
      {
        enabled: true,
        maxRetries: 0,
        timeoutMs: 1000,
      },
      'mock'
    );
  }

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    this.validateInput(input);

    console.log(`[MockProvider] Would send ${input.type} via ${input.channel} to ${input.recipient.name}`);
    console.log(`[MockProvider] Message preview:`, input.data);

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      deliveryStatus: 'sent',
      metadata: {
        provider: 'mock',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
