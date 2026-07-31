import { verticalRegistry, VerticalManifest } from '../registry/vertical-registry';

export interface ResolvedTenantState {
  tenantId: string;
  activeModuleKey: string;
  activeManifest?: VerticalManifest;
  themeKey: string;
  enabledModules: string[];
}

/**
 * BELLA EIP Minimal Tenant Runtime Resolver
 * Resolves Tenant -> Manifest -> Theme -> Navigation -> Enabled Modules
 * Zero business logic, purely declarative metadata resolution.
 */
export class TenantRuntime {
  static resolve(tenantId: string, enabledModuleKeys: string[], requestedModuleKey?: string): ResolvedTenantState {
    const activeModuleKey = requestedModuleKey && enabledModuleKeys.includes(requestedModuleKey)
      ? requestedModuleKey
      : enabledModuleKeys[0] || 'beauty_spa';

    const activeManifest = verticalRegistry.get(activeModuleKey);

    return {
      tenantId,
      activeModuleKey,
      activeManifest,
      themeKey: activeManifest?.themeKey || (activeModuleKey === 'real_estate' ? 'real_estate' : 'beauty_spa'),
      enabledModules: enabledModuleKeys,
    };
  }
}
