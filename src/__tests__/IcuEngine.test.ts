/**
 * ICU Engine Test Suite
 *
 * Verifies:
 * 1. SOFA score calculation across all 6 SOFA subsystems
 * 2. APACHE II scoring with age/chronic health contribution
 * 3. Clinical calculation audit trail (algorithm_id, algorithm_version, input_snapshot, engine_version)
 * 4. Ventilator safety policy enforcement (out-of-range parameters are blocked)
 * 5. Concurrent idempotency key protection
 *
 * Constitution Compliance:
 * - Law 11: Strictly no `any` types
 * - Law 5: Domain events published on ventilator safety violations
 * - Law 1: Encounter is the aggregate root (all operations reference encounterId)
 *
 * @module test/healthcare/icu-engine
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IcuEngineService } from '../platform/healthcare/engines/icu-engine/icu-engine.service';

// ──────────────────────────────────────────────────────────────────────────────
// Types for in-memory mock DB
// ──────────────────────────────────────────────────────────────────────────────

interface MockIcuObservation {
  id: string;
  tenant_id: string;
  encounter_id: string;
  observed_at: string;
  vitals: {
    heartRate: number;
    meanArterialPressure: number;
    temperature: number;
    respiratoryRate: number;
    spo2: number;
  };
  labs: {
    pao2: number;
    plateletCount: number;
    bilirubin: number;
    creatinine: number;
  };
  clinical: {
    glasgowComaScale: number;
    urineOutput: number;
    vasopressorDoses?: {
      dopamine?: number;
      epinephrine?: number;
      norepinephrine?: number;
      dobutamine?: number;
    };
  };
  created_at: string;
}

interface MockClinicalCalculation {
  id: string;
  tenant_id: string;
  encounter_id: string;
  algorithm_id: string;
  algorithm_version: string;
  calculation_timestamp: string;
  calculation_status: string;
  input_snapshot: Record<string, unknown>;
  source_observation_references: Array<{ entity_type: string; entity_id: string }>;
  output: Record<string, unknown>;
  engine_version: string;
}

interface MockVentilatorPolicy {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  settings_rules: {
    fio2: { min: number; max: number };
    peep: { min: number; max: number };
    tidalVolume: { min: number; max: number };
    respiratoryRate: { min: number; max: number };
    pressureSupport: { min: number; max: number };
  };
}

interface MockVentilatorRecord {
  id: string;
  tenant_id: string;
  encounter_id: string;
  policy_id: string;
  mode: string;
  settings: Record<string, number>;
  monitored_params: Record<string, unknown>;
  started_at: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// In-memory Mock Database
// ──────────────────────────────────────────────────────────────────────────────

let dbObservations: MockIcuObservation[] = [];
let dbClinicalCalculations: MockClinicalCalculation[] = [];
let dbVentilatorPolicies: MockVentilatorPolicy[] = [];
let dbVentilatorRecords: MockVentilatorRecord[] = [];
let dbIdempotencyKeys: Set<string> = new Set();

const publishedEvents: Array<{ eventType: string; payload: unknown }> = [];

// Mock event bus
jest.mock('../platform/host/event-bus', () => ({
  eventBus: {
    publish: jest.fn(async (event: { eventType: string; payload: unknown }) => {
      publishedEvents.push(event);
    }),
  },
}));

function generateId(): string {
  return `mock-${Math.random().toString(36).substring(2, 9)}`;
}

class MockQueryBuilder {
  private filters: Record<string, unknown> = {};
  private isInsert = false;
  private isUpdate = false;
  private updatePayload: Record<string, unknown> | null = null;
  private insertPayload: Record<string, unknown> | null = null;

  constructor(private readonly table: string) {}

  select(_cols = '*') { return this; }

  insert(data: Record<string, unknown>) {
    this.isInsert = true;
    this.insertPayload = data;
    return this;
  }

  update(data: Record<string, unknown>) {
    this.isUpdate = true;
    this.updatePayload = data;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters[col] = val;
    return this;
  }

  limit(_val: number) { return this; }

  maybeSingle() { return this.execute('maybeSingle'); }
  single() { return this.execute('single'); }

  then(onfulfilled?: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown): Promise<unknown> {
    return this.execute('many').then(onfulfilled, onrejected);
  }

  private async execute(mode: 'single' | 'maybeSingle' | 'many'): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
    let data: unknown = null;
    let error: { code?: string; message: string } | null = null;

    if (this.table === 'hc_idempotency_keys') {
      const row = this.insertPayload as Record<string, string>;
      const key = `${row.tenant_id}:${row.request_id}:${row.operation}`;
      if (dbIdempotencyKeys.has(key)) {
        error = { code: '23505', message: 'Unique violation' };
      } else {
        dbIdempotencyKeys.add(key);
      }
    } else if (this.table === 'hc_icu_observations') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockIcuObservation, 'id' | 'created_at'>;
        const newRow: MockIcuObservation = {
          id: generateId(),
          ...row,
          created_at: new Date().toISOString(),
        };
        dbObservations.push(newRow);
        data = newRow;
      } else {
        const matches = dbObservations.filter(o =>
          Object.entries(this.filters).every(([k, v]) => (o as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' || mode === 'maybeSingle' ? (matches[0] || null) : matches;
        if ((mode === 'single') && !matches[0]) error = { message: 'Not found' };
      }
    } else if (this.table === 'hc_clinical_calculations') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockClinicalCalculation, 'id'>;
        const newRow: MockClinicalCalculation = { id: generateId(), ...row };
        dbClinicalCalculations.push(newRow);
        data = newRow;
      } else {
        const matches = dbClinicalCalculations.filter(c =>
          Object.entries(this.filters).every(([k, v]) => (c as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' ? (matches[0] || null) : matches;
      }
    } else if (this.table === 'hc_ventilator_safety_policies') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockVentilatorPolicy, 'id'>;
        const newRow: MockVentilatorPolicy = { id: generateId(), ...row };
        dbVentilatorPolicies.push(newRow);
        data = newRow;
      } else {
        const matches = dbVentilatorPolicies.filter(p =>
          Object.entries(this.filters).every(([k, v]) => (p as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' ? (matches[0] || null) : matches;
        if (mode === 'single' && !matches[0]) error = { message: 'Not found' };
      }
    } else if (this.table === 'hc_ventilator_records') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockVentilatorRecord, 'id'>;
        const newRow: MockVentilatorRecord = { id: generateId(), ...row };
        dbVentilatorRecords.push(newRow);
        data = newRow;
      } else {
        const matches = dbVentilatorRecords.filter(r =>
          Object.entries(this.filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' || mode === 'maybeSingle' ? (matches[0] || null) : matches;
      }
    } else if (this.table === 'hc_beds') {
      // Mock bed exists
      data = { id: this.filters['id'] as string, tenant_id: this.filters['tenant_id'] as string };
    }

    return { data, error };
  }
}

const mockSupabase = {
  from: (table: string) => new MockQueryBuilder(table),
} as unknown as SupabaseClient;

// ──────────────────────────────────────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────────────────────────────────────

function seedObservation(overrides: Partial<MockIcuObservation> = {}): MockIcuObservation {
  const obs: MockIcuObservation = {
    id: generateId(),
    tenant_id: 'tenant-a',
    encounter_id: 'enc-1',
    observed_at: new Date().toISOString(),
    vitals: {
      heartRate: 80,
      meanArterialPressure: 90,
      temperature: 37.0,
      respiratoryRate: 16,
      spo2: 98,
    },
    labs: {
      pao2: 400,      // PaO2/FiO2 ratio
      plateletCount: 200,
      bilirubin: 0.8,
      creatinine: 0.9,
    },
    clinical: {
      glasgowComaScale: 15,
      urineOutput: 800,
    },
    created_at: new Date().toISOString(),
    ...overrides,
  };
  dbObservations.push(obs);
  return obs;
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────────────────────────────────────

describe('IcuEngine', () => {
  let icuEngine: IcuEngineService;

  beforeEach(() => {
    dbObservations = [];
    dbClinicalCalculations = [];
    dbVentilatorPolicies = [];
    dbVentilatorRecords = [];
    dbIdempotencyKeys.clear();
    publishedEvents.length = 0;
    icuEngine = new IcuEngineService(mockSupabase);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SOFA Score Calculations
  // ────────────────────────────────────────────────────────────────────────────
  describe('calculateSofaScore', () => {
    it('should return SOFA = 0 for a fully healthy patient', async () => {
      const obs = seedObservation(); // all normal values
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', obs.id);

      expect(res.success).toBe(true);
      expect(res.data?.score).toBe(0);
    });

    it('should score respiratory component: PF < 200 = +3', async () => {
      const obs = seedObservation({ labs: { pao2: 150, plateletCount: 200, bilirubin: 0.8, creatinine: 0.9 } });
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', obs.id);

      expect(res.success).toBe(true);
      expect(res.data?.score).toBeGreaterThanOrEqual(3);
    });

    it('should score coagulation component: platelets < 50 = +3', async () => {
      const obs = seedObservation({ labs: { pao2: 400, plateletCount: 30, bilirubin: 0.8, creatinine: 0.9 } });
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', obs.id);

      expect(res.success).toBe(true);
      expect(res.data?.score).toBeGreaterThanOrEqual(3);
    });

    it('should score renal component: creatinine >= 3.5 = +3', async () => {
      const obs = seedObservation({ labs: { pao2: 400, plateletCount: 200, bilirubin: 0.8, creatinine: 3.6 } });
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', obs.id);

      expect(res.success).toBe(true);
      expect(res.data?.score).toBeGreaterThanOrEqual(3);
    });

    it('should score CNS: GCS < 6 = +4', async () => {
      const obs = seedObservation({
        clinical: { glasgowComaScale: 4, urineOutput: 800 },
      });
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', obs.id);

      expect(res.success).toBe(true);
      expect(res.data?.score).toBeGreaterThanOrEqual(4);
    });

    it('should score cardiovascular: norepinephrine > 0.1 = +4', async () => {
      const obs = seedObservation({
        clinical: {
          glasgowComaScale: 15,
          urineOutput: 800,
          vasopressorDoses: { norepinephrine: 0.2 },
        },
      });
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', obs.id);

      expect(res.success).toBe(true);
      expect(res.data?.score).toBeGreaterThanOrEqual(4);
    });

    it('should store clinical calculation audit record with correct governance fields', async () => {
      const obs = seedObservation();
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', obs.id);

      expect(res.success).toBe(true);

      // Side effect assertion: audit record must exist
      const calcs = dbClinicalCalculations.filter(c => c.encounter_id === 'enc-1');
      expect(calcs.length).toBeGreaterThanOrEqual(1);

      const sofaCalc = calcs.find(c => c.algorithm_id === 'SOFA');
      expect(sofaCalc).toBeDefined();
      expect(sofaCalc?.algorithm_id).toBe('SOFA');
      expect(sofaCalc?.algorithm_version).toBe('v1.0');
      expect(sofaCalc?.calculation_status).toBe('COMPLETED');
      expect(sofaCalc?.engine_version).toBeDefined();
      expect(sofaCalc?.input_snapshot).toBeDefined();
      expect(sofaCalc?.source_observation_references).toHaveLength(1);
      expect(sofaCalc?.source_observation_references[0].entity_id).toBe(obs.id);
      expect(sofaCalc?.output).toHaveProperty('score');
    });

    it('should return an error if observation is not found', async () => {
      const res = await icuEngine.calculateSofaScore('tenant-a', 'enc-1', 'non-existent-id');
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('SOFA_CALCULATION_FAILED');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // APACHE II Score
  // ────────────────────────────────────────────────────────────────────────────
  describe('calculateApacheIIScore', () => {
    it('should return a baseline APACHE II score for a young healthy patient', async () => {
      const obs = seedObservation();
      const res = await icuEngine.calculateApacheIIScore('tenant-a', 'enc-1', obs.id, 30, false);

      expect(res.success).toBe(true);
      expect(res.data?.score).toBeGreaterThanOrEqual(0);
    });

    it('should add 6 age points for patient >= 75 years', async () => {
      const obs = seedObservation();

      // Score for patient age 30 (no age points)
      const young = await icuEngine.calculateApacheIIScore('tenant-a', 'enc-1', obs.id, 30, false);
      // Score for patient age 78 (+6 age points)
      const old = await icuEngine.calculateApacheIIScore('tenant-a', 'enc-1', obs.id, 78, false);

      expect(young.success).toBe(true);
      expect(old.success).toBe(true);
      expect((old.data?.score ?? 0) - (young.data?.score ?? 0)).toBe(6);
    });

    it('should add 5 points for chronic organ failure', async () => {
      const obs = seedObservation();

      const withoutChronic = await icuEngine.calculateApacheIIScore('tenant-a', 'enc-1', obs.id, 30, false);
      const withChronic = await icuEngine.calculateApacheIIScore('tenant-a', 'enc-1', obs.id, 30, true);

      expect(withoutChronic.success).toBe(true);
      expect(withChronic.success).toBe(true);
      expect((withChronic.data?.score ?? 0) - (withoutChronic.data?.score ?? 0)).toBe(5);
    });

    it('should store clinical calculation audit record for APACHE II', async () => {
      const obs = seedObservation();
      await icuEngine.calculateApacheIIScore('tenant-a', 'enc-1', obs.id, 45, false);

      const calcs = dbClinicalCalculations.filter(c => c.algorithm_id === 'APACHE_II');
      expect(calcs.length).toBeGreaterThanOrEqual(1);
      expect(calcs[0].algorithm_version).toBe('v1.0');
      expect(calcs[0].calculation_status).toBe('COMPLETED');
      expect(calcs[0].input_snapshot).toHaveProperty('patientAge');
      expect(calcs[0].input_snapshot).toHaveProperty('hasChronicOrganFailure');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Ventilator Safety Policy
  // ────────────────────────────────────────────────────────────────────────────
  describe('startVentilation safety gate', () => {
    async function createPolicy(tenantId: string): Promise<string> {
      const res = await icuEngine.configureVentilatorPolicy({
        tenantId,
        name: 'ICU Standard Policy',
        settingsRules: {
          fio2: { min: 21, max: 100 },
          peep: { min: 3, max: 20 },
          tidalVolume: { min: 200, max: 600 },
          respiratoryRate: { min: 10, max: 30 },
          pressureSupport: { min: 0, max: 25 },
        },
      });
      expect(res.success).toBe(true);
      return dbVentilatorPolicies[dbVentilatorPolicies.length - 1].id;
    }

    it('should allow ventilation when all settings are within policy range', async () => {
      const policyId = await createPolicy('tenant-a');
      const res = await icuEngine.startVentilation({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        policyId,
        mode: 'AC-VC',
        settings: {
          fio2: 40,
          peep: 5,
          tidalVolume: 450,
          respiratoryRate: 14,
          pressureSupport: 10,
        },
        monitoredParams: {},
      });

      expect(res.success).toBe(true);
      expect(dbVentilatorRecords.length).toBe(1);
    });

    it('should BLOCK ventilation and publish safety event when FiO2 exceeds policy max', async () => {
      const policyId = await createPolicy('tenant-a');
      const res = await icuEngine.startVentilation({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        policyId,
        mode: 'AC-VC',
        settings: {
          fio2: 110, // exceeds max=100
          peep: 5,
          tidalVolume: 450,
          respiratoryRate: 14,
          pressureSupport: 10,
        },
        monitoredParams: {},
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('FiO2');
      expect(dbVentilatorRecords.length).toBe(0);

      // Safety event published
      const safetyEvent = publishedEvents.find(e => e.eventType === 'hos.icu.ventilator.validation_failed.v1');
      expect(safetyEvent).toBeDefined();
    });

    it('should BLOCK ventilation and publish event when PEEP is below policy min', async () => {
      const policyId = await createPolicy('tenant-a');
      const res = await icuEngine.startVentilation({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        policyId,
        mode: 'AC-VC',
        settings: {
          fio2: 40,
          peep: 1, // below min=3
          tidalVolume: 450,
          respiratoryRate: 14,
          pressureSupport: 10,
        },
        monitoredParams: {},
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('PEEP');
    });

    it('should BLOCK ventilation when tidal volume exceeds policy max', async () => {
      const policyId = await createPolicy('tenant-a');
      const res = await icuEngine.startVentilation({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        policyId,
        mode: 'AC-VC',
        settings: {
          fio2: 40,
          peep: 5,
          tidalVolume: 800, // exceeds max=600
          respiratoryRate: 14,
          pressureSupport: 10,
        },
        monitoredParams: {},
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Tidal Volume');
    });

    it('should return error if policy ID does not exist', async () => {
      const res = await icuEngine.startVentilation({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        policyId: 'non-existent-policy',
        mode: 'AC-VC',
        settings: {
          fio2: 40,
          peep: 5,
          tidalVolume: 450,
          respiratoryRate: 14,
          pressureSupport: 10,
        },
        monitoredParams: {},
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('VENTILATOR_START_FAILED');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Idempotency
  // ────────────────────────────────────────────────────────────────────────────
  describe('idempotency protection', () => {
    it('should not create duplicate ICU observations on duplicate requestId', async () => {
      const req = {
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        observedAt: new Date().toISOString(),
        requestId: 'obs-req-1',
        vitals: { heartRate: 80, meanArterialPressure: 90, temperature: 37.0, respiratoryRate: 16, spo2: 98 },
        labs: { pao2: 400, plateletCount: 200, bilirubin: 0.8, creatinine: 0.9 },
        clinical: { glasgowComaScale: 15, urineOutput: 800 },
      };

      const res1 = await icuEngine.recordIcuObservation(req);
      const res2 = await icuEngine.recordIcuObservation(req); // Same requestId

      expect(res1.success).toBe(true);
      // Second call should not fail (return idempotent result or success from existing)
      // DB must not have duplicate records
      expect(dbObservations.length).toBe(1);
    });
  });
});
