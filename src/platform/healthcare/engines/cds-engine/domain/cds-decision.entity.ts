import * as crypto from 'crypto';

export class CdsDecision {
  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly encounterId: string,
    readonly patientId: string,
    readonly ruleId: string,
    readonly ruleVersion: string,
    readonly ruleChecksum: string,
    readonly contextSnapshotVersion: number,
    readonly inputSnapshot: Record<string, unknown>,
    readonly actionContext: Record<string, unknown>,
    readonly result: 'ALLOW' | 'WARNING' | 'BLOCK',
    readonly enforcement: 'OVERRIDABLE' | 'ABSOLUTE_BLOCK',
    readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    readonly reasoning: string | null,
    readonly evaluatorVersion: string,
    readonly evaluationFingerprint: string,
    readonly createdAt: string
  ) {}

  /**
   * Generates a deterministic SHA-256 fingerprint for this decision evaluation (H8-06 Rule)
   * Hashes the alphabetically sorted action_context keys, evaluator_version, and rule_checksum.
   */
  static calculateFingerprint(
    actionContext: Record<string, unknown>,
    evaluatorVersion: string,
    ruleChecksum: string
  ): string {
    const sortedContext: Record<string, unknown> = {};
    Object.keys(actionContext)
      .sort()
      .forEach((key) => {
        sortedContext[key] = actionContext[key];
      });

    const payload = JSON.stringify({
      actionContext: sortedContext,
      evaluatorVersion,
      ruleChecksum,
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
