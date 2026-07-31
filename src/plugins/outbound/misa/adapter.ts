import { BaseIntegrationAdapter, IntegrationPayload, IntegrationResult, HealthStatus, IntegrationConfig, ConfigValidationResult } from '../../../lib/integrations/abstractions/IIntegrationAdapter';

export class MisaOutboundAdapter extends BaseIntegrationAdapter {
  readonly provider = 'misa';
  readonly version = '1.0.0';
  readonly displayName = 'MISA ERP Connector';
  readonly description = 'Outbound financial synchronization with MISA SME / AMIS ERP systems.';

  /**
   * Send financial data to MISA API
   */
  async send<TPayload = unknown, TResult = unknown>(
    payload: IntegrationPayload<TPayload>
  ): Promise<IntegrationResult<TResult>> {
    const { action, data, idempotencyKey } = payload;
    
    // Validate action
    if (!['sync_invoice', 'sync_expense', 'sync_salary', 'sync_journal'].includes(action)) {
      return this.failureResult(`Unsupported action: ${action}`, 'UNSUPPORTED_ACTION') as unknown as IntegrationResult<TResult>;
    }

    // Perform action mapping & validation
    try {
      this.validateActionData(action, data);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return this.failureResult(`Validation failed: ${errMsg}`, 'VALIDATION_ERROR') as unknown as IntegrationResult<TResult>;
    }

    const misaUrl = process.env.MISA_API_URL || 'https://api.misa.com.vn/v2';
    const misaToken = process.env.MISA_API_TOKEN || 'mock-token';

    let endpoint = '';
    switch (action) {
      case 'sync_invoice':
        endpoint = '/einvoice';
        break;
      case 'sync_expense':
        endpoint = '/expense';
        break;
      case 'sync_salary':
        endpoint = '/salary';
        break;
      case 'sync_journal':
        endpoint = '/journal';
        break;
    }

    const targetUrl = `${misaUrl}${endpoint}`;
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | null = null;
    let delay = 100; // start with small delay for testing/speed, dynamic backoff below

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), payload.timeout || 15000);

        if (process.env.MISA_API_URL) {
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${misaToken}`,
              'X-Idempotency-Key': idempotencyKey || '',
            },
            body: JSON.stringify(data),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            const body = await response.text();
            throw new Error(`MISA HTTP error ${response.status}: ${body}`);
          }
          
          const resultData = await response.json();
          return this.successResult(resultData as TResult, { attempt, url: targetUrl });
        } else {
          // Mock success
          clearTimeout(timeoutId);
          await new Promise((resolve) => setTimeout(resolve, 10)); // simulate latency
          
          return this.successResult({
            misa_ref_id: `misa-${action}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            synced_at: new Date().toISOString(),
            status: 'synced',
          } as unknown as TResult, { attempt, mock: true, url: targetUrl });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        lastError = err instanceof Error ? err : new Error(errMsg);
        console.warn(`[MisaOutboundAdapter] Attempt ${attempt} failed: ${errMsg}`);
        
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    }

    return this.failureResult(
      `Failed to sync to MISA after ${maxAttempts} attempts. Last error: ${lastError?.message}`,
      'MISA_SYNC_FAILED',
      true // retryable
    ) as unknown as IntegrationResult<TResult>;
  }

  /**
   * Webhooks are not expected for outbound sync, but interface requires receive()
   */
  async receive<T = unknown>(_webhook: { eventType: string; data: T }): Promise<void> {
    throw new Error('MISA Outbound Adapter does not support incoming webhooks');
  }

  /**
   * Check health of MISA external endpoint
   */
  async healthCheck(): Promise<HealthStatus> {
    const misaUrl = process.env.MISA_API_URL;
    if (!misaUrl) {
      return this.healthyStatus(5, { mock: true });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const start = Date.now();
      const response = await fetch(`${misaUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const latency = Date.now() - start;
      if (response.ok) {
        return this.healthyStatus(latency);
      } else {
        return this.unhealthyStatus(`HTTP Status ${response.status}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return this.unhealthyStatus(errMsg);
    }
  }

  /**
   * Validate config options
   */
  validate(config: IntegrationConfig): ConfigValidationResult {
    const base = super.validate(config);
    if (!base.valid) return base;

    const errors: string[] = [];
    const cfg = config.config || {};
    
    if (!cfg.apiUrl && !process.env.MISA_API_URL) {
      errors.push('Missing MISA API URL (apiUrl)');
    }
    if (!cfg.accessToken && !process.env.MISA_API_TOKEN) {
      errors.push('Missing MISA Access Token (accessToken)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateActionData(action: string, data: unknown) {
    const dataObj = data as Record<string, unknown> | null | undefined;
    if (!dataObj || typeof dataObj !== 'object') {
      throw new Error('Payload data must be an object');
    }
    
    switch (action) {
      case 'sync_invoice':
        if (dataObj.amount === undefined && dataObj.totalAmount === undefined && dataObj.total_price === undefined) {
          throw new Error('Invoice requires an amount (amount, totalAmount, or total_price)');
        }
        break;
      case 'sync_expense':
        if (dataObj.amount === undefined) {
          throw new Error('Expense requires an amount');
        }
        break;
      case 'sync_salary':
        if (dataObj.amount === undefined) {
          throw new Error('Salary requires an amount');
        }
        break;
      case 'sync_journal':
        if (!Array.isArray(dataObj.lines) && !dataObj.product_id) {
          throw new Error('Journal entry requires lines array or product transaction context');
        }
        break;
    }
  }
}
