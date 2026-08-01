import { Policy, AllPolicies, AnyPolicy, PolicyViolationError } from './Policy';

interface DummyTransaction {
  amount: number;
  role: string;
}

class AmountLimitPolicy implements Policy<DummyTransaction> {
  readonly name = 'Amount Limit Policy';
  readonly code = 'TX_AMOUNT_LIMIT';

  async isSatisfiedBy(ctx: DummyTransaction) {
    if (ctx.amount > 1000) {
      return {
        satisfied: false,
        violations: [{ code: 'LIMIT_EXCEEDED', message: 'Transaction amount exceeds 1000', field: 'amount' }],
      };
    }
    return { satisfied: true, violations: [] };
  }
}

class AdminOnlyPolicy implements Policy<DummyTransaction> {
  readonly name = 'Admin Only Policy';
  readonly code = 'TX_ADMIN_ONLY';

  async isSatisfiedBy(ctx: DummyTransaction) {
    if (ctx.role !== 'admin') {
      return {
        satisfied: false,
        violations: [{ code: 'NOT_ADMIN', message: 'User role must be admin', field: 'role' }],
      };
    }
    return { satisfied: true, violations: [] };
  }
}

describe('PolicyEngine', () => {
  const amountPolicy = new AmountLimitPolicy();
  const adminPolicy = new AdminOnlyPolicy();

  describe('Individual Policy', () => {
    it('should satisfy when conditions are met', async () => {
      const result = await amountPolicy.isSatisfiedBy({ amount: 500, role: 'user' });
      expect(result.satisfied).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should return violation info when conditions fail', async () => {
      const result = await amountPolicy.isSatisfiedBy({ amount: 1500, role: 'user' });
      expect(result.satisfied).toBe(false);
      expect(result.violations[0].code).toBe('LIMIT_EXCEEDED');
    });
  });

  describe('AllPolicies (AND combinator)', () => {
    const combined = new AllPolicies([amountPolicy, adminPolicy]);

    it('should satisfy only if all policies pass', async () => {
      const result = await combined.isSatisfiedBy({ amount: 500, role: 'admin' });
      expect(result.satisfied).toBe(true);
    });

    it('should capture violations if one policy fails', async () => {
      const result = await combined.isSatisfiedBy({ amount: 500, role: 'user' });
      expect(result.satisfied).toBe(false);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0].code).toBe('NOT_ADMIN');
    });

    it('should accumulate all violations if multiple policies fail', async () => {
      const result = await combined.isSatisfiedBy({ amount: 1500, role: 'user' });
      expect(result.satisfied).toBe(false);
      expect(result.violations.length).toBe(2);
    });
  });

  describe('AnyPolicy (OR combinator)', () => {
    const combined = new AnyPolicy([amountPolicy, adminPolicy]);

    it('should satisfy if at least one policy passes', async () => {
      const result = await combined.isSatisfiedBy({ amount: 1500, role: 'admin' }); // adminPolicy passes
      expect(result.satisfied).toBe(true);
    });

    it('should fail and return unified error if all policies fail', async () => {
      const result = await combined.isSatisfiedBy({ amount: 1500, role: 'user' }); // both fail
      expect(result.satisfied).toBe(false);
      expect(result.violations[0].code).toBe('ANY_POLICY_FAILED');
    });
  });

  describe('PolicyViolationError', () => {
    it('should format violation message correctly', () => {
      const err = new PolicyViolationError('Limit Check', [
        { code: 'ERR_1', message: 'Too high' },
        { code: 'ERR_2', message: 'Too frequent' },
      ]);
      expect(err.message).toContain('Policy "Limit Check" violated: [ERR_1] Too high, [ERR_2] Too frequent');
    });
  });
});
