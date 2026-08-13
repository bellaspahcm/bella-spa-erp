/**
 * Education OS — Policy Registry Public Contract Interface
 */

export interface PolicyValue<T> {
  readonly key: string;
  readonly value: T;
  readonly version: string;
}

export interface IPolicyRegistryContract {
  /**
   * Retrieves a typed policy value resolved dynamically for the given tenant.
   * Enforces configuration context isolation.
   *
   * @param tenantId The target tenant ID to fetch policy for.
   * @param key The policy key (e.g. 'education.max_credits').
   * @param requesterTenantId The tenant ID making the request (for context isolation validation).
   */
  getPolicy<T>(tenantId: string, key: string, requesterTenantId: string): Promise<PolicyValue<T>>;
}
