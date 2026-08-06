/**
 * 7-Step Plugin Lifecycle Loader for Bella Host Platform
 * Strictly zero usage of `any`.
 */

import type { ProductManifest } from './manifest';
import type { ExperienceMetadataRegistry } from './experience-registry';
import type { AICapabilityPack } from './ai-capability-pack';

export interface BaseCapabilityContract {
  readonly id: string;
  readonly version: string;
}

export interface CapabilityRegistryContract {
  register<T extends BaseCapabilityContract>(id: string, capability: T): void;
  has(id: string): boolean;
}

export class HealthcarePluginLoadException extends Error {
  constructor(reason: string) {
    super(`[PluginLoader] Critical Load Exception: ${reason}`);
    this.name = 'HealthcarePluginLoadException';
  }
}

export interface ProductPluginContract<TContext = unknown> {
  readonly manifest: ProductManifest;
  beforeLoad?(): Promise<void>;
  validate?(context: TContext): boolean;
  registerCapabilities(registry: CapabilityRegistryContract): void;
  registerExperience(registry: ExperienceMetadataRegistry): void;
  registerAICapabilityPack?(): AICapabilityPack;
  onInit?(context: TContext): Promise<void>;
  onReady?(): Promise<void>;
  onDestroy?(): Promise<void>;
}

export class PluginLoader {
  static async load<TContext>(
    plugin: ProductPluginContract<TContext>,
    capabilityRegistry: CapabilityRegistryContract,
    experienceRegistry: ExperienceMetadataRegistry,
    context: TContext
  ): Promise<void> {
    // Step 1: beforeLoad
    if (plugin.beforeLoad) {
      await plugin.beforeLoad();
    }

    // Step 2: validate
    if (plugin.validate && !plugin.validate(context)) {
      throw new HealthcarePluginLoadException(`Plugin validation failed for '${plugin.manifest.id}'`);
    }

    // Step 3: registerCapabilities
    plugin.registerCapabilities(capabilityRegistry);

    // Step 4: registerExperience
    plugin.registerExperience(experienceRegistry);

    // Step 5: registerAICapabilityPack (Optional)
    if (plugin.registerAICapabilityPack) {
      plugin.registerAICapabilityPack();
    }

    // Step 6: onInit
    if (plugin.onInit) {
      await plugin.onInit(context);
    }

    // Step 7: onReady
    if (plugin.onReady) {
      await plugin.onReady();
    }
  }
}
