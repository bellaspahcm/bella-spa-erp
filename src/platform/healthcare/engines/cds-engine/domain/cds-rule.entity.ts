export interface RuleConditions {
  medicationCode?: string;
  medicationClass?: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  maxDailyDoseMg?: number;
  hepaticContraindication?: boolean;
  renalContraindication?: boolean;
  pregnancyContraindication?: boolean;
  conflictDrugCode?: string;
  allergenCode?: string;
}

export class CdsRule {
  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly ruleCode: string,
    readonly ruleVersion: string,
    readonly description: string | null,
    readonly conditions: RuleConditions,
    readonly outcome: 'ALLOW' | 'WARNING' | 'BLOCK',
    readonly enforcement: 'OVERRIDABLE' | 'ABSOLUTE_BLOCK',
    readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    readonly ruleChecksum: string,
    readonly active: boolean
  ) {}
}
