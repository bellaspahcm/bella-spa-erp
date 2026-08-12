/**
 * EmergencyEngineService Unit & Orchestration Tests (Tier 1)
 *
 * @module platform/healthcare/engines/emergency-engine/__tests__
 */

import { EmergencyEngineService } from '../emergency-engine.service';
import { SupabaseTriageRepository } from '../infrastructure/supabase-triage.repository';
import { SupabaseEmergencyBayRepository } from '../infrastructure/supabase-emergency-bay.repository';
import { SupabaseEmergencyDispositionRepository } from '../infrastructure/supabase-emergency-disposition.repository';
import { EmergencyBay } from '../domain/emergency-bay.resource';

describe('EmergencyEngineService Orchestrator — Tier 1 Unit Tests', () => {
  let service: EmergencyEngineService;
  let bayRepository: SupabaseEmergencyBayRepository;

  beforeEach(() => {
    bayRepository = new SupabaseEmergencyBayRepository();
    service = new EmergencyEngineService({
      triageRepository: new SupabaseTriageRepository(),
      bayRepository,
      dispositionRepository: new SupabaseEmergencyDispositionRepository(),
    });
  });

  it('should perform Triage evaluation and return structured response', async () => {
    const res = await service.performTriage({
      tenantId: 'tenant-ed-1',
      patientId: 'patient-001',
      chiefComplaint: 'Severe shortness of breath',
      assessmentInput: { chiefComplaint: 'Severe shortness of breath', isHighRiskSituation: true },
      evaluatedBy: 'nurse-001',
    });

    expect(res.triageId).toBeDefined();
    expect(res.status).toBe('COMPLETED');
    expect(res.acuityResult.acuityLevel).toBe(2);
    expect(res.acuityResult.acuityCategory).toBe('EMERGENT');
  });

  it('should allocate and release EmergencyBay resource', async () => {
    const bay = EmergencyBay.create({
      id: 'bay-01',
      tenantId: 'tenant-ed-1',
      bayCode: 'BAY-01',
      bayName: 'Bay 01',
    });
    await bayRepository.save(bay);

    const alloc = await service.allocateBay({
      tenantId: 'tenant-ed-1',
      bayId: 'bay-01',
      encounterId: 'enc-001',
      patientId: 'patient-001',
    });

    expect(alloc.status).toBe('OCCUPIED');
    expect(alloc.encounterId).toBe('enc-001');

    const rel = await service.releaseBay({
      tenantId: 'tenant-ed-1',
      bayId: 'bay-01',
    });

    expect(rel.success).toBe(true);

    const updated = await bayRepository.findById('tenant-ed-1', 'bay-01');
    expect(updated?.status).toBe('AVAILABLE');
  });

  it('should perform clinical assessment and decide disposition', async () => {
    const assess = await service.createAssessment({
      tenantId: 'tenant-ed-1',
      encounterId: 'enc-001',
      triageId: 'triage-001',
      primarySurvey: {
        airwayPatent: true,
        breathingAdequate: true,
        circulationPulsePresent: true,
        disabilityGcs: 15,
        exposureTemperature: 36.8,
      },
      secondarySurveyNote: 'Normal physical exam',
      vitals: {
        heartRate: 72,
        respiratoryRate: 16,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        oxygenSaturation: 99,
        temperatureCelsius: 36.8,
        recordedAt: new Date(),
      },
      assessedBy: 'doc-001',
    });

    expect(assess.status).toBe('COMPLETED');

    const disp = await service.decideDisposition({
      tenantId: 'tenant-ed-1',
      encounterId: 'enc-001',
      patientId: 'patient-001',
      dispositionType: 'DISCHARGE',
      decidedBy: 'doc-001',
      dischargeMetadata: {
        dischargeInstructions: 'Take medication and follow up in 5 days.',
        prescriptionsIssued: true,
      },
    });

    expect(disp.status).toBe('DECIDED');
    expect(disp.dispositionType).toBe('DISCHARGE');
  });
});
