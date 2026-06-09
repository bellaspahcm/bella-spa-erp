import { readFileSync } from 'fs';

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

describe('beauty spa module isolation guards', () => {
  it('does not let the services page assume Babycare before tenant modules load', () => {
    const servicesHookSource = readSource('src/app/dashboard/services/hooks/useServicesPageState.ts');
    const servicesPageSource = readSource('src/app/dashboard/services/page.tsx');

    expect(servicesHookSource).toContain('const EMPTY_ENABLED_MODULES: TenantEnabledModules');
    expect(servicesHookSource).toContain('useState<TenantEnabledModules>(EMPTY_ENABLED_MODULES)');
    expect(servicesHookSource).toContain('setEnabledModules(EMPTY_ENABLED_MODULES)');
    expect(servicesHookSource).toContain('hasLoadedTenantModules');
    expect(servicesHookSource).not.toContain(
      'useState<TenantEnabledModules>(() => normalizeEnabledModules(null))',
    );

    expect(servicesPageSource).toContain('const canManageServices = hasLoadedTenantModules && enabledModuleOptions.length > 0');
    expect(servicesPageSource).toContain('const showModuleFilter = hasLoadedTenantModules && enabledModuleOptions.length > 1');
    expect(servicesPageSource).toContain('{hasLoadedTenantModules && enabledModules.babycare && (');
    expect(servicesPageSource).toContain('disabled={!canManageServices}');
  });
});
