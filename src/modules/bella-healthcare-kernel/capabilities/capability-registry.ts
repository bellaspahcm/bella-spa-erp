/**
 * Instance-Scoped Capability Registry for Healthcare Kernel Instance
 * Strictly zero singletons. Zero `any` allowed.
 */

export interface CapabilityItemContract {
  readonly id: string;
  readonly version: string;
}

export class ScopedCapabilityRegistry {
  private capabilities = new Map<string, CapabilityItemContract>();

  register<T extends CapabilityItemContract>(id: string, capability: T): void {
    if (this.capabilities.has(id)) {
      return;
    }
    this.capabilities.set(id, capability);
  }

  get<T extends CapabilityItemContract>(id: string): T {
    const cap = this.capabilities.get(id);
    if (!cap) {
      throw new Error(`[CapabilityRegistry] Capability '${id}' is not registered in this Kernel instance.`);
    }
    return cap as T;
  }

  has(id: string): boolean {
    return this.capabilities.has(id);
  }

  getAll(): readonly CapabilityItemContract[] {
    return Array.from(this.capabilities.values());
  }
}
