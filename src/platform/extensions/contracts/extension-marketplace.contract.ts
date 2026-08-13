/**
 * Bella AI Platform — Extension Marketplace Contract Interfaces
 *
 * Defines the public interfaces for the Extension Platform, manifest schemas,
 * dynamic execution contexts, and capability permissions.
 *
 * @module platform/extensions/contracts/extension-marketplace.contract
 */

export interface ExtensionExecutionContext {
  readonly tenantId: string;
  readonly extensionId: string;
  readonly extensionVersion: string;
  readonly hookName: string;
  readonly correlationId: string;
}

export interface ExtensionManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly extensionApiVersion: string; // validated before execution/installation
  readonly targetVertical: 'education' | 'healthcare' | 'real-estate' | 'shared';
  readonly hooks: string[]; // Hook triggers (e.g. ['education.calculate_tuition'])
  readonly capabilities: string[]; // Mapped capabilities (e.g. ['education.tuition.calculate'])
}

export interface IExtensionMarketplaceContract {
  listMarketplaceExtensions(): Promise<readonly ExtensionManifest[]>;
  installExtension(tenantId: string, extensionId: string): Promise<void>;
  uninstallExtension(tenantId: string, extensionId: string): Promise<void>;
  executeExtensionHook<TInput, TOutput>(
    tenantId: string,
    hookName: string,
    input: TInput
  ): Promise<TOutput | null>;
}
