/**
 * SOFA (Sequential Organ Failure Assessment) Scoring Strategy
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Pure Strategy Pattern: Decoupled scoring logic
 * 
 * @module platform/healthcare/engines/icu-engine/domain/scoring
 */

import type { IScoringStrategy, ScoringInput, ScoringResult } from './scoring-strategy.interface';

export class SofaScoringStrategy implements IScoringStrategy {
  readonly name = 'SOFA';

  calculateScore(input: ScoringInput): ScoringResult {
    const { vitals, labs, clinical } = input;

    let respiration = 0;
    const pfRatio = labs.pao2;
    if (pfRatio < 100) respiration = 4;
    else if (pfRatio < 200) respiration = 3;
    else if (pfRatio < 300) respiration = 2;
    else if (pfRatio < 400) respiration = 1;

    let coagulation = 0;
    const platelets = labs.plateletCount;
    if (platelets < 20) coagulation = 4;
    else if (platelets < 50) coagulation = 3;
    else if (platelets < 100) coagulation = 2;
    else if (platelets < 150) coagulation = 1;

    let liver = 0;
    const bilirubin = labs.bilirubin;
    if (bilirubin >= 12.0) liver = 4;
    else if (bilirubin >= 6.0) liver = 3;
    else if (bilirubin >= 2.0) liver = 2;
    else if (bilirubin >= 1.2) liver = 1;

    let cardiovascular = 0;
    const map = vitals.meanArterialPressure;
    const vaso = clinical.vasopressorDoses || {};
    const dopamine = vaso.dopamine || 0;
    const epinephrine = vaso.epinephrine || 0;
    const norepinephrine = vaso.norepinephrine || 0;
    const dobutamine = vaso.dobutamine || 0;

    if (dopamine > 15 || epinephrine > 0.1 || norepinephrine > 0.1) cardiovascular = 4;
    else if (dopamine > 5 || (epinephrine > 0 && epinephrine <= 0.1) || (norepinephrine > 0 && norepinephrine <= 0.1)) cardiovascular = 3;
    else if (dopamine > 0 || dobutamine > 0) cardiovascular = 2;
    else if (map < 70) cardiovascular = 1;

    let cns = 0;
    const gcs = clinical.glasgowComaScale;
    if (gcs < 6) cns = 4;
    else if (gcs >= 6 && gcs <= 9) cns = 3;
    else if (gcs >= 10 && gcs <= 12) cns = 2;
    else if (gcs >= 13 && gcs <= 14) cns = 1;

    let renal = 0;
    const creatinine = labs.creatinine;
    const urine = clinical.urineOutput;

    if (creatinine >= 5.0 || urine < 200) renal = 4;
    else if (creatinine >= 3.5 || urine < 500) renal = 3;
    else if (creatinine >= 2.0 && creatinine <= 3.4) renal = 2;
    else if (creatinine >= 1.2 && creatinine <= 1.9) renal = 1;

    const scoreValue = respiration + coagulation + liver + cardiovascular + cns + renal;

    let severityGrade: 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL' = 'MILD';
    if (scoreValue >= 12) severityGrade = 'CRITICAL';
    else if (scoreValue >= 8) severityGrade = 'SEVERE';
    else if (scoreValue >= 4) severityGrade = 'MODERATE';

    return {
      scoreName: this.name,
      scoreValue,
      severityGrade,
      calculatedAt: new Date(),
      details: {
        respiration,
        coagulation,
        liver,
        cardiovascular,
        cns,
        renal,
      },
    };
  }
}
