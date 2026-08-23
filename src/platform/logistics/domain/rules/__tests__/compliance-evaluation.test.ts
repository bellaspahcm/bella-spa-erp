/**
 * E7.3 Phase 4 Tests — Compliance Evaluation
 * 
 * Tests for compliance aggregation and regulatory reporting.
 * 
 * Coverage:
 * - Compliance evaluation
 * - Evidence preservation
 * - Determinism
 * - Regulatory mapping
 * - Report generation
 * 
 * Gate Requirements:
 * - All tests PASS
 * - E7.1/E7.2 regression: 439/439 PASS
 * - No mutations
 * - No workflow execution
 * - Evidence preserved
 * - Deterministic
 */

import {
  evaluateCompliance,
  generateComplianceReport,
  mapViolationsToRegulations,
  DEFAULT_REGULATORY_MAPPINGS,
  type ComplianceEvaluationContext,
  type ComplianceResult,
  type RegulatoryMapping,
} from '../compliance.evaluation';
import { Rule, RuleResult, RulePass, RuleViolation } from '../rule.types';
import { Inventory } from '../../inventory.types';
import { TraceabilityRecord } from '../../traceability.types';

// ========== Test Fixtures ==========

function createInventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: { value: 'inv-1' },
    tenant_id: 'tenant-a',
    item_id: { value: 'item-1' },
    location_id: { value: 'loc-1' },
    location_type: 'WAREHOUSE',
    quantity_on_hand: 100,
    quantity_available: 100,
    quantity_reserved: 0,
    unit_of_measure: 'EA',
    status: 'AVAILABLE',
    last_movement_date: new Date('2024-01-01'),
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

