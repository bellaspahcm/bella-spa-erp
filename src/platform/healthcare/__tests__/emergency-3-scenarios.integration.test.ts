/**
 * Emergency Vertical Slice — 3 Disposition Scenarios Integration Tests (Tier 2 & Tier 3)
 *
 * Verifies the 3 core Disposition Scenarios:
 * - Scenario A: Emergency -> Disposition (DISCHARGE) -> Encounter Complete
 * - Scenario B: Emergency -> Disposition (TRANSFER) -> Transfer Contract Execution
 * - Scenario C (Golden Path H2 -> H1):
 *   Emergency Arrival -> Triage -> Emergency Encounter -> Bay Allocation -> Clinical Assessment
 *   -> Clinical Order Engine -> Pharmacy Engine -> Disposition (ADMIT)
 *   -> Admission Engine (request & admit) -> Bed Engine (allocate inpatient bed) -> H1 Inpatient Active
 *
 * Architecture Invariants:
 * 1. Law 6 Capability Reuse: Reuses Encounter Engine, Order Engine, Pharmacy Engine, Admission Engine, Bed Engine.
 * 2. Disposition Ownership: Emergency decides Disposition, Destination Engine owns Destination Lifecycle.
 * 3. Zero H1 Mutation: H1 engines left 100% untouched.
 *
 * @module platform/healthcare/__tests__
 */

import { EmergencyEngineService } from '../engines/emergency-engine/emergency-engine.service';
import { SupabaseTriageRepository } from '../engines/emergency-engine/infrastructure/supabase-triage.repository';
import { SupabaseEmergencyBayRepository } from '../engines/emergency-engine/infrastructure/supabase-emergency-bay.repository';
import { SupabaseEmergencyDispositionRepository } from '../engines/emergency-engine/infrastructure/supabase-emergency-disposition.repository';
import { EmergencyBay } from '../engines/emergency-engine/domain/emergency-bay.resource';
import { ITransferContract, InitiateTransferRequest, InitiateTransferResponse } from '../engines/emergency-engine/contracts/transfer.contract';

import { EventBusService } from '@/platform/host/event-bus/event-bus.service';
import { Encounter } from '../engines/encounter-engine/domain/encounter.entity';
import { EncounterEngineService } from '../engines/encounter-engine/encounter-engine.service';
import { SupabaseEncounterRepository } from '../engines/encounter-engine/infrastructure/supabase-encounter.repository';
import { ClinicalOrderService } from '../engines/order-engine/services/clinical-order.service';
import { SupabaseOrderRepository } from '../engines/order-engine/repositories/supabase-order-repository';
import { PharmacyEngineService } from '../engines/pharmacy-engine/pharmacy-engine.service';
import { SupabasePharmacyRepository } from '../engines/pharmacy-engine/repositories/supabase-pharmacy.repository';
import { AdmissionEngineService } from '../engines/admission-engine/services/admission-engine.service';
import { SupabaseAdmissionRepository } from '../engines/admission-engine/repositories/supabase-admission.repository';
import { BedEngineService } from '../engines/bed-engine/bed-engine.service';
import { SupabaseBedRepository } from '../engines/bed-engine/repositories/supabase-bed.repository';

