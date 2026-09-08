/**
 * Factory Evidence Integrity Guard — Public API
 * 
 * Usage:
 * ```typescript
 * import { validateEvidence } from '@/factory/evidence';
 * 
 * // In Factory closure workflow
 * const result = await validateEvidence({
 *   product: 'bella-land',
 *   gates: gateResults,
 *   enforceStatusPrecision: true,
 *   enforceClaimBinding: true
 * });
 * 
 * if (!result.passed) {
 *   console.error('Evidence integrity violated - cannot close Product');
 *   console.error(result.violations);
 *   throw new Error('Closure blocked');
 * }
 * ```
 */

export { EvidenceGuard } from './EvidenceGuard';
export { StatusValidator } from './validators/StatusValidator';
export { ClaimValidator } from './validators/ClaimValidator';
export { AggregationValidator } from './validators/AggregationValidator';

export type {
  GateStatus,
  EvidenceType,
  ClaimConfidence,
  ViolationSeverity,
  Evidence,
  GateResult,
  Claim,
  IntegrityViolation,
  EvidenceMatrix,
  AggregatedStatus,
  EvidenceValidationConfig,
  EvidenceValidationResult,
  StatusTransitionRule,
} from './types';

import { EvidenceGuard } from './EvidenceGuard';
import type {
  EvidenceValidationConfig,
  EvidenceValidationResult,
} from './types';

/**
 * Validate evidence integrity (primary API)
 */
export async function validateEvidence(
  config: EvidenceValidationConfig
): Promise<EvidenceValidationResult> {
  const guard = new EvidenceGuard();
  return await guard.validate(config);
}

/**
 * Validate evidence and generate human-readable report
 */
export async function validateEvidenceWithReport(
  config: EvidenceValidationConfig
): Promise<{ result: EvidenceValidationResult; report: string }> {
  const guard = new EvidenceGuard();
  const result = await guard.validate(config);
  const report = guard.generateReport(result);

  return { result, report };
}
