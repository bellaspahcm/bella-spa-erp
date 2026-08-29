/**
 * Kernel Protection Registry
 * 
 * Based on: KERNEL_PROTECTION_POLICY.md (APPROVED)
 * 
 * CRITICAL: E7 frozen registry is EXPLICIT artifacts, NOT wildcard.
 * 
 * Do NOT use prefix-based freezing:
 *   - fin_* ≠ frozen
 *   - hc_* ≠ frozen
 *   - inventory_* ≠ frozen
 * 
 * Authority = Registry + Ownership + Lifecycle + Contract Version
 */

export type KernelType = 'logistics' | 'healthcare' | 'finance';
export type LifecycleState = 'active' | 'frozen' | 'deprecated' | 'sunset';

export interface KernelArtifact {
  table: string;
  kernel: KernelType;
  contractVersion: string;
  lifecycle: LifecycleState;
  frozenDate?: string;
  testCount?: number;
  notes?: string;
}

/**
 * Kernel Registry
 * 
 * Each entry represents a specific artifact with explicit lifecycle state.
 * 
 * EXPLICIT ARTIFACTS ONLY — NO PREFIX WILDCARDS
 */
export const kernelRegistry: KernelArtifact[] = [
  // ========================================================================
  // LOGISTICS KERNEL — E7.1 (FROZEN)
  // ========================================================================
  {
    table: 'inventory_items',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'inventory_movements',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'warehouses',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'locations',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'movement_rules',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'movement_validations',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'inventory_snapshots',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'stock_levels',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'movement_types',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'location_types',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'warehouse_zones',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  {
    table: 'inventory_adjustments',
    kernel: 'logistics',
    contractVersion: 'E7.1',
    lifecycle: 'frozen',
    frozenDate: '2026-08-24',
    testCount: 366,
    notes: 'E7.1 baseline artifact — requires ACR to modify'
  },
  
  // ========================================================================
  // HEALTHCARE KERNEL — H1-H12 (FROZEN)
  // ========================================================================
  {
    table: 'hc_patients',
    kernel: 'healthcare',
    contractVersion: 'H1',
    lifecycle: 'frozen',
    notes: 'H1: Patient Identity — requires ACR to modify'
  },
  {
    table: 'hc_doctors',
    kernel: 'healthcare',
    contractVersion: 'H1',
    lifecycle: 'frozen',
    notes: 'H1: Provider Identity — requires ACR to modify'
  },
  {
    table: 'hc_encounters',
    kernel: 'healthcare',
    contractVersion: 'H2',
    lifecycle: 'frozen',
    notes: 'H2: Encounter Management — requires ACR to modify'
  },
  {
    table: 'hc_observations',
    kernel: 'healthcare',
    contractVersion: 'H3',
    lifecycle: 'frozen',
    notes: 'H3: Clinical Data — requires ACR to modify'
  },
  {
    table: 'hc_medications',
    kernel: 'healthcare',
    contractVersion: 'H4',
    lifecycle: 'frozen',
    notes: 'H4: Medication Management — requires ACR to modify'
  },
  {
    table: 'hc_procedures',
    kernel: 'healthcare',
    contractVersion: 'H5',
    lifecycle: 'frozen',
    notes: 'H5: Procedure Tracking — requires ACR to modify'
  },
  {
    table: 'hc_care_plans',
    kernel: 'healthcare',
    contractVersion: 'H6',
    lifecycle: 'frozen',
    notes: 'H6: Care Planning — requires ACR to modify'
  },
  {
    table: 'hc_clinical_notes',
    kernel: 'healthcare',
    contractVersion: 'H7',
    lifecycle: 'frozen',
    notes: 'H7: Documentation — requires ACR to modify'
  },
  {
    table: 'hc_diagnoses',
    kernel: 'healthcare',
    contractVersion: 'H8',
    lifecycle: 'frozen',
    notes: 'H8: Clinical Decision Support — requires ACR to modify'
  },
  {
    table: 'hc_allergies',
    kernel: 'healthcare',
    contractVersion: 'H9',
    lifecycle: 'frozen',
    notes: 'H9: Allergy Management — requires ACR to modify'
  },
  {
    table: 'hc_immunizations',
    kernel: 'healthcare',
    contractVersion: 'H10',
    lifecycle: 'frozen',
    notes: 'H10: Immunization Tracking — requires ACR to modify'
  },
  {
    table: 'hc_lab_results',
    kernel: 'healthcare',
    contractVersion: 'H11',
    lifecycle: 'frozen',
    notes: 'H11: Laboratory Results — requires ACR to modify'
  },
  
  // ========================================================================
  // FINANCE KERNEL — ACTIVE (NO FROZEN CONTRACT YET)
  // ========================================================================
  // NOTE: Finance OS is under active development.
  // No frozen contract baseline established yet.
  // Tables listed here are for reference only — NOT frozen.
  
  // When Finance Kernel freezes (e.g., F1 baseline established):
  // 1. Add specific artifacts to this registry
  // 2. Set lifecycle: 'frozen'
  // 3. Document contract version (F1, F2, etc.)
  // 4. Update tests
  // 5. Require ACR for modifications
  
  // Example (FUTURE — not current state):
  // {
  //   table: 'fin_accounts',
  //   kernel: 'finance',
  //   contractVersion: 'F1',
  //   lifecycle: 'frozen',
  //   frozenDate: 'TBD',
  //   notes: 'F1 baseline artifact — requires ACR to modify'
  // },
];

/**
 * Check if table is a Kernel artifact
 */
export function isKernelTable(tableName: string): boolean {
  return kernelRegistry.some(artifact => artifact.table === tableName);
}

/**
 * Get artifact metadata
 */
export function getKernelArtifact(tableName: string): KernelArtifact | undefined {
  return kernelRegistry.find(artifact => artifact.table === tableName);
}

/**
 * Check if artifact is frozen
 */
export function isFrozenContract(tableName: string): boolean {
  const artifact = getKernelArtifact(tableName);
  return artifact?.lifecycle === 'frozen';
}

/**
 * Check if artifact is active (can be evolved by Kernel Team)
 */
export function isActiveKernel(tableName: string): boolean {
  const artifact = getKernelArtifact(tableName);
  return artifact?.lifecycle === 'active';
}

/**
 * Get all frozen contracts
 */
export function getFrozenContracts(): KernelArtifact[] {
  return kernelRegistry.filter(artifact => artifact.lifecycle === 'frozen');
}

/**
 * Get contracts by Kernel
 */
export function getKernelContracts(kernel: KernelType): KernelArtifact[] {
  return kernelRegistry.filter(artifact => artifact.kernel === kernel);
}

/**
 * Validate registry integrity
 */
export function validateRegistry(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for duplicates
  const tables = kernelRegistry.map(a => a.table);
  const duplicates = tables.filter((t, i) => tables.indexOf(t) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate tables in registry: ${duplicates.join(', ')}`);
  }
  
  // Check frozen contracts have required metadata
  const frozen = kernelRegistry.filter(a => a.lifecycle === 'frozen');
  for (const artifact of frozen) {
    if (!artifact.contractVersion) {
      errors.push(`Frozen artifact '${artifact.table}' missing contractVersion`);
    }
    if (!artifact.frozenDate) {
      errors.push(`Frozen artifact '${artifact.table}' missing frozenDate`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Validate on module load
const validation = validateRegistry();
if (!validation.valid) {
  console.error('⚠️  Kernel Registry validation failed:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
}