function createTraceabilityRecord(
  overrides: Partial<TraceabilityRecord> = {}
): TraceabilityRecord {
  return {
    id: { value: 'trace-1' },
    tenant_id: 'tenant-a',
    item_id: { value: 'item-1' },
    lot_number: { value: 'LOT-001' },
    received_date: new Date('2024-01-01'),
    custody_events: [],
    compliance_status: 'COMPLIANT',
    recall_status: 'NONE',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// Mock rules
class PassingRule implements Rule<any> {
  readonly id = 'TEST_PASSING_RULE';
  readonly version = '1.0.0';
  readonly description = 'Always passes';

  evaluate(context: any): RuleResult {
    const result: RulePass = {
      status: 'PASS',
      ruleId: this.id,
      version: this.version,
      evaluatedAt: context.evaluationDate || new Date(),
      evidence: {
        input: { context },
        output: { passed: true },
      },
    };
    return result;
  }
}

class FailingRule implements Rule<any> {
  constructor(
    public readonly id: string = 'TEST_FAILING_RULE',
    public readonly violationCode: string = 'TEST_VIOLATION',
    public readonly severity: 'ERROR' | 'WARNING' = 'ERROR'
  ) {}

  readonly version = '1.0.0';
  readonly description = 'Always fails';

  evaluate(context: any): RuleResult {
    const result: RuleViolation = {
      status: 'VIOLATION',
      ruleId: this.id,
      version: this.version,
      evaluatedAt: context.evaluationDate || new Date(),
      violation: {
        code: this.violationCode,
        message: 'Test violation',
        severity: this.severity,
      },
      evidence: {
        input: { context },
        output: { passed: false },
      },
    };
    return result;
  }
}

// ========== Compliance Evaluation ==========

describe('evaluateCompliance', () => {
  it('should return COMPLIANT when all rules pass', () => {
    const inventory = createInventory();
    const rules = [new PassingRule(), new PassingRule()];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const result = evaluateCompliance(context);

    expect(result.status).toBe('COMPLIANT');
    expect(result.violations.length).toBe(0);
    expect(result.ruleResults.length).toBe(2);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.violated).toBe(0);
  });

  it('should return NON_COMPLIANT when any rule fails', () => {
    const inventory = createInventory();
    const rules = [
      new PassingRule(),
      new FailingRule('RULE_1', 'VIOLATION_1'),
    ];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const result = evaluateCompliance(context);

    expect(result.status).toBe('NON_COMPLIANT');
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].code).toBe('VIOLATION_1');
    expect(result.ruleResults.length).toBe(2);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.violated).toBe(1);
  });

  it('should aggregate multiple violations', () => {
    const inventory = createInventory();
    const rules = [
      new FailingRule('RULE_1', 'VIOLATION_1', 'ERROR'),
      new FailingRule('RULE_2', 'VIOLATION_2', 'WARNING'),
      new FailingRule('RULE_3', 'VIOLATION_3', 'ERROR'),
    ];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const result = evaluateCompliance(context);

    expect(result.status).toBe('NON_COMPLIANT');
    expect(result.violations.length).toBe(3);
    expect(result.summary.violated).toBe(3);
    expect(result.summary.violationsBySeverity.ERROR).toBe(2);
    expect(result.summary.violationsBySeverity.WARNING).toBe(1);
    expect(result.summary.violationCodes).toEqual([
      'VIOLATION_1',
      'VIOLATION_2',
      'VIOLATION_3',
    ]);
  });

  it('[EVIDENCE PRESERVATION] should preserve all rule evidence', () => {
    const inventory = createInventory();
    const rules = [
      new PassingRule(),
      new FailingRule('RULE_1', 'VIOLATION_1'),
    ];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const result = evaluateCompliance(context);

    // All rule results must be present
    expect(result.ruleResults.length).toBe(2);

    // Each result must have evidence
    result.ruleResults.forEach(ruleResult => {
      expect(ruleResult.evidence).toBeDefined();
      expect(ruleResult.evidence.input).toBeDefined();
      expect(ruleResult.evidence.output).toBeDefined();
    });

    // Violation must have evidence
    expect(result.violations[0]).toBeDefined();
    const violationResult = result.ruleResults.find(
      r => r.status === 'VIOLATION'
    ) as RuleViolation;
    expect(violationResult.evidence).toBeDefined();
  });

  it('[DETERMINISM] should return identical results for same context', () => {
    const inventory = createInventory();
    const rules = [
      new PassingRule(),
      new FailingRule('RULE_1', 'VIOLATION_1'),
    ];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const result1 = evaluateCompliance(context);
    const result2 = evaluateCompliance(context);

    expect(result1.status).toBe(result2.status);
    expect(result1.violations.length).toBe(result2.violations.length);
    expect(result1.ruleResults.length).toBe(result2.ruleResults.length);
    expect(result1.summary).toEqual(result2.summary);
    expect(result1.violations.map(v => v.code)).toEqual(
      result2.violations.map(v => v.code)
    );
  });

  it('should pass evaluationDate to rules for deterministic time-based rules', () => {
    const inventory = createInventory({
      expiry_date: new Date('2026-08-20'), // Expired
    });

    let capturedDate: Date | undefined;
    const timeAwareRule: Rule<any> = {
      id: 'TIME_AWARE_RULE',
      version: '1.0.0',
      description: 'Checks evaluation date',
      evaluate(context: any): RuleResult {
        capturedDate = context.evaluationDate;
        return {
          status: 'PASS',
          ruleId: this.id,
          version: this.version,
          evaluatedAt: context.evaluationDate,
          evidence: { input: {}, output: {} },
        };
      },
    };

    const evaluatedAt = new Date('2026-08-22T10:00:00Z');
    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules: [timeAwareRule],
      evaluatedAt,
    };

    evaluateCompliance(context);

    expect(capturedDate).toEqual(evaluatedAt);
  });

  it('should work with TraceabilityRecord entity', () => {
    const record = createTraceabilityRecord();
    const rules = [new PassingRule()];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: record,
      rules,
      evaluatedAt,
    };

    const result = evaluateCompliance(context);

    expect(result.status).toBe('COMPLIANT');
    expect(result.entityType).toBe('TraceabilityRecord');
    expect(result.entityId).toBe('trace-1');
  });

  it('should include additionalContext in rule evaluation', () => {
    const inventory = createInventory();

    let capturedContext: any;
    const contextAwareRule: Rule<any> = {
      id: 'CONTEXT_AWARE_RULE',
      version: '1.0.0',
      description: 'Captures context',
      evaluate(context: any): RuleResult {
        capturedContext = context;
        return {
          status: 'PASS',
          ruleId: this.id,
          version: this.version,
          evaluatedAt: new Date(),
          evidence: { input: {}, output: {} },
        };
      },
    };

    const evaluatedAt = new Date('2026-08-22T10:00:00Z');
    const additionalContext = { customField: 'customValue' };

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules: [contextAwareRule],
      evaluatedAt,
      additionalContext,
    };

    evaluateCompliance(context);

    expect(capturedContext.customField).toBe('customValue');
    expect(capturedContext.evaluationDate).toEqual(evaluatedAt);
  });

  it('[NO MUTATION] should not mutate input entity', () => {
    const inventory = createInventory();
    const originalQuantity = inventory.quantity_on_hand;
    const originalStatus = inventory.status;

    const rules = [new FailingRule()];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    evaluateCompliance(context);

    expect(inventory.quantity_on_hand).toBe(originalQuantity);
    expect(inventory.status).toBe(originalStatus);
  });

  it('[NO WORKFLOW] should not execute any workflow actions', () => {
    const inventory = createInventory();
    const rules = [new FailingRule('RULE', 'INVENTORY_EXPIRED')];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const result = evaluateCompliance(context);

    // Result should only contain facts
    expect(result.status).toBe('NON_COMPLIANT');
    expect(result.violations.length).toBe(1);

    // Result should NOT contain commands/actions
    expect(result).not.toHaveProperty('quarantine');
    expect(result).not.toHaveProperty('recall');
    expect(result).not.toHaveProperty('notification');
    expect(result).not.toHaveProperty('task');
    expect(result).not.toHaveProperty('workflow');
  });
});

