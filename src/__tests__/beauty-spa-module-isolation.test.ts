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
    // The page now uses isBeautySpaEnabled (derived variable) instead of raw condition
    expect(servicesPageSource).toContain('isBeautySpaEnabled');
    expect(servicesPageSource).toContain('disabled={!canManageServices}');
  });

  it('does not let the KTV dashboard assume Babycare before tenant settings load', () => {
    const ktvDashboardSource = readSource('src/app/ktv/dashboard/page.tsx');
    const ktvSessionSectionsSource = readSource('src/app/ktv/dashboard/components/KtvSessionSections.tsx');

    expect(ktvDashboardSource).toContain('useState<TenantModuleKey | null>(null)');
    expect(ktvDashboardSource).not.toContain("useState<TenantModuleKey>('babycare')");

    expect(ktvSessionSectionsSource).toContain('tenantModuleKey: TenantModuleKey | null');
    expect(ktvSessionSectionsSource).toContain('getTenantModulePresentationOrNeutral(tenantModuleKey)');
    expect(ktvSessionSectionsSource).toContain("tenantModuleKey === 'babycare' ? Baby : UserRound");
  });
});
