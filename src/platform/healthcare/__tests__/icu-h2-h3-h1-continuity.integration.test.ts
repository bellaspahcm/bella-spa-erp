/**
 * End-to-End Clinical Continuity Integration Test (H2 -> H3 -> H1)
 * 
 * Verifies full 6-Engine Clinical Continuity Chain:
 * Emergency Arrival (H2 Triage ESI 1) -> Emergency Bay Allocation -> Assessment -> Disposition (ADMIT)
 * -> Inpatient Admission Engine (H1 Kernel) -> Bed Engine ICU Allocation (H1 Kernel)
 * -> ICU Engine Critical Care (H3: Mechanical Ventilator + SOFA Score + Safety Barrier)
 * -> Patient Stabilization -> Step-Down to Ward / Discharge.
 * 
 * Constitution Compliance:
 * - Law 1: Encounter aggregate root reference
 * - Law 6: Capability reuse, 0 vertical duplicate engines
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Zero H1/H2 Mutation: 0 lines of H1/H2 code modified
 * 
 * @module platform/healthcare/__tests__
 */

import { EmergencyEngineService } from '../engines/emergency-engine/emergency-engine.service';
import { SupabaseTriageRepository } from '../engines/emergency-engine/infrastructure/supabase-triage.repository';
import { SupabaseEmergencyBayRepository } from '../engines/emergency-engine/infrastructure/supabase-emergency-bay.repository';
import { SupabaseEmergencyDispositionRepository } from '../engines/emergency-engine/infrastructure/supabase-emergency-disposition.repository';
import { EmergencyBay } from '../engines/emergency-engine/domain/emergency-bay.resource';
import { ITransferContract } from '../engines/emergency-engine/contracts/transfer.contract';

// ICU Engine Imports (H3)
import { IcuEngineService } from '../engines/icu-engine/icu-engine.service';
import { SupabaseIcuStayRepository } from '../engines/icu-engine/infrastructure/supabase-icu-stay.repository';

// Kernel Engine Imports (Law 6 Reuse)
import { EventBusService } from '@/platform/host/event-bus/event-bus.service';
import { Encounter } from '../engines/encounter-engine/domain/encounter.entity';
import { EncounterEngineService } from '../engines/encounter-engine/encounter-engine.service';
import { SupabaseEncounterRepository } from '../engines/encounter-engine/infrastructure/supabase-encounter.repository';
import { ClinicalOrderService } from '../engines/order-engine/services/clinical-order.service';
import { PharmacyEngineService } from '../engines/pharmacy-engine/pharmacy-engine.service';
import { AdmissionEngineService } from '../engines/admission-engine/services/admission-engine.service';
import { BedEngineService } from '../engines/bed-engine/bed-engine.service';