// ========== Report Generation ==========

describe('generateComplianceReport', () => {
  it('should generate report with metadata', () => {
    const inventory = createInventory();
    const rules = [new PassingRule()];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const complianceResult = evaluateCompliance(context);
    const report = generateComplianceReport(complianceResult);

    expect(report.result).toBe(complianceResult);
    expect(report.reportId).toMatch(/^RPT-/);
    expect(report.generatedAt).toBeInstanceOf(Date);
  });

  it('should include regulatory mappings for violations', () => {
    const inventory = createInventory();
    const rules = [new FailingRule('RULE', 'INVENTORY_EXPIRED')];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const complianceResult = evaluateCompliance(context);
    const report = generateComplianceReport(
      complianceResult,
      DEFAULT_REGULATORY_MAPPINGS
    );

    expect(report.regulatoryMappings).toBeDefined();
    expect(report.regulatoryMappings!.length).toBeGreaterThan(0);
    expect(report.regulatoryMappings![0].violationCode).toBe(
      'INVENTORY_EXPIRED'
    );
  });

  it('should filter mappings to only relevant violations', () => {
    const inventory = createInventory();
    const rules = [new FailingRule('RULE', 'INVENTORY_EXPIRED')];
    const evaluatedAt = new Date('2026-08-22T10:00:00Z');

    const context: ComplianceEvaluationContext = {
      entity: inventory,
      rules,
      evaluatedAt,
    };

    const complianceResult = evaluateCompliance(context);
    const report = generateComplianceReport(
      complianceResult,
      DEFAULT_REGULATORY_MAPPINGS
    );

    // Should only include mappings for INVENTORY_EXPIRED
    const codes = report.regulatoryMappings!.map(m => m.violationCode);
    expect(codes).toEqual(['INVENTORY_EXPIRED']);
    expect(codes).not.toContain('LOT_NUMBER_REQUIRED');
    expect(codes).not.toContain('BROKEN_TRACEABILITY_CHAIN');
  });
});

