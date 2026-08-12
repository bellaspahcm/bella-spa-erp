/**
 * SOFA Scoring Strategy Tier 1 Unit Test
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/icu-engine/domain/__tests__
 */

import { SofaScoringStrategy } from '../scoring/sofa-scoring.strategy';
import type { ScoringInput } from '../scoring/scoring-strategy.interface';

describe('SofaScoringStrategy — Tier 1 Unit Tests', () => {
  let strategy: SofaScoringStrategy;

  beforeEach(() => {
    strategy = new SofaScoringStrategy();
  });

  it('should calculate score 0 for normal physiological parameters', () => {
    const input: ScoringInput = {
      vitals: {
        heartRate: 75,
        meanArterialPressure: 85,
        temperature: 36.8,
        respiratoryRate: 16,
        spo2: 98,
      },
      labs: {
        pao2: 450, // PaO2/FiO2 >= 400
        plateletCount: 250, // > 150
        bilirubin: 0.8, // < 1.2
        creatinine: 0.9, // < 1.2
      },
      clinical: {
        glasgowComaScale: 15,
        urineOutput: 1500,
      },
    };

    const result = strategy.calculateScore(input);

    expect(result.scoreName).toBe('SOFA');
    expect(result.scoreValue).toBe(0);
    expect(result.severityGrade).toBe('MILD');
  });

  it('should calculate organ failure points for critical parameters', () => {
    const input: ScoringInput = {
      vitals: {
        heartRate: 130,
        meanArterialPressure: 60, // Cardio: 1
        temperature: 38.5,
        respiratoryRate: 28,
        spo2: 88,
      },
      labs: {
        pao2: 150, // Respiration: 3
        plateletCount: 40, // Coagulation: 3
        bilirubin: 6.5, // Liver: 3
        creatinine: 3.8, // Renal: 3
      },
      clinical: {
        glasgowComaScale: 8, // CNS: 3
        urineOutput: 400,
      },
    };

    const result = strategy.calculateScore(input);

    expect(result.scoreValue).toBe(16); // 3+3+3+1+3+3
    expect(result.severityGrade).toBe('CRITICAL');
  });
});
