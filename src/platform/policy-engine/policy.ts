export interface PolicyViolation {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface PolicyResult {
  readonly satisfied: boolean;
  readonly violations: PolicyViolation[];
}

export interface Policy<TContext> {
  readonly name: string;
  readonly code: string;
  isSatisfiedBy(context: TContext): PolicyResult | Promise<PolicyResult>;
}

export class PolicyViolationError extends Error {
  constructor(
    public readonly policyName: string,
    public readonly violations: PolicyViolation[]
  ) {
    super(
      `Policy "${policyName}" violated: ${violations
        .map((v) => `[${v.code}] ${v.message}`)
        .join(', ')}`
    );
    this.name = 'PolicyViolationError';
    Object.setPrototypeOf(this, PolicyViolationError.prototype);
  }
}

export class AllPolicies<T> implements Policy<T> {
  readonly name: string;
  readonly code: string = 'COMBINED_ALL_POLICIES';

  constructor(
    private readonly policies: Policy<T>[],
    name?: string
  ) {
    this.name = name || 'All Policies Combination';
  }

  async isSatisfiedBy(context: T): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    
    for (const policy of this.policies) {
      const res = await policy.isSatisfiedBy(context);
      if (!res.satisfied) {
        violations.push(...res.violations);
      }
    }

    return {
      satisfied: violations.length === 0,
      violations,
    };
  }
}

export class AnyPolicy<T> implements Policy<T> {
  readonly name: string;
  readonly code: string = 'COMBINED_ANY_POLICY';

  constructor(
    private readonly policies: Policy<T>[],
    name?: string
  ) {
    this.name = name || 'Any Policy Combination';
  }

  async isSatisfiedBy(context: T): Promise<PolicyResult> {
    if (this.policies.length === 0) {
      return { satisfied: true, violations: [] };
    }

    const allViolations: PolicyViolation[] = [];
    
    for (const policy of this.policies) {
      const res = await policy.isSatisfiedBy(context);
      if (res.satisfied) {
        return { satisfied: true, violations: [] };
      }
      allViolations.push(...res.violations);
    }

    return {
      satisfied: false,
      violations: [
        {
          code: 'ANY_POLICY_FAILED',
          message: `None of the sub-policies were satisfied. Underlying errors: ${allViolations
            .map((v) => v.message)
            .join('; ')}`,
        },
      ],
    };
  }
}
