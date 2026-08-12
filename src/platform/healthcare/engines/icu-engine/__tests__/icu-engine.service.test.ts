/**
 * ICU Engine Service Tier 2 Orchestration Unit Test
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/icu-engine/__tests__
 */

import { IcuEngineService } from '../icu-engine.service';
import { SupabaseIcuStayRepository } from '../infrastructure/supabase-icu-stay.repository';
import type { ICriticalObservationContract } from '../contracts/critical-observation.contract';

describe('IcuEngineService — Tier 2 Orchestration Unit Tests', () => {
  const TENANT_ID = 'tenant-icu-svc-test';
  const PATIENT_ID = 'pat-icu-svc-101';
  const ENCOUNTER_ID = 'enc-icu-svc-101';
  const BED_ID = 'bed-icu-101';
  const WARD_ID = 'ward-icu-cardiac';

  let service: IcuEngineService;
  let repository: SupabaseIcuStayRepository;
  let mockObservationContract: ICriticalObservationContract;

  beforeEach(() => {
    repository = new SupabaseIcuStayRepository();

    mockObservationContract = {
      getLatestVitals: jest.fn().mockResolvedValue([]),
      evaluateCriticalThresholds: jest.fn((vitals) => {
        if (vitals.spo2 < 90) {
          return { isCritical: true, breaches: ['Critical hypoxia (SpO2 < 90%)'] };
        }
        return { isCritical: false, breaches: [] };
      }),
    };

    service = new IcuEngineService({
      repository,
      criticalObservationContract: mockObservationContract,
    });
  });

  it('should admit patient to ICU and return stay DTO', async () => {
    const res = await service.admitToIcu({
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
      admittedBy: 'doc-icu-lead',
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.status).toBe('ADMITTED');
    expect(res.data?.bedId).toBe(BED_ID);
  });

  it('should start ventilator session with valid settings', async () => {
    const admitRes = await service.admitToIcu({
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
      admittedBy: 'doc-icu-lead',
    });

    const ventRes = await service.startVentilatorSession({
      tenantId: TENANT_ID,
      icuStayId: admitRes.data!.id,
      mode: 'AC',
      settings: { fio2: 50, peep: 8, tidalVolume: 450, respiratoryRate: 16, pressureSupport: 10 },
      initiatedBy: 'doc-icu-lead',
    });

    expect(ventRes.success).toBe(true);
    expect(ventRes.data?.sessionId).toBeDefined();
    expect(ventRes.data?.status).toBe('ACTIVE');
  });

  it('should HARD BLOCK ventilator session if settings violate safety rules', async () => {
    const admitRes = await service.admitToIcu({
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
      admittedBy: 'doc-icu-lead',
    });

    const ventRes = await service.startVentilatorSession({
      tenantId: TENANT_ID,
      icuStayId: admitRes.data!.id,
      mode: 'AC',
      settings: { fio2: 120, peep: 8, tidalVolume: 450, respiratoryRate: 16, pressureSupport: 10 }, // Invalid FiO2 120%
      initiatedBy: 'doc-icu-lead',
    });

    expect(ventRes.success).toBe(false);
    expect(ventRes.error?.message).toContain('FiO2 120% violates');
  });

  it('should calculate SOFA score via strategy pattern', async () => {
    const admitRes = await service.admitToIcu({
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
      admittedBy: 'doc-icu-lead',
    });

    const scoreRes = await service.calculateClinicalScore({
      tenantId: TENANT_ID,
      icuStayId: admitRes.data!.id,
      strategyName: 'SOFA',
      vitals: { heartRate: 110, meanArterialPressure: 65, temperature: 38.0, respiratoryRate: 22, spo2: 91 },
      labs: { pao2: 250, plateletCount: 90, bilirubin: 2.5, creatinine: 2.1 },
      clinical: { glasgowComaScale: 11, urineOutput: 450 },
    });

    expect(scoreRes.success).toBe(true);
    expect(scoreRes.data?.scoreName).toBe('SOFA');
    expect(scoreRes.data?.scoreValue).toBeGreaterThan(0);
  });

  it('should transition status from ADMITTED to STABILIZED to STEPPED_DOWN', async () => {
    const admitRes = await service.admitToIcu({
      tenantId: TENANT_ID,
      encounterId: ENCOUNTER_ID,
      patientId: PATIENT_ID,
      bedId: BED_ID,
      wardId: WARD_ID,
      admittedBy: 'doc-icu-lead',
    });

    const stabilizeRes = await service.transitionStatus({
      tenantId: TENANT_ID,
      icuStayId: admitRes.data!.id,
      action: 'STABILIZE',
      updatedBy: 'doc-icu-lead',
    });
    expect(stabilizeRes.data?.status).toBe('STABILIZED');

    const stepDownRes = await service.transitionStatus({
      tenantId: TENANT_ID,
      icuStayId: admitRes.data!.id,
      action: 'STEP_DOWN',
      updatedBy: 'doc-icu-lead',
    });
    expect(stepDownRes.data?.status).toBe('STEPPED_DOWN');
  });
});