// ========== Regulatory Mapping ==========

describe('mapViolationsToRegulations', () => {
  it('should map violations to regulatory requirements', () => {
    const violations = [
      {
        code: 'INVENTORY_EXPIRED',
        message: 'Inventory expired',
        severity: 'ERROR' as const,
      },
    ];

    const mappings = mapViolationsToRegulations(violations);

    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings[0].violationCode).toBe('INVENTORY_EXPIRED');
    expect(mappings[0].regulatoryRequirements.length).toBeGreaterThan(0);
  });

  it('should map multiple violations', () => {
    const violations = [
      {
        code: 'INVENTORY_EXPIRED',
        message: 'Inventory expired',
        severity: 'ERROR' as const,
      },
      {
        code: 'LOT_NUMBER_REQUIRED',
        message: 'Lot number missing',
        severity: 'ERROR' as const,
      },
    ];

    const mappings = mapViolationsToRegulations(violations);

    expect(mappings.length).toBe(2);
    const codes = mappings.map(m => m.violationCode);
    expect(codes).toContain('INVENTORY_EXPIRED');
    expect(codes).toContain('LOT_NUMBER_REQUIRED');
  });

  it('should use custom mappings if provided', () => {
    const customMappings: RegulatoryMapping[] = [
      {
        violationCode: 'CUSTOM_VIOLATION',
        regulatoryRequirements: [
          {
            regulation: 'Custom Regulation',
            section: 'Section 1',
            description: 'Custom requirement',
            severity: 'MAJOR',
          },
        ],
      },
    ];

    const violations = [
      {
        code: 'CUSTOM_VIOLATION',
        message: 'Custom violation',
        severity: 'ERROR' as const,
      },
    ];

    const mappings = mapViolationsToRegulations(violations, customMappings);

    expect(mappings.length).toBe(1);
    expect(mappings[0].violationCode).toBe('CUSTOM_VIOLATION');
    expect(mappings[0].regulatoryRequirements[0].regulation).toBe(
      'Custom Regulation'
    );
  });

  it('should return empty array if no mappings match', () => {
    const violations = [
      {
        code: 'UNKNOWN_VIOLATION',
        message: 'Unknown',
        severity: 'ERROR' as const,
      },
    ];

    const mappings = mapViolationsToRegulations(violations);

    expect(mappings.length).toBe(0);
  });
});

// ========== Default Mappings ==========

describe('DEFAULT_REGULATORY_MAPPINGS', () => {
  it('should include FDA mappings', () => {
    const expiredMapping = DEFAULT_REGULATORY_MAPPINGS.find(
      m => m.violationCode === 'INVENTORY_EXPIRED'
    );

    expect(expiredMapping).toBeDefined();
    expect(
      expiredMapping!.regulatoryRequirements.some(r =>
        r.regulation.includes('FDA')
      )
    ).toBe(true);
  });

  it('should include EU mappings', () => {
    const expiredMapping = DEFAULT_REGULATORY_MAPPINGS.find(
      m => m.violationCode === 'INVENTORY_EXPIRED'
    );

    expect(expiredMapping).toBeDefined();
    expect(
      expiredMapping!.regulatoryRequirements.some(r => r.regulation.includes('EU'))
    ).toBe(true);
  });

  it('should include traceability mappings', () => {
    const traceMapping = DEFAULT_REGULATORY_MAPPINGS.find(
      m => m.violationCode === 'BROKEN_TRACEABILITY_CHAIN'
    );

    expect(traceMapping).toBeDefined();
    expect(traceMapping!.regulatoryRequirements.length).toBeGreaterThan(0);
  });
});
