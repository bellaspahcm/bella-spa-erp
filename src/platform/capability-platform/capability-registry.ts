export interface CapabilityImplementation {
  key: string;
  execute: (params: Record<string, unknown>) => Promise<unknown> | unknown;
}

/**
 * Enterprise Capability Registry for Bella EIP
 */
export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private registry: Map<string, CapabilityImplementation> = new Map();

  private constructor() {}

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  public register(capability: CapabilityImplementation): void {
    this.registry.set(capability.key, capability);
  }

  public get(key: string): CapabilityImplementation | undefined {
    return this.registry.get(key);
  }

  public has(key: string): boolean {
    return this.registry.has(key);
  }
}

export const capabilityRegistry = CapabilityRegistry.getInstance();
