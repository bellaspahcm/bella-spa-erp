/**
 * Bella AI Platform — Fault Injector Simulation Engine
 *
 * Implements 8B-L1 (Automated Resilience Verification) fault injection patterns.
 * Provides controls to simulate database deadlocks, cross-vertical failures,
 * and endpoint network latency / timeouts.
 *
 * @module platform/security/__tests__/8b-reliability/fault-injector
 */

export class FaultInjector {
  private static lockedTenants: Set<string> = new Set();
  private static crashedVerticals: Set<string> = new Set();
  private static delayedVerticals: Map<string, number> = new Map();

  public static lockTenant(tenantId: string): void {
    this.lockedTenants.add(tenantId);
  }

  public static unlockTenant(tenantId: string): void {
    this.lockedTenants.delete(tenantId);
  }

  public static crashVertical(verticalName: string): void {
    this.crashedVerticals.add(verticalName);
  }

  public static recoverVertical(verticalName: string): void {
    this.crashedVerticals.delete(verticalName);
  }

  public static delayVertical(verticalName: string, delayMs: number): void {
    this.delayedVerticals.set(verticalName, delayMs);
  }

  public static clearDelay(verticalName: string): void {
    this.delayedVerticals.delete(verticalName);
  }

  public static clear(): void {
    this.lockedTenants.clear();
    this.crashedVerticals.clear();
    this.delayedVerticals.clear();
  }

  /**
   * Wraps query execution to simulate database locks/deadlocks per tenant boundary.
   * Proves Tenant Fault Isolation.
   */
  public static async executeScopedQuery<T>(tenantId: string, operation: () => Promise<T>): Promise<T> {
    if (this.lockedTenants.has(tenantId)) {
      throw new Error(`DATABASE_TRANSACTION_DEADLOCK: Database connection acquired by tenant '${tenantId}' is locked.`);
    }
    return await operation();
  }

  /**
   * Intercepts vertical routers to inject synthetic crashes or network timeout latency.
   * Proves Cross-Vertical Fault Containment.
   */
  public static async routeVerticalCall<T>(vertical: string, operation: () => Promise<T>): Promise<T> {
    if (this.crashedVerticals.has(vertical)) {
      throw new Error(`VERTICAL_OS_CRASH: Vertical OS '${vertical}' encountered an unhandled service container crash.`);
    }

    const delay = this.delayedVerticals.get(vertical);
    if (delay !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return await operation();
  }
}
