/**
 * E7.3 Phase 5 Tests — Rule Composition
 * 
 * Tests for rule composition mechanism.
 * 
 * Coverage:
 * - All modes (ALL, UNTIL_VIOLATION)
 * - Determinism
 * - Evidence preservation
 * - Error handling
 * - Empty rule sets
 * - Duplicate rules
 * - Context immutability
 * 
 * Gate Requirements:
 * - All tests PASS
 * - E7.1/E7.2 regression: 439/439 PASS
 * - 10 P0 invariants verified
 */

import {
  composeRules,
  evaluateAll,
  evaluateUntilViolation,
  createCompositeRule,
  type CompositionOptions,
  type ExtendedCompositeRuleResult,
} from '../rule.composition';
import { Rule, RuleResult, RulePass, RuleViolation } from '../rule.types';

// ========== Test Fixtures ==========

class MockPassingRule implements Rule<any> {
  constructor(
    public readonly id: string,
    public readonly version: string = '1.0.0'
  ) {}
  
  readonly description = 'Mock passing rule';
  
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

class MockFailingRule implements Rule<any> {
  constructor(
    public readonly id: string,
    public readonly violationCode: string = 'TEST_VIOLATION',
    public readonly version: string = '1.0.0'
  ) {}
  
  readonly description = 'Mock failing rule';
  
  evaluate(context: any): RuleResult {
    const result: RuleViolation = {
      status: 'VIOLATION',
      ruleId: this.id,
      version: this.version,
      evaluatedAt: context.evaluationDate || new Date(),
      violation: {
        code: this.violationCode,
        message: `${this.id} violation`,
        severity: 'ERROR',
      },
      evidence: {
        input: { context },
        output: { passed: false },
      },
    };
    return result;
  }
}

class MockThrowingRule implements Rule<any> {
  constructor(
    public readonly id: string,
    public readonly errorMessage: string = 'Test error',
    public readonly version: string = '1.0.0'
  ) {}
  
  readonly description = 'Mock throwing rule';
  
  evaluate(context: any): RuleResult {
    throw new Error(this.errorMessage);
  }
}

// ========== Composition Modes ==========

describe('composeRules', () => {
  it('should evaluate all rules in ALL mode', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockPassingRule('RULE_2'),
      new MockPassingRule('RULE_3'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context, { mode: 'ALL' });

    expect(result.status).toBe('PASS');
    expect(result.results.length).toBe(3);
    expect(result.violations.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should evaluate all rules even with violations in ALL mode', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2', 'VIOLATION_1'),
      new MockPassingRule('RULE_3'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context, { mode: 'ALL' });

    expect(result.status).toBe('VIOLATION');
    expect(result.results.length).toBe(3); // All 3 evaluated
    expect(result.violations.length).toBe(1);
  });

  it('should stop at first violation in UNTIL_VIOLATION mode', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2', 'VIOLATION_1'),
      new MockPassingRule('RULE_3'), // Should not be evaluated
    ];
    const context = { test: true };

    const result = composeRules(rules, context, { mode: 'UNTIL_VIOLATION' });

    expect(result.status).toBe('VIOLATION');
    expect(result.results.length).toBe(2); // Only 2 evaluated
    expect(result.violations.length).toBe(1);
  });

  it('should evaluate all rules if no violations in UNTIL_VIOLATION mode', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockPassingRule('RULE_2'),
      new MockPassingRule('RULE_3'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context, { mode: 'UNTIL_VIOLATION' });

    expect(result.status).toBe('PASS');
    expect(result.results.length).toBe(3);
    expect(result.violations.length).toBe(0);
  });
});

// ========== P0 Invariants ==========

