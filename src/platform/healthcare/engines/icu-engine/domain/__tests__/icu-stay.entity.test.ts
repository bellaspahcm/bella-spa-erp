/**
 * IcuStay Aggregate Root Tier 1 Unit Test
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/icu-engine/domain/__tests__
 */

import { IcuStay } from '../icu-stay.entity';
import { SofaScoringStrategy } from '../scoring/sofa-scoring.strategy';

describe('IcuStay Aggregate Root — Tier 1 Unit Tests', () => {
  const TENANT_ID = 'tenant-icu-test';
  const ENCOUNTER_ID = 'enc-icu-999';
  const PATIENT_ID = 'pat-icu-999';
  const BED_ID = 'bed-icu-01';
  const WARD_ID = 'ward-icu-cardiac';

  it('should create valid IcuStay aggregate in ADMITTED status', () => {
    const stay = IcuStay.create({
      id: 'icu-stay-001',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
    });

    expect(stay.id).toBe('icu-stay-001');
    expect(stay.status).toBe('ADMITTED');
    expect(stay.ventilatorSessions).toHaveLength(0);
  });

  it('should manage ventilator session as internal aggregate component', () => {
    const stay = IcuStay.create({
      id: 'icu-stay-002',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
    });

    const vent = stay.startVentilatorSession({
      sessionId: 'vent-session-001',
      mode: 'AC',
      settings: { fio2: 50, peep: 8, tidalVolume: 450, respiratoryRate: 16, pressureSupport: 10 },
    });

    expect(stay.ventilatorSessions).toHaveLength(1);
    expect(vent.status).toBe('ACTIVE');

    stay.stopVentilatorSession(vent.id);
    expect(stay.ventilatorSessions[0].status).toBe('DISCONTINUED');
  });

  it('should reject stepDown if patient is actively on mechanical ventilation', () => {
    const stay = IcuStay.create({
      id: 'icu-stay-003',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
    });

    stay.startVentilatorSession({
      sessionId: 'vent-session-002',
      mode: 'AC',
      settings: { fio2: 40, peep: 5, tidalVolume: 400, respiratoryRate: 14, pressureSupport: 5 },
    });

    stay.markStabilized();

    expect(() => {
      stay.stepDown();
    }).toThrow('actively on mechanical ventilation');
  });

  it('should calculate score via strategy without aggregate knowing strategy details', () => {
    const stay = IcuStay.create({
      id: 'icu-stay-004',
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
    });

    const sofaStrategy = new SofaScoringStrategy();
    const result = stay.calculateClinicalScore(sofaStrategy, {
      vitals: { heartRate: 80, meanArterialPressure: 85, temperature: 37.0, respiratoryRate: 16, spo2: 98 },
      labs: { pao2: 450, plateletCount: 220, bilirubin: 0.9, creatinine: 0.9 },
      clinical: { glasgowComaScale: 15, urineOutput: 1600 },
    });

    expect(result.scoreName).toBe('SOFA');
    expect(result.scoreValue).toBe(0);
    expect(stay.scoreHistory).toHaveLength(1);
  });
});
