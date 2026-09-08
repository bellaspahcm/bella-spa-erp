/**
 * Factory Evidence Integrity Guard — Unit Tests
 * 
 * Tests P0 capability: "No Claim Without Evidence" enforcement
 */

import { EvidenceGuard } from '@/factory/evidence/EvidenceGuard';
import { StatusValidator } from '@/factory/evidence/validators/StatusValidator';
import { ClaimValidator } from '@/factory/evidence/validators/ClaimValidator';
import { AggregationValidator } from '@/factory/evidence/validators/AggregationValidator';
import type {
  GateResult,
  Evidence,
  Claim,
  EvidenceValidationConfig,
} from '@/factory/evidence/types';

describe('Factory Evidence Integrity Guard', () => {
  describe('StatusValidator', () => {
    let validator: StatusValidator;

    beforeEach(() => {
      validator = new StatusValidator();
    });

    it('should detect PASS without evidence', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'TypeScript',
          status: 'PASS',
          evidence: [], // No evidence!
          timestamp: new Date().toISOString(),
        },
      ];

      const violations = validator.validateStatusPrecision(gateResults);

      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe('BLOCKER');
      expect(violations[0].violation).toContain('PASS status without supporting evidence');
    });

    it('should allow PASS with evidence', () => {
      const evidence: Evidence = {
        type: 'test-result',
        data: { passed: 17, failed: 0 },
        timestamp: new Date().toISOString(),
      };

      const gateResults: GateResult[] = [
        {
          gate: 'E2E Tests',
          status: 'PASS',
          evidence: [evidence],
          timestamp: new Date().toISOString(),
        },
      ];

      const violations = validator.validateStatusPrecision(gateResults);

      expect(violations).toHaveLength(0);
    });

    it('should detect forbidden status transition (TIMEOUT → PASS)', () => {
      const violation = validator.validateNoForbiddenTransitions(
        'TIMEOUT',
        'PASS',
        'TypeScript'
      );

      expect(violation).not.toBeNull();
      expect(violation!.severity).toBe('BLOCKER');
      expect(violation!.violation).toContain('TIMEOUT → PASS');
    });

    it('should allow valid status (no transition)', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'Build',
          status: 'PASS',
          evidence: [
            {
              type: 'command-output',
              data: 'Build successful',
              timestamp: new Date().toISOString(),
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ];

      const violations = validator.validateStatusPrecision(gateResults);

      expect(violations).toHaveLength(0);
    });
  });

  describe('ClaimValidator', () => {
    let validator: ClaimValidator;

    beforeEach(() => {
      validator = new ClaimValidator();
    });

    it('should detect claim without evidence', () => {
      const claims: Claim[] = [
        {
          statement: 'Product fully verified',
          supportingEvidence: [], // No evidence!
          confidence: 'PROVEN',
          timestamp: new Date().toISOString(),
        },
      ];

      const violations = validator.validateClaimEvidenceBinding(claims, []);

      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe('BLOCKER');
      expect(violations[0].violation).toContain('without supporting evidence');
    });

    it('should detect PROVEN confidence without evidence', () => {
      const claims: Claim[] = [
        {
          statement: 'All tests pass',
          supportingEvidence: ['non-existent-evidence'],
          confidence: 'PROVEN',
          timestamp: new Date().toISOString(),
        },
      ];

      const violations = validator.validateClaimEvidenceBinding(claims, []);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.violation.includes('non-existent evidence'))).toBe(true);
    });

    it('should extract claims from gate results', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'PASS',
          evidence: [
            {
              type: 'test-result',
              data: {},
              timestamp: new Date().toISOString(),
            },
          ],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'TypeScript',
          status: 'TIMEOUT',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const claims = validator.extractClaimsFromGates(gateResults);

      expect(claims).toHaveLength(2);
      expect(claims[0].statement).toContain('E2E verified');
      expect(claims[0].confidence).toBe('PROVEN');
      expect(claims[1].statement).toContain('not verified (timeout)');
      expect(claims[1].confidence).toBe('UNVERIFIED');
    });

    it('should detect over-generalized "fully verified" claim', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'PASS',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'TypeScript',
          status: 'TIMEOUT',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const violation = validator.validateAggregateClaimAccuracy(
        'Product fully verified',
        gateResults
      );

      expect(violation).not.toBeNull();
      expect(violation!.severity).toBe('BLOCKER');
      expect(violation!.violation).toContain('Over-generalized');
      expect(violation!.detail).toContain('TIMEOUT');
    });

    it('should detect unqualified "verified" claim with unverified gates', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'PASS',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'TypeScript',
          status: 'SKIPPED',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const violation = validator.validateAggregateClaimAccuracy(
        'Product verified',
        gateResults
      );

      expect(violation).not.toBeNull();
      expect(violation!.severity).toBe('BLOCKER');
      expect(violation!.detail).toContain('SKIPPED');
    });
  });

  describe('AggregationValidator', () => {
    let validator: AggregationValidator;

    beforeEach(() => {
      validator = new AggregationValidator();
    });

    it('should calculate VERIFIED when all gates PASS', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'PASS',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'Tests',
          status: 'PASS',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const aggregated = validator.calculateAggregatedStatus(gateResults);

      expect(aggregated.overall).toBe('VERIFIED');
      expect(aggregated.passedGates).toBe(2);
      expect(aggregated.totalGates).toBe(2);
    });

    it('should calculate PARTIALLY_VERIFIED when some gates TIMEOUT', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'PASS',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'TypeScript',
          status: 'TIMEOUT',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const aggregated = validator.calculateAggregatedStatus(gateResults);

      expect(aggregated.overall).toBe('PARTIALLY_VERIFIED');
      expect(aggregated.passedGates).toBe(1);
      expect(aggregated.totalGates).toBe(2);
    });

    it('should calculate FAILED when any gate FAIL', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'PASS',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'Tests',
          status: 'FAIL',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const aggregated = validator.calculateAggregatedStatus(gateResults);

      expect(aggregated.overall).toBe('FAILED');
    });

    it('should calculate UNVERIFIED when all gates TIMEOUT/SKIPPED/NOT_RUN', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'TIMEOUT',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'Tests',
          status: 'SKIPPED',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const aggregated = validator.calculateAggregatedStatus(gateResults);

      expect(aggregated.overall).toBe('UNVERIFIED');
    });

    it('should detect status hiding (VERIFIED with TIMEOUT gates)', () => {
      const gateResults: GateResult[] = [
        {
          gate: 'E2E',
          status: 'PASS',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
        {
          gate: 'TypeScript',
          status: 'TIMEOUT',
          evidence: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const reportedStatus = {
        overall: 'VERIFIED' as const, // Incorrect!
        passedGates: 2,
        totalGates: 2,
        criticalGatesPassed: 0,
        criticalGatesTotal: 0,
        summary: 'All verified',
      };

      const violations = validator.validateNoStatusHiding(
        gateResults,
        reportedStatus
      );

      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe('BLOCKER');
      expect(violations[0].violation).toContain('hides unverified gates');
    });
  });

  describe('EvidenceGuard Integration', () => {
    let guard: EvidenceGuard;

    beforeEach(() => {
      guard = new EvidenceGuard();
    });

    it('should pass validation with complete evidence (Bella Land success case)', async () => {
      const config: EvidenceValidationConfig = {
        product: 'bella-land',
        gates: [
          {
            gate: 'Browser E2E',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: { passed: 17, failed: 0 },
                timestamp: new Date().toISOString(),
              },
            ],
            timestamp: new Date().toISOString(),
          },
          {
            gate: 'Product Tests',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: { passed: 23, failed: 0 },
                timestamp: new Date().toISOString(),
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await guard.validate(config);

      expect(result.passed).toBe(true);
      expect(result.matrix.aggregatedStatus.overall).toBe('VERIFIED');
      expect(result.violations.filter(v => v.severity === 'BLOCKER')).toHaveLength(0);
    });

    it('should fail validation with TIMEOUT gate (Bella Land TIMEOUT case)', async () => {
      const config: EvidenceValidationConfig = {
        product: 'bella-land',
        gates: [
          {
            gate: 'Browser E2E',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: { passed: 17, failed: 0 },
                timestamp: new Date().toISOString(),
              },
            ],
            timestamp: new Date().toISOString(),
          },
          {
            gate: 'TypeScript',
            status: 'TIMEOUT',
            evidence: [],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await guard.validate(config);

      expect(result.matrix.aggregatedStatus.overall).toBe('PARTIALLY_VERIFIED');
      expect(result.matrix.aggregatedStatus.overall).not.toBe('VERIFIED');
    });

    it('should block false "fully verified" claim', async () => {
      const config: EvidenceValidationConfig = {
        product: 'test-product',
        gates: [
          {
            gate: 'E2E',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: {},
                timestamp: new Date().toISOString(),
              },
            ],
            timestamp: new Date().toISOString(),
          },
          {
            gate: 'TypeScript',
            status: 'TIMEOUT',
            evidence: [],
            timestamp: new Date().toISOString(),
          },
        ],
        claims: [
          {
            statement: 'Product fully verified',
            supportingEvidence: ['E2E-evidence-0'],
            confidence: 'PROVEN',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const violation = guard.validateAggregateClaim(
        'Product fully verified',
        config
      );

      expect(violation).not.toBeNull();
      expect(violation!.severity).toBe('BLOCKER');
    });

    it('should generate human-readable report', async () => {
      const config: EvidenceValidationConfig = {
        product: 'bella-land',
        gates: [
          {
            gate: 'E2E',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: {},
                timestamp: new Date().toISOString(),
              },
            ],
            timestamp: new Date().toISOString(),
          },
          {
            gate: 'TypeScript',
            status: 'TIMEOUT',
            evidence: [],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await guard.validate(config);
      const report = guard.generateReport(result);

      expect(report).toContain('FACTORY EVIDENCE INTEGRITY REPORT');
      expect(report).toContain('bella-land');
      expect(report).toContain('E2E');
      expect(report).toContain('TypeScript');
      expect(report).toContain('PARTIALLY_VERIFIED');
    });
  });

  describe('Bella Land Scenario Tests', () => {
    it('should accurately represent Bella Land final state', async () => {
      const guard = new EvidenceGuard();

      // Bella Land actual final state
      const config: EvidenceValidationConfig = {
        product: 'bella-land',
        gates: [
          {
            gate: 'Browser E2E',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: { passed: 17, failed: 0 },
                timestamp: '2026-09-06T10:25:33Z',
              },
            ],
            timestamp: '2026-09-06T10:25:33Z',
          },
          {
            gate: 'Product Tests',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: { passed: 23, failed: 0 },
                timestamp: '2026-09-06T10:25:00Z',
              },
            ],
            timestamp: '2026-09-06T10:25:00Z',
          },
          {
            gate: 'Architecture Guard',
            status: 'PASS',
            evidence: [
              {
                type: 'command-output',
                data: 'No violations',
                timestamp: '2026-09-06T10:24:00Z',
              },
            ],
            timestamp: '2026-09-06T10:24:00Z',
          },
          {
            gate: 'Production Build',
            status: 'PASS',
            evidence: [
              {
                type: 'command-output',
                data: '301 routes generated',
                timestamp: '2026-09-06T10:26:00Z',
              },
            ],
            timestamp: '2026-09-06T10:26:00Z',
          },
          {
            gate: 'Tenant Isolation',
            status: 'PASS',
            evidence: [
              {
                type: 'test-result',
                data: 'RLS verified',
                timestamp: '2026-09-06T10:25:00Z',
              },
            ],
            timestamp: '2026-09-06T10:25:00Z',
          },
          {
            gate: 'TypeScript',
            status: 'TIMEOUT',
            evidence: [
              {
                type: 'command-output',
                data: 'timeout after 180s',
                timestamp: '2026-09-06T10:28:15Z',
              },
            ],
            metadata: { timeout: true },
            timestamp: '2026-09-06T10:28:15Z',
          },
        ],
      };

      const result = await guard.validate(config);

      // Should be PARTIALLY_VERIFIED, not VERIFIED
      expect(result.matrix.aggregatedStatus.overall).toBe('PARTIALLY_VERIFIED');
      expect(result.matrix.aggregatedStatus.passedGates).toBe(5);
      expect(result.matrix.aggregatedStatus.totalGates).toBe(6);

      // Auto-extracted claims should reflect reality
      const timeoutClaim = result.matrix.claims.find(c =>
        c.statement.includes('TypeScript')
      );
      expect(timeoutClaim).toBeDefined();
      expect(timeoutClaim!.confidence).toBe('UNVERIFIED');
    });
  });
});