describe('[INVARIANT #1] Rule order is deterministic', () => {
  it('should evaluate rules in array order', () => {
    const rules = [
      new MockPassingRule('RULE_A'),
      new MockPassingRule('RULE_B'),
      new MockPassingRule('RULE_C'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context);

    expect(result.results[0].ruleId).toBe('RULE_A');
    expect(result.results[1].ruleId).toBe('RULE_B');
    expect(result.results[2].ruleId).toBe('RULE_C');
  });
});

describe('[INVARIANT #2] Same rules + context → same result', () => {
  it('should return identical results for same input', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2', 'VIOLATION_1'),
    ];
    const context = { test: true, evaluationDate: new Date('2026-08-22T10:00:00Z') };

    const result1 = composeRules(rules, context);
    const result2 = composeRules(rules, context);

    expect(result1.status).toBe(result2.status);
    expect(result1.results.length).toBe(result2.results.length);
    expect(result1.violations.length).toBe(result2.violations.length);
    expect(result1.results.map(r => r.ruleId)).toEqual(
      result2.results.map(r => r.ruleId)
    );
  });
});

describe('[INVARIANT #3] No context mutation', () => {
  it('should not mutate context', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2'),
    ];
    const context = { test: true, count: 42 };
    const originalTest = context.test;
    const originalCount = context.count;

    composeRules(rules, context);

    expect(context.test).toBe(originalTest);
    expect(context.count).toBe(originalCount);
  });
});

describe('[INVARIANT #4] No workflow execution', () => {
  it('should not contain workflow commands', () => {
    const rules = [
      new MockFailingRule('RULE', 'INVENTORY_EXPIRED'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context);

    // Result should only contain facts
    expect(result.status).toBe('VIOLATION');
    expect(result.violations.length).toBe(1);

    // Result should NOT contain commands
    expect(result).not.toHaveProperty('quarantine');
    expect(result).not.toHaveProperty('recall');
    expect(result).not.toHaveProperty('notification');
    expect(result).not.toHaveProperty('workflow');
  });
});

describe('[INVARIANT #5] Evidence preservation', () => {
  it('should preserve evidence from all rules', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2', 'VIOLATION_1'),
      new MockPassingRule('RULE_3'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context);

    expect(result.evidence.length).toBe(3);
    result.evidence.forEach(evidence => {
      expect(evidence.input).toBeDefined();
      expect(evidence.output).toBeDefined();
    });
  });
});

describe('[INVARIANT #6] Returns facts, not commands', () => {
  it('should return data structures, not action commands', () => {
    const rules = [
      new MockFailingRule('RULE', 'VIOLATION'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context);

    // Verify result structure is data, not commands
    expect(typeof result.status).toBe('string');
    expect(result.evaluatedAt).toBeInstanceOf(Date);
    expect(Array.isArray(result.results)).toBe(true);
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.evidence)).toBe(true);

    // No executable functions/callbacks
    expect(typeof result.status).not.toBe('function');
  });
});

describe('[INVARIANT #7] Empty rule set → PASS', () => {
  it('should return PASS for empty rule set', () => {
    const rules: Rule<any>[] = [];
    const context = { test: true };

    const result = composeRules(rules, context);

    expect(result.status).toBe('PASS');
    expect(result.results.length).toBe(0);
    expect(result.violations.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });
});

describe('[INVARIANT #8] Rule error recorded, not silently converted', () => {
  it('should record errors in errors array', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockThrowingRule('RULE_2', 'Test error'),
    ];
    const context = { test: true };

    const result = composeRules(rules, context, { continueOnError: false });

    expect(result.errors.length).toBe(1);
    expect(result.errors[0].ruleId).toBe('RULE_2');
    expect(result.errors[0].error.message).toBe('Test error');
  });

  it('should stop on error by default', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockThrowingRule('RULE_2', 'Test error'),
      new MockPassingRule('RULE_3'), // Should not evaluate
    ];
    const context = { test: true };

    const result = composeRules(rules, context);

    expect(result.results.length).toBe(1); // Only RULE_1 evaluated
    expect(result.errors.length).toBe(1);
  });

  it('should continue on error if continueOnError is true', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockThrowingRule('RULE_2', 'Test error'),
      new MockPassingRule('RULE_3'), // Should evaluate
    ];
    const context = { test: true };

    const result = composeRules(rules, context, { continueOnError: true });

    expect(result.results.length).toBe(2); // RULE_1 and RULE_3
    expect(result.errors.length).toBe(1);
  });
});

