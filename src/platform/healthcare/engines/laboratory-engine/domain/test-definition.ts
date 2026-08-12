export interface TestDefinition {
  testCode: string;
  testName: string;
  unit: string;
  referenceRange: string;
  normalMin?: number;
  normalMax?: number;
  criticalMin?: number;
  criticalMax?: number;
}

export type RangeAssessment = 'NORMAL' | 'ABNORMAL' | 'CRITICAL';

export class RangeAssessmentStrategy {
  public static assess(value: string, definition: TestDefinition): RangeAssessment {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      // Default to NORMAL if quantitative comparison is not possible
      return 'NORMAL';
    }

    // 1. Check critical panic ranges first
    if (definition.criticalMin !== undefined && numericValue < definition.criticalMin) {
      return 'CRITICAL';
    }
    if (definition.criticalMax !== undefined && numericValue > definition.criticalMax) {
      return 'CRITICAL';
    }

    // 2. Check normal ranges next
    if (definition.normalMin !== undefined && numericValue < definition.normalMin) {
      return 'ABNORMAL';
    }
    if (definition.normalMax !== undefined && numericValue > definition.normalMax) {
      return 'ABNORMAL';
    }

    return 'NORMAL';
  }
}

// Built-in standard test configurations
export const TEST_DEFINITIONS: Record<string, TestDefinition> = {
  'K': {
    testCode: 'K',
    testName: 'Potassium',
    unit: 'mEq/L',
    referenceRange: '3.5 - 5.1 mEq/L',
    normalMin: 3.5,
    normalMax: 5.1,
    criticalMin: 2.5,
    criticalMax: 6.0,
  },
  'GLU': {
    testCode: 'GLU',
    testName: 'Glucose',
    unit: 'mg/dL',
    referenceRange: '70 - 100 mg/dL',
    normalMin: 70,
    normalMax: 100,
    criticalMin: 50,
    criticalMax: 400,
  },
};
