import { ResourceProviderManifest, ResourceType } from './types';

/**
 * Enterprise Resource Registry for Bella EIP
 */
export class ResourceRegistry {
  private static instance: ResourceRegistry;
  private registry: Map<ResourceType, ResourceProviderManifest> = new Map();

  private constructor() {}

  public static getInstance(): ResourceRegistry {
    if (!ResourceRegistry.instance) {
      ResourceRegistry.instance = new ResourceRegistry();
    }
    return ResourceRegistry.instance;
  }

  public register(manifest: ResourceProviderManifest): void {
    this.registry.set(manifest.resourceType, manifest);
  }

  public get(resourceType: ResourceType): ResourceProviderManifest | undefined {
    return this.registry.get(resourceType);
  }

  public has(resourceType: ResourceType): boolean {
    return this.registry.has(resourceType);
  }
}

export const resourceRegistry = ResourceRegistry.getInstance();