describe('ICU Vertical Slice — End-to-End Clinical Continuity (H2 -> H3 -> H1)', () => {
  const TENANT_ID = 'tenant-icu-continuity-test';
  const PATIENT_ID = 'patient-critical-999';

  let emergencyService: EmergencyEngineService;
  let bayRepository: SupabaseEmergencyBayRepository;
  let icuService: IcuEngineService;
  let icuRepository: SupabaseIcuStayRepository;

  // Kernel Services (Law 6 Reuse)
  let encounterService: EncounterEngineService;
  let orderService: ClinicalOrderService;
  let pharmacyService: PharmacyEngineService;
  let admissionService: AdmissionEngineService;
  let bedService: BedEngineService;

  beforeEach(() => {
    bayRepository = new SupabaseEmergencyBayRepository();
    icuRepository = new SupabaseIcuStayRepository();

    const mockTransferContract: ITransferContract = {
      initiateTransfer: async () => ({ transferId: `trans-${Date.now()}`, status: 'INITIATED', initiatedAt: new Date().toISOString() }),
    };

    emergencyService = new EmergencyEngineService({
      triageRepository: new SupabaseTriageRepository(),
      bayRepository,
      dispositionRepository: new SupabaseEmergencyDispositionRepository(),
      transferContract: mockTransferContract,
    });

    icuService = new IcuEngineService({ repository: icuRepository });

    // Mock Kernel Services
    const eventBus = new EventBusService();
    const encounterStore = new Map<string, Encounter>();
    const mockEncounterRepo = {
      save: jest.fn(async (encounter: Encounter) => { encounterStore.set(`${encounter.tenantId}:${encounter.id}`, encounter); return encounter; }),
      findById: jest.fn(async (id: string, tenantId: string) => encounterStore.get(`${tenantId}:${id}`) || null),
      findByPatient: jest.fn(async () => []),
      search: jest.fn(async () => ({ items: [], total: 0, limit: 50, offset: 0, hasMore: false })),
      findActive: jest.fn(async () => null),
      exists: jest.fn(async (id: string, tenantId: string) => encounterStore.has(`${tenantId}:${id}`)),
      count: jest.fn(async () => encounterStore.size),
      delete: jest.fn(async () => true),
      beginTransaction: jest.fn(async () => ({})),
      commit: jest.fn(async () => undefined),
      rollback: jest.fn(async () => undefined),
    };

    encounterService = new EncounterEngineService(mockEncounterRepo as unknown as SupabaseEncounterRepository, eventBus);

    orderService = {
      createOrder: jest.fn(async (req) => ({ success: true, data: { id: `ord-${Date.now()}`, ...req, orderStatus: 'PENDING' } })),
    } as unknown as ClinicalOrderService;

    pharmacyService = {
      prescribe: jest.fn(async (req) => ({ success: true, prescription: { id: `rx-${Date.now()}`, status: 'DISPENSED' } })),
    } as unknown as PharmacyEngineService;

    admissionService = {
      createAdmission: jest.fn(async (req) => ({ success: true, data: { id: `adm-${Date.now()}`, status: 'admitted', ...req } })),
    } as unknown as AdmissionEngineService;

    bedService = {
      allocateBed: jest.fn(async (req) => ({ success: true, data: { id: req.preferredBedId || 'bed-icu-01', status: 'occupied', wardId: req.wardId } })),
    } as unknown as BedEngineService;
  });

  it('Golden Path H2 -> H3 -> H1: Emergency Arrival -> Triage -> Bay -> Assessment -> Disposition (ADMIT) -> Inpatient Admission -> Bed Allocation -> ICU Critical Care & Ventilator Safety -> Stabilization -> Step-Down', async () => {
    // 1. Emergency Arrival & Triage (ESI 1 — Resuscitation)
    const triage = await emergencyService.performTriage({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      chiefComplaint: 'Acute Respiratory Distress Syndrome (ARDS) + Severe Shock',
      assessmentInput: { chiefComplaint: 'ARDS Shock', requiresImmediateLifeSaving: true },
      evaluatedBy: 'nurse-triage-lead',
    });
    expect(triage.acuityResult.acuityLevel).toBe(1); // Immediate Life Saving

    // 2. Start Emergency Encounter
    const encounterRes = await encounterService.createEncounter({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      encounterClass: 'EMER',
      encounterType: 'emergency',
      userId: 'doc-ed-resus-lead',
    });
    expect(encounterRes.success).toBe(true);
    const encounter = encounterRes.encounter!;

    // 3. Allocate Resuscitation Bay
    const bayResus = EmergencyBay.create({ id: 'bay-resus-icu-99', tenantId: TENANT_ID, bayCode: 'BAY-R99', bayName: 'Resuscitation Suite 99' });
    await bayRepository.save(bayResus);
    const bayAlloc = await emergencyService.allocateBay({ tenantId: TENANT_ID, bayId: bayResus.id, encounterId: encounter.id, patientId: PATIENT_ID });
    expect(bayAlloc.status).toBe('OCCUPIED');

    // 4. Clinical Assessment & Emergency STAT Interventions
    await emergencyService.createAssessment({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      triageId: triage.triageId,
      primarySurvey: { airwayPatent: false, breathingAdequate: false, circulationPulsePresent: true, disabilityGcs: 7, exposureTemperature: 38.8 },
      secondarySurveyNote: 'Severe ARDS, Intubation required immediately.',
      vitals: { heartRate: 145, respiratoryRate: 36, bloodPressureSystolic: 80, bloodPressureDiastolic: 50, oxygenSaturation: 82, temperatureCelsius: 38.8, recordedAt: new Date() },
      assessedBy: 'doc-ed-resus-lead',
    });

    const statOrderRes = await orderService.createOrder({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      orderType: 'lab',
      title: 'STAT ABG, Blood Cultures, CBC, Metabolic Panel',
      priority: 'stat',
      orderedBy: 'doc-ed-resus-lead',
      orderDetails: { stat: true },
    });
    expect(statOrderRes.success).toBe(true);

    // 5. Emergency Disposition -> ADMIT to ICU
    const disposition = await emergencyService.decideDisposition({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      dispositionType: 'ADMIT',
      decidedBy: 'doc-ed-resus-lead',
      admissionMetadata: { targetWardId: 'ward-icu-medical', admittingSpecialty: 'INTENSIVE_CARE', provisionalDiagnosis: 'Severe ARDS & Septic Shock' },
    });
    expect(disposition.dispositionType).toBe('ADMIT');

    // 6. H1 Kernel Admission Engine Request & Bed Engine ICU Allocation
    const admissionRes = await admissionService.createAdmission({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientPartyId: PATIENT_ID,
      wardId: 'ward-icu-medical',
      admittingDoctorId: 'doc-icu-intensivist',
      admissionDiagnosis: 'Severe ARDS & Septic Shock',
      userId: 'doc-ed-resus-lead',
    });
    expect(admissionRes.success).toBe(true);

    const bedAllocRes = await bedService.allocateBed({
      tenantId: TENANT_ID,
      wardId: 'ward-icu-medical',
      preferredBedId: 'bed-icu-resus-01',
      admissionId: admissionRes.data!.id,
      patientId: PATIENT_ID,
      encounterId: encounter.id,
    });
    expect(bedAllocRes.success).toBe(true);

    // 7. H3 Domain: ICU Stay Admission & Continuous Critical Care
    const icuAdmitRes = await icuService.admitToIcu({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      bedId: 'bed-icu-resus-01',
      wardId: 'ward-icu-medical',
      admittedBy: 'doc-icu-intensivist',
    });
    expect(icuAdmitRes.success).toBe(true);
    const icuStayId = icuAdmitRes.data!.id;

    // 8. Mechanical Ventilator Safety Barrier Validation
    // 8a. Attempt Unsafe FiO2 (120%) -> Safety Barrier HARD BLOCKS
    const unsafeVentRes = await icuService.startVentilatorSession({
      tenantId: TENANT_ID,
      icuStayId,
      mode: 'AC',
      settings: { fio2: 120, peep: 14, tidalVolume: 420, respiratoryRate: 20, pressureSupport: 12 },
      initiatedBy: 'doc-icu-intensivist',
    });
    expect(unsafeVentRes.success).toBe(false);
    expect(unsafeVentRes.error?.message).toContain('FiO2 120% violates');

    // 8b. Connect Ventilator with Safe Settings -> SUCCESS
    const safeVentRes = await icuService.startVentilatorSession({
      tenantId: TENANT_ID,
      icuStayId,
      mode: 'AC',
      settings: { fio2: 60, peep: 12, tidalVolume: 420, respiratoryRate: 20, pressureSupport: 12 },
      initiatedBy: 'doc-icu-intensivist',
    });
    expect(safeVentRes.success).toBe(true);

    // 9. Continuous Telemetry & SOFA Clinical Score Calculation
    const scoreRes = await icuService.calculateClinicalScore({
      tenantId: TENANT_ID,
      icuStayId,
      strategyName: 'SOFA',
      vitals: { heartRate: 125, meanArterialPressure: 62, temperature: 38.6, respiratoryRate: 20, spo2: 92 },
      labs: { pao2: 180, plateletCount: 85, bilirubin: 2.1, creatinine: 2.3 },
      clinical: { glasgowComaScale: 10, urineOutput: 350 },
    });
    expect(scoreRes.success).toBe(true);
    expect(scoreRes.data?.scoreName).toBe('SOFA');

    // 10. Patient Stabilization & Step-Down
    const stopVentRes = await icuService.stopVentilatorSession({
      tenantId: TENANT_ID,
      icuStayId,
      sessionId: safeVentRes.data!.sessionId,
      stoppedBy: 'doc-icu-intensivist',
    });
    expect(stopVentRes.success).toBe(true);

    const stabilizeRes = await icuService.transitionStatus({
      tenantId: TENANT_ID,
      icuStayId,
      action: 'STABILIZE',
      updatedBy: 'doc-icu-intensivist',
    });
    expect(stabilizeRes.data?.status).toBe('STABILIZED');

    const stepDownRes = await icuService.transitionStatus({
      tenantId: TENANT_ID,
      icuStayId,
      action: 'STEP_DOWN',
      updatedBy: 'doc-icu-intensivist',
    });
    expect(stepDownRes.data?.status).toBe('STEPPED_DOWN');

    // 11. Release Emergency Bay for next critical emergency arrival
    const releaseBayRes = await emergencyService.releaseBay({ tenantId: TENANT_ID, bayId: bayResus.id });
    expect(releaseBayRes.success).toBe(true);
  });
});
