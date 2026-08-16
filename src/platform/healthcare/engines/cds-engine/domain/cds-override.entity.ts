export class CdsOverride {
  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly originalDecisionId: string,
    readonly clinicianId: string,
    readonly clinicianRole: string,
    readonly reason: string,
    readonly ruleVersion: string,
    readonly decisionResult: string,
    readonly authorizationContext: Record<string, unknown> | null,
    readonly policyVersion: string,
    readonly overrideAt: string
  ) {}
}
