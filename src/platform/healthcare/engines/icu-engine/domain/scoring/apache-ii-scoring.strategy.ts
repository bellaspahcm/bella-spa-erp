/**
 * APACHE II Scoring Strategy
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Pure Strategy Pattern: Decoupled scoring logic
 * 
 * @module platform/healthcare/engines/icu-engine/domain/scoring
 */

import type { IScoringStrategy, ScoringInput, ScoringResult } from './scoring-strategy.interface';

export class ApacheIIScoringStrategy implements IScoringStrategy {
  readonly name = 'APACHE_II';

  calculateScore(input: ScoringInput): ScoringResult {
    const { vitals, labs, clinical, patientAge = 35, hasChronicOrganFailure = false } = input;

    let agePoints = 0;
    if (patientAge >= 75) agePoints = 6;
    else if (patientAge >= 65) agePoints = 5;
    else if (patientAge >= 55) agePoints = 3;
    else if (patientAge >= 45) agePoints = 2;

    let chronicPoints = 0;
    if (hasChronicOrganFailure) {
      chronicPoints = 5;
    }

    let tempPoints = 0;
    const temp = vitals.temperature;
    if (temp >= 41.0 || temp <= 29.9) tempPoints = 4;
    else if (temp >= 39.0 || temp <= 31.9) tempPoints = 3;
    else if (temp >= 38.5 || temp <= 33.9) tempPoints = 1;

    let mapPoints = 0;
    const map = vitals.meanArterialPressure;
    if (map >= 160 || map <= 49) mapPoints = 4;
    else if (map >= 130 || map <= 69) mapPoints = 3;
    else if (map >= 110 && map <= 129) mapPoints = 2;

    let hrPoints = 0;
    const hr = vitals.heartRate;
    if (hr >= 180 || hr <= 39) hrPoints = 4;
    else if (hr >= 140 || hr <= 54) hrPoints = 3;
    else if (hr >= 110 && hr <= 139) hrPoints = 2;

    let rrPoints = 0;
    const rr = vitals.respiratoryRate;
    if (rr >= 50 || rr <= 5) rrPoints = 4;
    else if (rr >= 35 || rr <= 9) rrPoints = 3;
    else if (rr >= 25 && rr <= 34) rrPoints = 1;

    const gcsPoints = 15 - clinical.glasgowComaScale;

    let creatPoints = 0;
    const creat = labs.creatinine;
    if (creat >= 3.5) creatPoints = 4;
    else if (creat >= 2.0 && creat <= 3.4) creatPoints = 3;
    else if (creat >= 1.5 && creat <= 1.9) creatPoints = 2;

    let pao2Points = 0;
    const pao2 = labs.pao2;
    if (pao2 < 55) pao2Points = 4;
    else if (pao2 >= 55 && pao2 <= 60) pao2Points = 3;
    else if (pao2 >= 61 && pao2 <= 70) pao2Points = 1;

    const acutePhysiologicalPoints = tempPoints + mapPoints + hrPoints + rrPoints + gcsPoints + creatPoints + pao2Points;
    const scoreValue = agePoints + chronicPoints + acutePhysiologicalPoints;

    let severityGrade: 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL' = 'MILD';
    if (scoreValue >= 25) severityGrade = 'CRITICAL';
    else if (scoreValue >= 15) severityGrade = 'SEVERE';
    else if (scoreValue >= 10) severityGrade = 'MODERATE';

    return {
      scoreName: this.name,
      scoreValue,
      severityGrade,
      calculatedAt: new Date(),
      details: {
        agePoints,
        chronicPoints,
        acutePhysiologicalPoints,
      },
    };
  }
}
