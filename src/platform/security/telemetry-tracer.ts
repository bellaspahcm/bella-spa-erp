/**
 * Bella AI Platform — Telemetry Tracer
 *
 * Implements Observability Law and Telemetry Error Isolation.
 * Traces execution durations, database queries, and failures without letting telemetry
 * engine crashes corrupt core business transactions.
 *
 * @module platform/security/telemetry-tracer
 */

import crypto from 'crypto';

export interface TelemetryTrace {
  readonly traceId: string;
  readonly tenantId: string;
  readonly vertical: 'education' | 'healthcare' | 'real-estate' | 'shared';
  readonly operation: string;
  readonly durationMs: number;
  readonly queryCount: number;
  readonly success: boolean;
  readonly error?: string;
}

export class TelemetryTracer {
  private static traces: TelemetryTrace[] = [];
  private static queryCounter = new Map<string, number>(); // traceId -> count

  public static clearTraces(): void {
    this.traces = [];
    this.queryCounter.clear();
  }

  // Fallback map helper since clear() is not on Map in old JS or TS versions if not polyfilled, but Map does have it.
  public static reset(): void {
    this.traces = [];
    this.queryCounter.clear();
  }

  public static getTraces(): TelemetryTrace[] {
    return [...this.traces];
  }

  public static startTrace(tenantId: string, vertical: TelemetryTrace['vertical'], operation: string): string {
    const traceId = crypto.randomUUID();
    this.queryCounter.set(traceId, 0);
    return traceId;
  }

  public static incrementQueryCount(traceId: string): void {
    if (this.queryCounter.has(traceId)) {
      const current = this.queryCounter.get(traceId) || 0;
      this.queryCounter.set(traceId, current + 1);
    }
  }

  public static endTrace(
    traceId: string,
    tenantId: string,
    vertical: TelemetryTrace['vertical'],
    operation: string,
    durationMs: number,
    success: boolean,
    error?: string
  ): void {
    try {
      // Enforce Telemetry Error Isolation: if telemetry fails (e.g. simulated connection exception),
      // we do not throw, preserving business database transaction.
      if (operation === 'simulated_telemetry_crash') {
        throw new Error('TELEMETRY_ENGINE_DISCONNECTED: Failed to reach metrics aggregator.');
      }

      const queryCount = this.queryCounter.get(traceId) || 0;
      this.queryCounter.delete(traceId);

      this.traces.push({
        traceId,
        tenantId,
        vertical,
        operation,
        durationMs,
        queryCount,
        success,
        error
      });
    } catch (err: unknown) {
      // Log warning but suppress error to isolate system failure (Production Failure Containment Law 7)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[Telemetry Warning] Telemetry trace failed to record: ${errorMessage}`);
    }
  }

  /**
   * Functional tracing wrapper wrapping core domain functions.
   */
  public static async trace<T>(
    tenantId: string,
    vertical: TelemetryTrace['vertical'],
    operation: string,
    fn: (traceId: string) => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    const traceId = this.startTrace(tenantId, vertical, operation);
    
    try {
      const result = await fn(traceId);
      const durationMs = Date.now() - start;
      this.endTrace(traceId, tenantId, vertical, operation, durationMs, true);
      return result;
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.endTrace(traceId, tenantId, vertical, operation, durationMs, false, errorMessage);
      throw err;
    }
  }
}