describe('[INVARIANT #9] Duplicate rule ID/version handled deterministically', () => {
  it('should execute all rules even if duplicate ID/version', () => {
    const rules = [
      new MockPassingRule('RULE_A', '1.0.0'),
      new MockPassingRule('RULE_A', '1.0.0'), // Duplicate
      new MockFailingRule('RULE_A', 'VIOLATION', '1.0.0'), // Duplicate with different behavior
    ];
    const context = { test: true };

    const result = composeRules(rules, context);

    // All 3 rules evaluated
    expect(result.results.length).toBe(3);
    expect(result.results.filter(r => r.status === 'PASS').length).toBe(2);
    expect(result.results.filter(r => r.status === 'VIOLATION').length).toBe(1);
  });
});

describe('[INVARIANT #10] Tenant boundary preserved', () => {
  it('should preserve tenant context unchanged', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2'),
    ];
    const context = { tenantId: 'tenant-a', data: { value: 100 } };
    const originalTenantId = context.tenantId;

    composeRules(rules, context);

    expect(context.tenantId).toBe(originalTenantId);
  });
});

// ========== Convenience Functions ==========

describe('evaluateAll', () => {
  it('should be equivalent to composeRules with ALL mode', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2'),
      new MockPassingRule('RULE_3'),
    ];
    const context = { test: true };

    const result1 = evaluateAll(rules, context);
    const result2 = composeRules(rules, context, { mode: 'ALL' });

    expect(result1.results.length).toBe(result2.results.length);
    expect(result1.status).toBe(result2.status);
  });
});

describe('evaluateUntilViolation', () => {
  it('should be equivalent to composeRules with UNTIL_VIOLATION mode', () => {
    const rules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2'),
      new MockPassingRule('RULE_3'),
    ];
    const context = { test: true };

    const result1 = evaluateUntilViolation(rules, context);
    const result2 = composeRules(rules, context, { mode: 'UNTIL_VIOLATION' });

    expect(result1.results.length).toBe(result2.results.length);
    expect(result1.status).toBe(result2.status);
  });
});

// ========== Composite Rule ==========

describe('createCompositeRule', () => {
  it('should create a rule that wraps multiple rules', () => {
    const innerRules = [
      new MockPassingRule('RULE_1'),
      new MockPassingRule('RULE_2'),
    ];

    const compositeRule = createCompositeRule(
      'COMPOSITE_RULE',
      '1.0.0',
      'Composite of RULE_1 and RULE_2',
      innerRules
    );

    const context = { test: true };
    const result = compositeRule.evaluate(context);

    expect(result.ruleId).toBe('COMPOSITE_RULE');
    expect(result.status).toBe('PASS');
    expect(result.evidence.metadata?.compositeRuleResults).toHaveLength(2);
  });

  it('should return VIOLATION if any inner rule fails', () => {
    const innerRules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2', 'INNER_VIOLATION'),
    ];

    const compositeRule = createCompositeRule(
      'COMPOSITE_RULE',
      '1.0.0',
      'Composite rule',
      innerRules
    );

    const context = { test: true };
    const result = compositeRule.evaluate(context);

    expect(result.status).toBe('VIOLATION');
    if (result.status === 'VIOLATION') {
      expect(result.violation.code).toBe('COMPOSITE_RULE_VIOLATION');
      expect(result.evidence.metadata?.violations).toHaveLength(1);
    }
  });

  it('should support UNTIL_VIOLATION mode', () => {
    const innerRules = [
      new MockPassingRule('RULE_1'),
      new MockFailingRule('RULE_2', 'VIOLATION'),
      new MockPassingRule('RULE_3'), // Should not evaluate
    ];

    const compositeRule = createCompositeRule(
      'COMPOSITE_RULE',
      '1.0.0',
      'Composite rule',
      innerRules,
      { mode: 'UNTIL_VIOLATION' }
    );

    const context = { test: true };
    const result = compositeRule.evaluate(context);

    expect(result.status).toBe('VIOLATION');
    expect(result.evidence.metadata?.compositeRuleResults).toHaveLength(2);
  });
});
