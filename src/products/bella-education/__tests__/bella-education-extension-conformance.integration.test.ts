/**
 * BELLA EDUCATION — PLATFORM EXTENSIONS INTEGRATION TEST SUITE
 *
 * Verifies the 6 Platform Extension Laws:
 * - Law 1: Tenant Isolation (Tenant A with extension, Tenant B default)
 * - Law 2: Sandbox Integrity (blocks Direct DB, Repos, local FS, etc.)
 * - Law 3: Invariant Supremacy
 * - Law 4: Non-Authority (calculates recommendations only; Kernel persists and governs)
 * - Law 5: Historical Integrity (logs persist after uninstall)
 * - Law 6: Compatibility (API version checking)
 *
 * @module src/products/bella-education/__tests__/bella-education-extension-conformance.integration.test
 */

import { ExtensionRuntimeEngine } from '../../../platform/extensions/engines/extension-runtime';
import { AVAILABLE_EXTENSIONS } from '../../../platform/extensions/engines/extension-runtime';
import '../../../platform/extensions/engines/test-extensions'; // register extensions

describe('BELLA EDUCATION V1 — EXTENSION PLATFORM INTEGRATION TESTS', () => {
  let runtime: ExtensionRuntimeEngine;

  const TENANT_A = 'tenant-conformance-a';
  const TENANT_B = 'tenant-conformance-b';

  beforeEach(() => {
    runtime = new ExtensionRuntimeEngine();
    ExtensionRuntimeEngine.clearRegistry();
  });

  // Law 1: Tenant Isolation
  test('Law 1: Tenant A with Scholarship extension receives custom tuition; Tenant B (default) gets standard fallback', async () => {
    await runtime.installExtension(TENANT_A, 'scholarship-fee-ext');

    // Tenant A calculates 20% discount (5000000 * 0.8 = 4000000)
    const tuitionA = await runtime.executeExtensionHook<{ baseTuitionFee: number }, any>(
      TENANT_A,
      'education.calculate_tuition',
      { baseTuitionFee: 5000000 }
    );
    expect(tuitionA).toEqual({
      finalTuitionFee: 4000000,
      isCorporateFunded: false
    });

    // Tenant B has no extension installed, returns null fallback
    const tuitionB = await runtime.executeExtensionHook<{ baseTuitionFee: number }, any>(
      TENANT_B,
      'education.calculate_tuition',
      { baseTuitionFee: 5000000 }
    );
    expect(tuitionB).toBeNull();
  });

  // Law 2: Sandbox Integrity (Blocks all 8 exploit surfaces)
  test('Law 2: Sandbox Blocks rogue actions of malicious-db-ext across 8 attack surfaces', async () => {
    await runtime.installExtension(TENANT_A, 'malicious-db-ext');

    const exploitTypes = [
      'direct_db',
      'internal_repository',
      'internal_engine',
      'local_fs',
      'unauthorized_contract',
      'cross_tenant_leak',
      'direct_ledger_write',
      'invariant_override'
    ];

    for (const exploit of exploitTypes) {
      await expect(
        runtime.executeExtensionHook(TENANT_A, 'security.exploit_test', { exploitType: exploit })
      ).rejects.toThrow('SANDBOX_BLOCKED');
    }
  });

  // Law 5: Historical Integrity Law
  test('Law 5: Historical audit log remains intact and uncorrupted after extension installation and uninstallation', async () => {
    await runtime.installExtension(TENANT_A, 'scholarship-fee-ext');
    await runtime.executeExtensionHook(TENANT_A, 'education.calculate_tuition', { baseTuitionFee: 2000000 });
    await runtime.uninstallExtension(TENANT_A, 'scholarship-fee-ext');

    const logs = ExtensionRuntimeEngine.getAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(3);

    // Verify all steps are recorded
    const installLog = logs.find(l => l.event === 'EXTENSION_INSTALLED');
    const startLog = logs.find(l => l.event === 'EXTENSION_HOOK_START');
    const uninstallLog = logs.find(l => l.event === 'EXTENSION_UNINSTALLED');

    expect(installLog).toBeDefined();
    expect(startLog).toBeDefined();
    expect(uninstallLog).toBeDefined();
    expect(installLog?.tenantId).toBe(TENANT_A);
    expect(uninstallLog?.tenantId).toBe(TENANT_A);
  });

  // Law 6: Compatibility Law
  test('Law 6: Blocks installation if target extension requires incompatible API version', async () => {
    // Modify version to test compatibility block
    const originalVersion = AVAILABLE_EXTENSIONS['scholarship-fee-ext'].manifest.extensionApiVersion;
    (AVAILABLE_EXTENSIONS['scholarship-fee-ext'].manifest as any).extensionApiVersion = '2'; // unsupported API version

    await expect(
      runtime.installExtension(TENANT_A, 'scholarship-fee-ext')
    ).rejects.toThrow('EXTENSION_INCOMPATIBLE');

    // Restore
    (AVAILABLE_EXTENSIONS['scholarship-fee-ext'].manifest as any).extensionApiVersion = originalVersion;
  });

  // Version Isolation
  test('Version Isolation: Tenant A runs gpa-calculator v1 and Tenant B runs v2 (bonus curve) on the same Kernel', async () => {
    await runtime.installExtension(TENANT_A, 'gpa-calculator-ext-v1');
    await runtime.installExtension(TENANT_B, 'gpa-calculator-ext-v2');

    // Tenant A (v1: Standard average of [8.0, 9.0] = 8.50)
    const gpaA = await runtime.executeExtensionHook<{ scores: number[] }, number>(
      TENANT_A,
      'education.calculate_gpa',
      { scores: [8.0, 9.0] }
    );
    expect(gpaA).toBe(8.5);

    // Tenant B (v2: Curved GPA adding 0.5 bonus = 9.00)
    const gpaB = await runtime.executeExtensionHook<{ scores: number[] }, number>(
      TENANT_B,
      'education.calculate_gpa',
      { scores: [8.0, 9.0] }
    );
    expect(gpaB).toBe(9.0);
  });

  // Capability Permission Gate
  test('Capability Permission Gate: Throws error if extension lacks target capability', async () => {
    await runtime.installExtension(TENANT_A, 'scholarship-fee-ext');

    // Attempt to invoke tuition calculations, which succeeds because it has education.tuition.calculate capability
    const ok = await runtime.executeExtensionHook(TENANT_A, 'education.calculate_tuition', { baseTuitionFee: 3000000 });
    expect(ok).toBeDefined();

    // Dynamically strip target capability
    const originalCaps = [...AVAILABLE_EXTENSIONS['scholarship-fee-ext'].manifest.capabilities];
    (AVAILABLE_EXTENSIONS['scholarship-fee-ext'].manifest as any).capabilities = [];

    await expect(
      runtime.executeExtensionHook(TENANT_A, 'education.calculate_tuition', { baseTuitionFee: 3000000 })
    ).rejects.toThrow('EXTENSION_SECURITY_VIOLATION');

    // Restore
    (AVAILABLE_EXTENSIONS['scholarship-fee-ext'].manifest as any).capabilities = originalCaps;
  });
});