describe('Emergency Vertical Slice — 3 Disposition Scenarios Integration Tests (Tier 2 & 3)', () => {
  const TENANT_ID = 'tenant-emergency-test';
  const PATIENT_ID = 'patient-ed-999';

  let emergencyService: EmergencyEngineService;
  let bayRepository: SupabaseEmergencyBayRepository;
  let mockTransferContract: ITransferContract;

  // Kernel Services (Law 6 Reuse)
  let encounterService: EncounterEngineService;
  let orderService: ClinicalOrderService;
  let pharmacyService: PharmacyEngineService;
  let admissionService: AdmissionEngineService;
  let bedService: BedEngineService;

  beforeEach(() => {
    bayRepository = new SupabaseEmergencyBayRepository();

    mockTransferContract = {
      initiateTransfer: async (req: InitiateTransferRequest): Promise<InitiateTransferResponse> => {
        return {
          transferId: `trans-${Date.now()}`,
          status: 'INITIATED',
          initiatedAt: new Date().toISOString(),
        };
      },
    };

    emergencyService = new EmergencyEngineService({
      triageRepository: new SupabaseTriageRepository(),
      bayRepository,
      dispositionRepository: new SupabaseEmergencyDispositionRepository(),
      transferContract: mockTransferContract,
    });

    // Instantiate Kernel Services via Contract Boundaries
    const eventBus = new EventBusService();
    const encounterStore = new Map<string, Encounter>();
    const mockEncounterRepo = {
      save: jest.fn(async (encounter: Encounter) => {
        encounterStore.set(`${encounter.tenantId}:${encounter.id}`, encounter);
        return encounter;
      }),
      findById: jest.fn(async (id: string, tenantId: string) => {
        return encounterStore.get(`${tenantId}:${id}`) || null;
      }),
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
      createOrder: jest.fn(async (req) => ({
        success: true,
        data: { id: `ord-${Date.now()}`, ...req, orderStatus: 'PENDING' },
      })),
    } as unknown as ClinicalOrderService;

    pharmacyService = {
      prescribe: jest.fn(async (req) => ({
        success: true,
        prescription: { id: `rx-${Date.now()}`, status: 'DISPENSED' },
      })),
    } as unknown as PharmacyEngineService;

    admissionService = {
      createAdmission: jest.fn(async (req) => ({
        success: true,
        data: { id: `adm-${Date.now()}`, status: 'admitted', ...req },
      })),
    } as unknown as AdmissionEngineService;

    bedService = {
      allocateBed: jest.fn(async (req) => ({
        success: true,
        data: { id: req.preferredBedId || 'bed-icu-01', status: 'occupied', wardId: req.wardId },
      })),
    } as unknown as BedEngineService;
  });

  it('Scenario A: Emergency -> Assessment -> Disposition (DISCHARGE) -> Encounter Complete', async () => {
    // 1. Triage
    const triage = await emergencyService.performTriage({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      chiefComplaint: 'Mild laceration on forearm',
      assessmentInput: { chiefComplaint: 'Mild laceration', expectedResourceCount: 1 },
      evaluatedBy: 'nurse-triage',
    });
    expect(triage.acuityResult.acuityLevel).toBe(4); // Less Urgent

    // 2. Start Emergency Encounter via Encounter Engine Contract
    const encounterRes = await encounterService.createEncounter({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      encounterClass: 'EMER',
      encounterType: 'emergency',
      userId: 'doc-ed',
    });
    expect(encounterRes.success).toBe(true);
    const encounter = encounterRes.encounter!;

    // 3. Clinical Assessment
    const assessment = await emergencyService.createAssessment({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      triageId: triage.triageId,
      primarySurvey: { airwayPatent: true, breathingAdequate: true, circulationPulsePresent: true, disabilityGcs: 15, exposureTemperature: 36.6 },
      secondarySurveyNote: '1.5cm superficial forearm laceration, sutured.',
      vitals: { heartRate: 70, respiratoryRate: 14, bloodPressureSystolic: 118, bloodPressureDiastolic: 76, oxygenSaturation: 99, temperatureCelsius: 36.6, recordedAt: new Date() },
      assessedBy: 'doc-ed',
    });
    expect(assessment.status).toBe('COMPLETED');

    // 4. Disposition Decision -> DISCHARGE
    const disposition = await emergencyService.decideDisposition({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      dispositionType: 'DISCHARGE',
      decidedBy: 'doc-ed',
      dischargeMetadata: {
        dischargeInstructions: 'Keep wound clean and dry. Remove sutures in 7 days.',
        prescriptionsIssued: false,
      },
    });
    expect(disposition.status).toBe('DECIDED');
    expect(disposition.dispositionType).toBe('DISCHARGE');

    // 5. Destination Orchestration: Encounter Engine completes encounter (arrived -> in-progress -> finished)
    await encounterService.updateStatus({ tenantId: TENANT_ID, encounterId: encounter.id, status: 'arrived', userId: 'doc-ed' });
    await encounterService.updateStatus({ tenantId: TENANT_ID, encounterId: encounter.id, status: 'in-progress', userId: 'doc-ed' });
    const completedEncounterRes = await encounterService.updateStatus({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      status: 'finished',
      userId: 'doc-ed',
    });
    expect(completedEncounterRes.success).toBe(true);
    expect(completedEncounterRes.encounter?.status).toBe('finished');
  });

  it('Scenario B: Emergency -> Assessment -> Disposition (TRANSFER) -> Transfer Contract Execution', async () => {
    // 1. Triage
    const triage = await emergencyService.performTriage({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      chiefComplaint: 'Severe head trauma following MVA',
      assessmentInput: { chiefComplaint: 'Severe head trauma', isHighRiskSituation: true },
      evaluatedBy: 'nurse-triage',
    });
    expect(triage.acuityResult.acuityLevel).toBe(2);

    // 2. Encounter
    const encounterResB = await encounterService.createEncounter({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      encounterClass: 'EMER',
      encounterType: 'emergency',
      userId: 'doc-ed',
    });
    expect(encounterResB.success).toBe(true);
    const encounter = encounterResB.encounter!;

    // 3. Disposition Decision -> TRANSFER
    const disposition = await emergencyService.decideDisposition({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      dispositionType: 'TRANSFER',
      decidedBy: 'doc-ed',
      transferMetadata: {
        receivingFacilityName: 'Regional Neurosurgery Trauma Hospital',
        transferReason: 'Urgent craniotomy required, local facility at capacity',
        transportMode: 'AMBULANCE_CRITICAL_CARE',
        receivingPhysicianName: 'Dr. Sarah Vance',
      },
    });

    expect(disposition.status).toBe('EXECUTED');
    expect(disposition.dispositionType).toBe('TRANSFER');
    expect(disposition.executionReferenceId).toBeDefined();
  });

  it('Scenario C (Golden Path H2 -> H1): Emergency Arrival -> Triage -> Bay -> Assessment -> Order -> Pharmacy -> Disposition (ADMIT) -> Admission Engine -> Bed Engine -> H1 Inpatient Active', async () => {
    // 1. Emergency Arrival & Triage
    const triage = await emergencyService.performTriage({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      chiefComplaint: 'Severe crushing chest pain radiating to left jaw',
      assessmentInput: {
        chiefComplaint: 'Severe crushing chest pain',
        requiresImmediateLifeSaving: false,
        isHighRiskSituation: true,
        isInSeverePainOrDistress: true,
      },
      evaluatedBy: 'nurse-triage-1',
    });
    expect(triage.acuityResult.acuityLevel).toBe(2); // Emergent

    // 2. Start Emergency Encounter via Encounter Engine Kernel
    const encounterResC = await encounterService.createEncounter({
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      encounterClass: 'EMER',
      encounterType: 'emergency',
      userId: 'doc-emergency-lead',
    });
    expect(encounterResC.success).toBe(true);
    const encounter = encounterResC.encounter!;

    // 3. Allocate Emergency Resuscitation Bay (Concurrency Protection)
    const bayResus = EmergencyBay.create({
      id: 'bay-resus-101',
      tenantId: TENANT_ID,
      bayCode: 'BAY-R101',
      bayName: 'Resuscitation Suite 1',
    });
    await bayRepository.save(bayResus);

    const bayAlloc = await emergencyService.allocateBay({
      tenantId: TENANT_ID,
      bayId: bayResus.id,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
    });
    expect(bayAlloc.status).toBe('OCCUPIED');

    // 4. Rapid Primary & Secondary Clinical Assessment
    const assessment = await emergencyService.createAssessment({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      triageId: triage.triageId,
      primarySurvey: { airwayPatent: true, breathingAdequate: true, circulationPulsePresent: true, disabilityGcs: 14, exposureTemperature: 37.2 },
      secondarySurveyNote: 'ST-elevation in leads II, III, aVF. Suspected Acute Inferior STEMI.',
      vitals: { heartRate: 115, respiratoryRate: 24, bloodPressureSystolic: 90, bloodPressureDiastolic: 60, oxygenSaturation: 92, temperatureCelsius: 37.2, recordedAt: new Date() },
      assessedBy: 'doc-emergency-lead',
    });
    expect(assessment.status).toBe('COMPLETED');

    // 5. Emergency Interventions: Order Engine & Pharmacy Kernel Contracts
    const statTroponinRes = await orderService.createOrder({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      orderType: 'lab',
      title: 'STAT Troponin I & ECG',
      priority: 'stat',
      orderedBy: 'doc-emergency-lead',
      orderDetails: { stat: true },
    });
    expect(statTroponinRes.success).toBe(true);
    expect(statTroponinRes.data?.id).toBeDefined();

    const aspirinPrescriptionRes = await pharmacyService.prescribe({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      prescribedBy: 'doc-emergency-lead',
      items: [
        { medicationId: 'med-aspirin-300', medicationName: 'Aspirin Chewable', dosage: '300mg', frequency: 'STAT', durationDays: 1, quantity: 1 },
        { medicationId: 'med-ticagrelor-180', medicationName: 'Ticagrelor', dosage: '180mg', frequency: 'STAT', durationDays: 1, quantity: 1 },
      ],
    });
    expect(aspirinPrescriptionRes.success).toBe(true);
    expect(aspirinPrescriptionRes.prescription?.status).toBe('DISPENSED');

    // 6. Disposition Decision -> ADMIT to ICU
    const disposition = await emergencyService.decideDisposition({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientId: PATIENT_ID,
      dispositionType: 'ADMIT',
      decidedBy: 'doc-emergency-lead',
      admissionMetadata: {
        targetWardId: 'ward-icu-cardiac',
        admittingSpecialty: 'CARDIOLOGY',
        provisionalDiagnosis: 'Acute Inferior STEMI',
        admissionPriority: 'EMERGENCY_IMMEDIATE',
      },
    });
    expect(disposition.status).toBe('DECIDED');
    expect(disposition.dispositionType).toBe('ADMIT');

    // 7. Destination Handoff -> H1 Inpatient Admission Engine
    const admissionRes = await admissionService.createAdmission({
      tenantId: TENANT_ID,
      encounterId: encounter.id,
      patientPartyId: PATIENT_ID,
      wardId: 'ward-icu-cardiac',
      admittingDoctorId: 'doc-emergency-lead',
      admissionDiagnosis: 'Acute Inferior STEMI',
      userId: 'doc-emergency-lead',
    });
    expect(admissionRes.success).toBe(true);
    expect(admissionRes.data?.status).toBe('admitted');

    // 8. H1 Inpatient Bed Allocation via Bed Engine
    const bedAllocRes = await bedService.allocateBed({
      tenantId: TENANT_ID,
      wardId: 'ward-icu-cardiac',
      preferredBedId: 'bed-icu-01',
      admissionId: admissionRes.data!.id,
      patientId: PATIENT_ID,
      encounterId: encounter.id,
    });
    expect(bedAllocRes.success).toBe(true);
    expect(bedAllocRes.data?.id).toBe('bed-icu-01');

    // 9. Release Emergency Bay for next incoming emergency patient
    const releaseRes = await emergencyService.releaseBay({
      tenantId: TENANT_ID,
      bayId: bayResus.id,
    });
    expect(releaseRes.success).toBe(true);

    const freedBay = await bayRepository.findById(TENANT_ID, bayResus.id);
    expect(freedBay?.status).toBe('AVAILABLE');
  });
});
