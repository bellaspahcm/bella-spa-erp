export interface MedicationSafetyDefinition {
  medicationCode: string;
  doseLimit: number; // limit value (e.g. 4000)
  doseUnit: string;  // limit unit (e.g. 'mg')
  route?: string;
  frequency?: string;
  interactionRules?: { conflictDrugCode: string; severity: 'WARNING' | 'BLOCKED'; message: string }[];
  allergyRules?: { allergyCode: string; severity: 'WARNING' | 'BLOCKED'; message: string }[];
}

export type ScreeningSeverity = 'CLEAR' | 'WARNING' | 'BLOCKED';

export interface ScreeningFinding {
  policyName: string;
  medicationCode: string;
  severity: 'WARNING' | 'BLOCKED';
  code: string; // warning or blocked code
  message: string;
}

export class ScreeningResult {
  constructor(
    public readonly status: ScreeningSeverity,
    public readonly findings: ScreeningFinding[]
  ) {}

  static clear(): ScreeningResult {
    return new ScreeningResult('CLEAR', []);
  }

  static create(findings: ScreeningFinding[]): ScreeningResult {
    if (findings.length === 0) {
      return ScreeningResult.clear();
    }
    const hasBlocked = findings.some((f) => f.severity === 'BLOCKED');
    const status: ScreeningSeverity = hasBlocked ? 'BLOCKED' : 'WARNING';
    return new ScreeningResult(status, findings);
  }
}

export interface IScreeningPolicy {
  screen(context: {
    medicationCode: string;
    dosageValue: number;
    dosageUnit: string;
    patientAllergies: string[];
    activeMedicationCodes: string[];
    safetyDefinitions: Record<string, MedicationSafetyDefinition>;
  }): ScreeningFinding[];
}

export class AllergyPolicy implements IScreeningPolicy {
  public screen(context: {
    medicationCode: string;
    dosageValue: number;
    dosageUnit: string;
    patientAllergies: string[];
    activeMedicationCodes: string[];
    safetyDefinitions: Record<string, MedicationSafetyDefinition>;
  }): ScreeningFinding[] {
    const findings: ScreeningFinding[] = [];
    const definition = context.safetyDefinitions[context.medicationCode];
    if (!definition || !definition.allergyRules) return [];

    for (const rule of definition.allergyRules) {
      if (context.patientAllergies.includes(rule.allergyCode)) {
        findings.push({
          policyName: 'AllergyPolicy',
          medicationCode: context.medicationCode,
          severity: rule.severity,
          code: `ALLERGY_${rule.allergyCode}`,
          message: rule.message,
        });
      }
    }
    return findings;
  }
}

export class InteractionPolicy implements IScreeningPolicy {
  public screen(context: {
    medicationCode: string;
    dosageValue: number;
    dosageUnit: string;
    patientAllergies: string[];
    activeMedicationCodes: string[];
    safetyDefinitions: Record<string, MedicationSafetyDefinition>;
  }): ScreeningFinding[] {
    const findings: ScreeningFinding[] = [];
    const definition = context.safetyDefinitions[context.medicationCode];
    if (!definition || !definition.interactionRules) return [];

    for (const rule of definition.interactionRules) {
      if (context.activeMedicationCodes.includes(rule.conflictDrugCode)) {
        findings.push({
          policyName: 'InteractionPolicy',
          medicationCode: context.medicationCode,
          severity: rule.severity,
          code: `INTERACTION_${rule.conflictDrugCode}`,
          message: rule.message,
        });
      }
    }
    return findings;
  }
}

export class DosePolicy implements IScreeningPolicy {
  public screen(context: {
    medicationCode: string;
    dosageValue: number;
    dosageUnit: string;
    patientAllergies: string[];
    activeMedicationCodes: string[];
    safetyDefinitions: Record<string, MedicationSafetyDefinition>;
  }): ScreeningFinding[] {
    const definition = context.safetyDefinitions[context.medicationCode];
    if (!definition) return [];

    // Simple dosing check against daily limits
    if (
      context.dosageUnit.toLowerCase() === definition.doseUnit.toLowerCase() &&
      context.dosageValue > definition.doseLimit
    ) {
      return [
        {
          policyName: 'DosePolicy',
          medicationCode: context.medicationCode,
          severity: 'BLOCKED',
          code: 'DOSE_LIMIT_EXCEEDED',
          message: `Dose of ${context.dosageValue}${context.dosageUnit} exceeds safety limit of ${definition.doseLimit}${definition.doseUnit}`,
        },
      ];
    }
    return [];
  }
}

export class DuplicateTherapyPolicy implements IScreeningPolicy {
  public screen(context: {
    medicationCode: string;
    dosageValue: number;
    dosageUnit: string;
    patientAllergies: string[];
    activeMedicationCodes: string[];
    safetyDefinitions: Record<string, MedicationSafetyDefinition>;
  }): ScreeningFinding[] {
    // Simple mock heuristic: check if drug codes belong to same therapeutic class (e.g. sharing prefixes like 'NSAID-')
    const findings: ScreeningFinding[] = [];
    const getTherapeuticClass = (code: string): string | null => {
      if (code.startsWith('NSAID-')) return 'NSAID';
      if (code.startsWith('OPIOID-')) return 'OPIOID';
      return null;
    };

    const currentClass = getTherapeuticClass(context.medicationCode);
    if (!currentClass) return [];

    for (const activeCode of context.activeMedicationCodes) {
      if (activeCode !== context.medicationCode && getTherapeuticClass(activeCode) === currentClass) {
        findings.push({
          policyName: 'DuplicateTherapyPolicy',
          medicationCode: context.medicationCode,
          severity: 'WARNING',
          code: `DUP_${currentClass}`,
          message: `Duplicate therapy detected in class ${currentClass} with active drug ${activeCode}`,
        });
      }
    }
    return findings;
  }
}
