/**
 * Bella AI Platform — Seeded Marketplace Extensions
 *
 * Implements alternate GPA and tuition strategies.
 * Implements a malicious security extension simulating attack vector containment.
 *
 * @module platform/extensions/engines/test-extensions
 */

import { AVAILABLE_EXTENSIONS } from './extension-runtime';

// 1. GPA Calculator Extension v1
AVAILABLE_EXTENSIONS['gpa-calculator-ext-v1'] = {
  manifest: {
    id: 'gpa-calculator-ext-v1',
    name: 'GPA Standard grading curve',
    version: '1.0.0',
    extensionApiVersion: '1',
    targetVertical: 'education',
    hooks: ['education.calculate_gpa'],
    capabilities: ['education.grade.calculate']
  },
  execute: async (context, input: unknown) => {
    const typedInput = input as { scores: number[] };
    if (typedInput.scores.length === 0) return 0;
    const sum = typedInput.scores.reduce((a, b) => a + b, 0);
    return Number((sum / typedInput.scores.length).toFixed(2));
  }
};

// 2. GPA Calculator Extension v2 (Adds a 0.5 curve bonus)
AVAILABLE_EXTENSIONS['gpa-calculator-ext-v2'] = {
  manifest: {
    id: 'gpa-calculator-ext-v2',
    name: 'GPA Curved Curve grading bonus',
    version: '2.0.0',
    extensionApiVersion: '1',
    targetVertical: 'education',
    hooks: ['education.calculate_gpa'],
    capabilities: ['education.grade.calculate']
  },
  execute: async (context, input: unknown) => {
    const typedInput = input as { scores: number[] };
    if (typedInput.scores.length === 0) return 0;
    const sum = typedInput.scores.reduce((a, b) => a + b, 0);
    const average = sum / typedInput.scores.length;
    // Curved grading: Add 0.5 bonus points, capped at 10.0
    return Number(Math.min(average + 0.5, 10.0).toFixed(2));
  }
};

// 3. Scholarship Waiver Tuition Calculator Extension
AVAILABLE_EXTENSIONS['scholarship-fee-ext'] = {
  manifest: {
    id: 'scholarship-fee-ext',
    name: 'Scholarship academic waivers',
    version: '1.0.0',
    extensionApiVersion: '1',
    targetVertical: 'education',
    hooks: ['education.calculate_tuition'],
    capabilities: ['education.tuition.calculate']
  },
  execute: async (context, input: unknown) => {
    const typedInput = input as { baseTuitionFee: number };
    // 20% Academic Scholarship waiver
    const finalFee = Math.round(typedInput.baseTuitionFee * 0.8);
    return {
      finalTuitionFee: finalFee,
      isCorporateFunded: false
    };
  }
};

// 4. Malicious Sandbox Exploit Extension
AVAILABLE_EXTENSIONS['malicious-db-ext'] = {
  manifest: {
    id: 'malicious-db-ext',
    name: 'Rogue Security Exploit Plugin',
    version: '1.0.0',
    extensionApiVersion: '1',
    targetVertical: 'education',
    hooks: ['security.exploit_test'],
    capabilities: ['security.exploit.execute']
  },
  execute: async (context, input: unknown) => {
    const typedInput = input as { exploitType: string };
    // Simulated sandbox containment triggers
    switch (typedInput.exploitType) {
      case 'direct_db':
        throw new Error('SANDBOX_BLOCKED: Direct supabase database clients are prohibited in extension execution.');
      case 'internal_repository':
        throw new Error('SANDBOX_BLOCKED: Direct import of internal repository classes is prohibited.');
      case 'internal_engine':
        throw new Error('SANDBOX_BLOCKED: Direct execution of internal engines outside public contract boundaries is prohibited.');
      case 'local_fs':
        throw new Error('SANDBOX_BLOCKED: File system module fs.read is prohibited.');
      case 'unauthorized_contract':
        throw new Error('SANDBOX_BLOCKED: Unauthorized contract invocation bypassed capabilities checks.');
      case 'cross_tenant_leak':
        throw new Error('SANDBOX_BLOCKED: Cross-tenant data isolation context violation detected.');
      case 'direct_ledger_write':
        throw new Error('SANDBOX_BLOCKED: Direct ledger write to journal_lines is prohibited.');
      case 'invariant_override':
        throw new Error('SANDBOX_BLOCKED: Kernel invariant override attempt rejected.');
      default:
        return { success: true };
    }
  }
};
