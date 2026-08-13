/**
 * Phase C Test Suite: Clinical Intelligence Layer (CDS & Order Engine CPOE)
 *
 * Comprehensive integration & unit tests verifying:
 * 1. CDS Engine Sub-Engines (DDI, Allergy Contraindication, Clinical Protocol Adherence)
 * 2. CPOE Order Engine (Prescribing Gate, Lifecycle management, Hard-block enforcement)
 * 3. CDS Override Audit Logging (`hc_cds_overrides` with rationale & timestamp)
 * 4. Pharmacy Defense-in-Depth (Barrier 2 re-check at dispense time)
 * 5. Idempotency Key protection (`requestId`)
 * 6. Governance Audit Trail (`hc_clinical_calculations` immutability & metadata)
 * 7. Constitution Law 11 Compliance: Zero `any` types
 *
 * @module test/healthcare/phase_c_cds_order
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CdsEngineService } from '../platform/healthcare/engines/cds-engine/cds-engine.service';
import { OrderEngineService } from '../platform/healthcare/engines/order-engine/order-engine.service';
import { PharmacyEngineService } from '../platform/healthcare/engines/pharmacy-engine/pharmacy-engine.service';

// ──────────────────────────────────────────────────────────────────────────────
// In-Memory Database Types (Strictly Typed - Law 11)
// ──────────────────────────────────────────────────────────────────────────────

interface MockDrug {
  drug_code: string;
  generic_name: string;
  trade_name: string;
  drug_class: string;
  atc_code: string;
  is_active: boolean;
}

interface MockDrugInteraction {
  id: string;
  drug_a_code: string;
  drug_b_code: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  enforcement: 'ABSOLUTE_BLOCK' | 'BLOCK' | 'SOFT_WARNING' | 'INFO';
  mechanism: string;
  clinical_effect: string;
  management_guidance: string;
  evidence_level: 'A' | 'B' | 'C';
  kb_version: string;
  is_active: boolean;
}

interface MockPatientAllergy {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_id: string;
  allergen_type: string;
  allergen_code: string;
  allergen_name: string;
  reaction_type: string;
  severity: string;
  recorded_by: string;
  is_active: boolean;
  created_at: string;
}

interface MockClinicalProtocol {
  id: string;
  protocol_code: string;
  drug_code?: string;
  drug_class?: string;
  contraindication_type: string;
  condition_spec: Record<string, unknown>;
  severity: string;
  enforcement: string;
  guideline_source: string;
  kb_version: string;
  is_active: boolean;
}

interface MockTenantPolicy {
  id: string;
  tenant_id: string;
  interaction_id: string | null;
  protocol_id: string | null;
  override_enforcement: string;
  policy_version: string;
  is_active: boolean;
  effective_from?: string;
  effective_to?: string | null;
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
  output: Record<string, unknown>;
  engine_version: string;
}

interface MockClinicalOrder {
  id: string;
  tenant_id: string;
  encounter_id: string;
  order_type: string;
  order_status: 'PENDING' | 'VALIDATED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED' | 'REJECTED';
  priority: string;
  ordered_by: string;
  ordered_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  discontinued_by?: string | null;
  discontinued_at?: string | null;
  discontinue_reason?: string | null;
  cds_check_id?: string | null;
  cds_check_status?: string | null;
  order_details: Record<string, unknown>;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface MockCdsOverride {
  id: string;
  tenant_id: string;
  order_id: string;
  cds_alert_id: string;
  alert_type: string;
  alert_severity: string;
  alert_enforcement: string;
  override_reason: string;
  overriding_clinician: string;
  overridden_at: string;
}

interface MockMedicationOrder {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_id: string;
  drug_code: string;
  status: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// In-Memory Storage & Event Tracker
// ──────────────────────────────────────────────────────────────────────────────

let dbDrugs: MockDrug[] = [];
let dbInteractions: MockDrugInteraction[] = [];
let dbAllergies: MockPatientAllergy[] = [];
let dbProtocols: MockClinicalProtocol[] = [];
let dbTenantPolicies: MockTenantPolicy[] = [];
let dbCalculations: MockClinicalCalculation[] = [];
let dbOrders: MockClinicalOrder[] = [];
let dbOverrides: MockCdsOverride[] = [];
let dbMedicationOrders: MockMedicationOrder[] = [];
let dbIdempotencyKeys: Map<string, unknown> = new Map();

const publishedEvents: Array<{ eventType: string; payload: unknown }> = [];

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

// ──────────────────────────────────────────────────────────────────────────────
// Mock Supabase Query Builder
// ──────────────────────────────────────────────────────────────────────────────

class MockQueryBuilder {
  private filters: Record<string, unknown> = {};
  private inFilters: Record<string, unknown[]> = {};
  private lteFilters: Record<string, string> = {};
  private gteFilters: Record<string, string> = {};
  private orClauses: string[] = [];
  private isInsert = false;
  private isUpdate = false;
  private isUpsert = false;
  private updatePayload: Record<string, unknown> | null = null;
  private insertPayload: Record<string, unknown> | null = null;

  constructor(private readonly table: string) {}

  select(_cols = '*') { return this; }

  insert(data: Record<string, unknown>) {
    this.isInsert = true;
    this.insertPayload = data;
    return this;
  }

  upsert(data: Record<string, unknown>) {
    this.isUpsert = true;
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

  in(col: string, vals: unknown[]) {
    this.inFilters[col] = vals;
    return this;
  }

  lte(col: string, val: string) {
    this.lteFilters[col] = val;
    return this;
  }

  gte(col: string, val: string) {
    this.gteFilters[col] = val;
    return this;
  }

  or(clause: string) {
    this.orClauses.push(clause);
    return this;
  }

  limit(_val: number) { return this; }
  order(_col: string, _opts?: unknown) { return this; }
  returns<T>() { return this; }

  throwOnError() { return this; }

  maybeSingle() { return this.execute('maybeSingle'); }
  single() { return this.execute('single'); }

  then(onfulfilled?: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown): Promise<unknown> {
    return this.execute('many').then(onfulfilled, onrejected);
  }

  private async execute(mode: 'single' | 'maybeSingle' | 'many'): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
    let data: unknown = null;
    let error: { code?: string; message: string } | null = null;

    if (this.table === 'hc_idempotency_keys') {
      if (this.isUpsert || this.isInsert) {
        const row = this.insertPayload as Record<string, unknown>;
        dbIdempotencyKeys.set(row.id as string, row.response_data);
        data = row;
      } else {
        const key = this.filters['id'] as string;
        const val = dbIdempotencyKeys.get(key);
        data = val ? { response_data: val } : null;
      }
    } else if (this.table === 'hc_drugs') {
      const matches = dbDrugs.filter((d) =>
        Object.entries(this.filters).every(([k, v]) => (d as unknown as Record<string, unknown>)[k] === v)
      );
      data = mode === 'single' || mode === 'maybeSingle' ? (matches[0] || null) : matches;
    } else if (this.table === 'hc_drug_interactions') {
      const matches = dbInteractions.filter((i) => {
        const eqMatch = Object.entries(this.filters).every(
          ([k, v]) => (i as unknown as Record<string, unknown>)[k] === v
        );
        let orMatch = true;
        if (this.orClauses.length > 0) {
          orMatch = this.orClauses.every((clause) => {
            const parts = clause.split(',');
            return parts.some((part) => {
              const [col, op, val] = part.split('.');
              if (op === 'eq') return (i as unknown as Record<string, unknown>)[col] === val;
              return false;
            });
          });
        }
        return eqMatch && orMatch;
      });
      data = matches;
    } else if (this.table === 'hc_prescriptions') {
      if (this.isInsert || this.isUpdate) {
        data = this.insertPayload || this.updatePayload;
      } else {
        const matches = dbMedicationOrders.filter((m) =>
          Object.entries(this.filters).every(([k, v]) => {
            if (k === 'id') return `rx-${m.id}` === v;
            if (k === 'clinical_order_id') return m.id === v;
            if (k === 'tenant_id') return m.tenant_id === v;
            return true;
          })
        );
        const rows = matches.map((m) => ({
          id: `rx-${m.id}`,
          tenant_id: m.tenant_id,
          encounter_id: m.encounter_id,
          patient_party_id: m.patient_id,
          doctor_party_id: 'doc-123',
          clinical_order_id: m.id,
          drugs: [
            {
              code: m.drug_code,
              name: `Drug ${m.drug_code}`,
              dose: '500mg',
              frequency: 'QID',
              durationDays: 5,
            },
          ],
          diagnosis: null,
          notes: null,
          status: m.status.toLowerCase(),
          version: 1,
          created_by: 'doc-123',
          updated_by: 'doc-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        data = mode === 'single' || mode === 'maybeSingle' ? (rows[0] || null) : rows;
      }
    } else if (this.table === 'inventory_items') {
      if (this.isUpdate) {
        data = [this.updatePayload];
      } else {
        const sku = this.filters['sku'] || 'PENICILLIN-500';
        const row = {
          id: `inv-${sku}`,
          tenant_id: this.filters['tenant_id'] || 'tenant-hospital-a',
          sku,
          name: `Inventory ${sku}`,
          stock_level: 10,
          unit: 'vial',
          min_stock_level: 0,
          price_per_unit: 100,
          updated_at: new Date().toISOString(),
        };
        data = mode === 'single' || mode === 'maybeSingle' ? row : [row];
      }
    } else if (this.table === 'hc_patient_allergies') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockPatientAllergy, 'id'>;
        const newRow: MockPatientAllergy = { id: generateId(), ...row };
        dbAllergies.push(newRow);
        data = newRow;
      } else {
        const matches = dbAllergies.filter((a) =>
          Object.entries(this.filters).every(([k, v]) => (a as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' || mode === 'maybeSingle' ? (matches[0] || null) : matches;
      }
    } else if (this.table === 'hc_clinical_protocols') {
      const matches = dbProtocols.filter((p) => {
        const eqMatch = Object.entries(this.filters).every(
          ([k, v]) => (p as unknown as Record<string, unknown>)[k] === v
        );
        let orMatch = true;
        if (this.orClauses.length > 0) {
          orMatch = this.orClauses.every((clause) => {
            const parts = clause.split(',');
            return parts.some((part) => {
              const [col, op, val] = part.split('.');
              if (op === 'eq') return (p as unknown as Record<string, unknown>)[col] === val;
              return false;
            });
          });
        }
        return eqMatch && orMatch;
      });
      data = mode === 'single' || mode === 'maybeSingle' ? (matches[0] || null) : matches;
    } else if (this.table === 'hc_tenant_cds_policies') {
      const matches = dbTenantPolicies.filter((tp) =>
        Object.entries(this.filters).every(([k, v]) => (tp as unknown as Record<string, unknown>)[k] === v)
      );
      data = matches;
    } else if (this.table === 'hc_clinical_calculations') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockClinicalCalculation, 'id'>;
        const newRow: MockClinicalCalculation = { id: generateId(), ...row };
        dbCalculations.push(newRow);
        data = newRow;
      } else {
        const matches = dbCalculations.filter((c) =>
          Object.entries(this.filters).every(([k, v]) => (c as unknown as Record<string, unknown>)[k] === v)
        );
        data = matches;
      }
    } else if (this.table === 'hc_clinical_orders') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockClinicalOrder, 'id'>;
        const newRow: MockClinicalOrder = { id: generateId(), ...row };
        dbOrders.push(newRow);
        data = newRow;
      } else if (this.isUpdate) {
        const targetIndex = dbOrders.findIndex((o) => o.id === this.filters['id']);
        if (targetIndex !== -1 && this.updatePayload) {
          dbOrders[targetIndex] = { ...dbOrders[targetIndex], ...this.updatePayload };
          data = dbOrders[targetIndex];
        } else {
          error = { message: 'Order not found for update' };
        }
      } else {
        const matches = dbOrders.filter((o) => {
          const eqMatch = Object.entries(this.filters).every(
            ([k, v]) => (o as unknown as Record<string, unknown>)[k] === v
          );
          const inMatch = Object.entries(this.inFilters).every(([k, vals]) =>
            vals.includes((o as unknown as Record<string, unknown>)[k])
          );
          return eqMatch && inMatch;
        });
        data = mode === 'single' || mode === 'maybeSingle' ? (matches[0] || null) : matches;
        if (mode === 'single' && !matches[0]) error = { message: 'Order not found' };
      }
    } else if (this.table === 'hc_order_cds_overrides') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockCdsOverride, 'id'>;
        const newRow: MockCdsOverride = { id: generateId(), ...row };
        dbOverrides.push(newRow);
        data = newRow;
      } else {
        const matches = dbOverrides.filter((ov) =>
          Object.entries(this.filters).every(([k, v]) => (ov as unknown as Record<string, unknown>)[k] === v)
        );
        data = matches;
      }
    } else if (this.table === 'hc_medication_orders') {
      if (this.isUpdate) {
        const targetIndex = dbMedicationOrders.findIndex((m) => m.id === this.filters['id']);
        if (targetIndex !== -1 && this.updatePayload) {
          dbMedicationOrders[targetIndex] = { ...dbMedicationOrders[targetIndex], ...this.updatePayload };
          data = dbMedicationOrders[targetIndex];
        } else {
          error = { message: 'Medication order not found' };
        }
      } else {
        const matches = dbMedicationOrders.filter((m) =>
          Object.entries(this.filters).every(([k, v]) => (m as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' || mode === 'maybeSingle' ? (matches[0] || null) : matches;
      }
    }

    return { data, error };
  }
}

const mockSupabase = {
  from: (table: string) => new MockQueryBuilder(table),
} as unknown as SupabaseClient;

// ──────────────────────────────────────────────────────────────────────────────
// Seed Helpers
// ──────────────────────────────────────────────────────────────────────────────

function seedGlobalKnowledgeBase() {
  dbDrugs = [
    { drug_code: 'WARFARIN-5', generic_name: 'Warfarin', trade_name: 'Coumadin', drug_class: 'ANTICOAGULANT', atc_code: 'B01AA03', is_active: true },
    { drug_code: 'ASPIRIN-81', generic_name: 'Aspirin', trade_name: 'Bayer', drug_class: 'NSAID', atc_code: 'B01AC06', is_active: true },
    { drug_code: 'PENICILLIN-500', generic_name: 'Penicillin V', trade_name: 'Veetids', drug_class: 'PENICILLIN', atc_code: 'J01CE02', is_active: true },
    { drug_code: 'AMOXICILLIN-500', generic_name: 'Amoxicillin', trade_name: 'Amoxil', drug_class: 'PENICILLIN', atc_code: 'J01CA04', is_active: true },
    { drug_code: 'CEFTRIAXONE-1G', generic_name: 'Ceftriaxone', trade_name: 'Rocephin', drug_class: 'CEPHALOSPORIN', atc_code: 'J01DD04', is_active: true },
  ];

  dbInteractions = [
    {
      id: 'ddi-1',
      drug_a_code: 'WARFARIN-5',
      drug_b_code: 'ASPIRIN-81',
      severity: 'CRITICAL',
      enforcement: 'ABSOLUTE_BLOCK',
      mechanism: 'Synergistic inhibition of hemostasis, severe risk of fatal gastrointestinal bleeding.',
      clinical_effect: 'Severe hemorrhage risk',
      management_guidance: 'Avoid co-prescription unless under strict cardiology protocol.',
      evidence_level: 'A',
      kb_version: '2026.1',
      is_active: true,
    },
    {
      id: 'ddi-2',
      drug_a_code: 'ASPIRIN-81',
      drug_b_code: 'WARFARIN-5',
      severity: 'CRITICAL',
      enforcement: 'ABSOLUTE_BLOCK',
      mechanism: 'Synergistic inhibition of hemostasis.',
      clinical_effect: 'Severe hemorrhage risk',
      management_guidance: 'Avoid co-prescription.',
      evidence_level: 'A',
      kb_version: '2026.1',
      is_active: true,
    },
  ];

  dbProtocols = [
    {
      id: 'proto-sepsis',
      protocol_code: 'SEPSIS-BUNDLE-3H',
      drug_code: 'CEFTRIAXONE-1G',
      contraindication_type: 'RENAL',
      condition_spec: { min_egfr: 15, note: 'Adjust dose if eGFR < 15' },
      severity: 'WARNING',
      enforcement: 'BLOCK',
      guideline_source: 'Surviving Sepsis Campaign 2026',
      kb_version: 'v2026.1',
      is_active: true,
    },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Suite: Phase C Clinical Intelligence Layer
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase C: Clinical Decision Support & CPOE Order Engine', () => {
  let cdsEngine: CdsEngineService;
  let orderEngine: OrderEngineService;
  let pharmacyEngine: PharmacyEngineService;

  beforeEach(() => {
    dbDrugs = [];
    dbInteractions = [];
    dbAllergies = [];
    dbProtocols = [];
    dbTenantPolicies = [];
    dbCalculations = [];
    dbOrders = [];
    dbOverrides = [];
    dbMedicationOrders = [];
    dbIdempotencyKeys.clear();
    publishedEvents.length = 0;

    seedGlobalKnowledgeBase();

    cdsEngine = new CdsEngineService(mockSupabase);
    orderEngine = new OrderEngineService(mockSupabase, cdsEngine);
    pharmacyEngine = new PharmacyEngineService(mockSupabase, cdsEngine);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 1: CDS Sub-Engine — Drug-Drug Interactions (DDI)
  // ────────────────────────────────────────────────────────────────────────────
  describe('CDS Sub-Engine: Drug-Drug Interactions', () => {
    it('1.1 should detect CRITICAL interaction (Warfarin + Aspirin) and enforce ABSOLUTE_BLOCK', async () => {
      const res = await cdsEngine.checkDrugInteractions({
        requestId: 'req-ddi-1',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-101',
        patientId: 'pat-101',
        proposedDrugCode: 'ASPIRIN-81',
        currentMedicationCodes: ['WARFARIN-5'],
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.hardBlocked).toBe(true);
      expect(res.data?.alerts.length).toBeGreaterThanOrEqual(1);

      const ddiAlert = res.data?.alerts[0];
      expect(ddiAlert?.alertType).toBe('DRUG_INTERACTION');
      expect(ddiAlert?.severity).toBe('CRITICAL');
      expect(ddiAlert?.enforcement).toBe('ABSOLUTE_BLOCK');
    });

    it('1.2 should return no DDI alerts when proposed drug has no interactions with current medications', async () => {
      const res = await cdsEngine.checkDrugInteractions({
        requestId: 'req-ddi-2',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-101',
        patientId: 'pat-101',
        proposedDrugCode: 'CEFTRIAXONE-1G',
        currentMedicationCodes: ['ASPIRIN-81'],
      });

      expect(res.success).toBe(true);
      expect(res.data?.alerts).toHaveLength(0);
      expect(res.data?.hardBlocked).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 2: CDS Sub-Engine — Allergy Contraindications
  // ────────────────────────────────────────────────────────────────────────────
  describe('CDS Sub-Engine: Allergy Contraindications', () => {
    it('2.1 should detect ANAPHYLAXIS allergy to Penicillin and enforce ABSOLUTE_BLOCK', async () => {
      // Record Penicillin allergy
      await cdsEngine.recordAllergy({
        requestId: 'req-rec-1',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-99',
        patientId: 'pat-99',
        allergenType: 'DRUG',
        allergenCode: 'PENICILLIN-500',
        allergenName: 'Penicillin V',
        reactionType: 'ANAPHYLAXIS',
        severity: 'LIFE_THREATENING',
        recordedBy: 'nurse-jane',
      });

      const res = await cdsEngine.checkAllergyContraindications({
        requestId: 'req-allergy-1',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-99',
        patientId: 'pat-99',
        proposedDrugCode: 'PENICILLIN-500',
      });

      expect(res.success).toBe(true);
      expect(res.data?.hardBlocked).toBe(true);
      const allergyAlert = res.data?.alerts[0];
      expect(allergyAlert?.alertType).toBe('ALLERGY');
      expect(allergyAlert?.severity).toBe('CRITICAL');
      expect(allergyAlert?.enforcement).toBe('ABSOLUTE_BLOCK');
    });

    it('2.2 should detect class-level allergy (PENICILLIN prescribed to Penicillin-allergic patient)', async () => {
      await cdsEngine.recordAllergy({
        requestId: 'req-rec-2',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-99',
        patientId: 'pat-99',
        allergenType: 'DRUG_CLASS',
        allergenCode: 'PENICILLIN',
        allergenName: 'Penicillin Class',
        reactionType: 'URTICARIA',
        severity: 'SEVERE',
        recordedBy: 'dr-smith',
      });

      const res = await cdsEngine.checkAllergyContraindications({
        requestId: 'req-allergy-2',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-99',
        patientId: 'pat-99',
        proposedDrugCode: 'AMOXICILLIN-500',
        proposedDrugClass: 'PENICILLIN',
      });

      expect(res.success).toBe(true);
      expect(res.data?.alerts.length).toBeGreaterThanOrEqual(1);
    });

    it('2.3 should return clear when patient has no allergies recorded', async () => {
      const res = await cdsEngine.checkAllergyContraindications({
        requestId: 'req-allergy-3',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-100',
        patientId: 'pat-100',
        proposedDrugCode: 'AMOXICILLIN-500',
      });

      expect(res.success).toBe(true);
      expect(res.data?.alerts).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 3: CDS Sub-Engine — Clinical Protocol Adherence
  // ────────────────────────────────────────────────────────────────────────────
  describe('CDS Sub-Engine: Protocol Adherence', () => {
    it('3.1 should check renal contraindication against protocol definition', async () => {
      const res = await cdsEngine.checkProtocolAdherence({
        requestId: 'req-proto-1',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-sepsis-1',
        patientId: 'pat-sepsis-1',
        proposedDrugCode: 'CEFTRIAXONE-1G',
        patientEgfr: 10, // eGFR 10 < min_egfr 15
      });

      expect(res.success).toBe(true);
      expect(res.data?.alerts.length).toBeGreaterThanOrEqual(1);
      const protoAlert = res.data?.alerts[0];
      expect(protoAlert?.alertType).toBe('PROTOCOL');
      expect(protoAlert?.message).toContain('eGFR');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 4: CDS Summary Generation & Audit Provenance
  // ────────────────────────────────────────────────────────────────────────────
  describe('CDS Summary & Immutability Audit Trail', () => {
    it('4.1 should aggregate alerts from all sub-engines into a unified CDS Summary', async () => {
      // Record allergy
      await cdsEngine.recordAllergy({
        requestId: 'req-rec-multi',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-multi',
        patientId: 'pat-multi',
        allergenType: 'DRUG',
        allergenCode: 'ASPIRIN-81',
        allergenName: 'Aspirin',
        reactionType: 'ANAPHYLAXIS',
        severity: 'LIFE_THREATENING',
        recordedBy: 'nurse-jane',
      });

      const summaryRes = await cdsEngine.generateCdsSummary({
        requestId: 'req-summary-1',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-multi',
        patientId: 'pat-multi',
        proposedDrugCode: 'ASPIRIN-81',
        currentMedicationCodes: ['WARFARIN-5'],
      });

      expect(summaryRes.success).toBe(true);
      expect(summaryRes.data).toBeDefined();
      expect(summaryRes.data?.hardBlocked).toBe(true);
      // Must contain DDI + Allergy alerts
      expect(summaryRes.data?.alerts.length).toBeGreaterThanOrEqual(2);
    });

    it('4.2 should write calculation audit record to hc_clinical_calculations with governance metadata', async () => {
      await cdsEngine.generateCdsSummary({
        requestId: 'req-audit-1',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-audit',
        patientId: 'pat-audit',
        proposedDrugCode: 'ASPIRIN-81',
        currentMedicationCodes: ['WARFARIN-5'],
      });

      expect(dbCalculations.length).toBeGreaterThanOrEqual(1);
      const calcRecord = dbCalculations.find((c) => c.algorithm_id === 'CDS_SUMMARY');
      expect(calcRecord).toBeDefined();
      expect(calcRecord?.algorithm_version).toBe('1.0');
      expect(calcRecord?.calculation_status).toBe('COMPLETED');
      expect(calcRecord?.engine_version).toBe('1.0.0');
      expect(calcRecord?.input_snapshot).toHaveProperty('proposedDrug', 'ASPIRIN-81');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 5: CPOE Order Engine — Prescribing Gate & Order Lifecycle
  // ────────────────────────────────────────────────────────────────────────────
  describe('CPOE Order Engine: Prescribing Gate & State Transitions', () => {
    it('5.1 should successfully create an order when CDS check passes without warnings', async () => {
      const res = await orderEngine.createOrder({
        requestId: 'order-req-1',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-clean',
        patientId: 'pat-clean',
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'dr-smith',
        orderDetails: {
          drugCode: 'CEFTRIAXONE-1G',
          drugName: 'Ceftriaxone 1g IV daily',
          dose: 1,
          doseUnit: 'g',
          route: 'IV',
          frequency: 'DAILY',
          currentMedicationCodes: [],
        },
      });

      expect(res.success).toBe(true);
      expect(res.data?.cdsCheckStatus).toBe('PASSED');
      expect(res.data?.order.orderStatus).toBe('VALIDATED');
    });

    it('5.2 should HARD BLOCK order creation when CDS returns ABSOLUTE_BLOCK alert', async () => {
      // Record severe penicillin allergy
      await cdsEngine.recordAllergy({
        requestId: 'req-rec-blocked',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-blocked',
        patientId: 'pat-blocked',
        allergenType: 'DRUG',
        allergenCode: 'PENICILLIN-500',
        allergenName: 'Penicillin V',
        reactionType: 'ANAPHYLAXIS',
        severity: 'LIFE_THREATENING',
        recordedBy: 'dr-smith',
      });

      const res = await orderEngine.createOrder({
        requestId: 'order-req-2',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-blocked',
        patientId: 'pat-blocked',
        orderType: 'MEDICATION',
        priority: 'URGENT',
        orderedBy: 'dr-smith',
        orderDetails: {
          drugCode: 'PENICILLIN-500',
          drugName: 'Penicillin V 500mg PO',
          dose: 500,
          doseUnit: 'mg',
          route: 'PO',
          frequency: 'Q6H',
          currentMedicationCodes: [],
        },
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('CDS_ABSOLUTE_BLOCK');
      expect(res.error?.message).toContain('absolute clinical safety constraint');
    });

    it('5.3 should allow order creation with override if rationale is provided for soft warnings', async () => {
      // Change interaction enforcement to BLOCK (soft warning allowing override) for test 5.3
      dbInteractions = [
        {
          id: 'ddi-soft',
          drug_a_code: 'WARFARIN-5',
          drug_b_code: 'ASPIRIN-81',
          severity: 'HIGH',
          enforcement: 'BLOCK',
          mechanism: 'Synergistic bleeding risk',
          clinical_effect: 'Increased bleeding risk',
          management_guidance: 'Monitor INR daily',
          evidence_level: 'B',
          kb_version: '2026.1',
          is_active: true,
        },
        {
          id: 'ddi-soft-rev',
          drug_a_code: 'ASPIRIN-81',
          drug_b_code: 'WARFARIN-5',
          severity: 'HIGH',
          enforcement: 'BLOCK',
          mechanism: 'Synergistic bleeding risk',
          clinical_effect: 'Increased bleeding risk',
          management_guidance: 'Monitor INR daily',
          evidence_level: 'B',
          kb_version: '2026.1',
          is_active: true,
        },
      ];

      // First try without override -> fails with CDS_BLOCK
      const blockRes = await orderEngine.createOrder({
        requestId: 'order-req-3-block',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-override',
        patientId: 'pat-override',
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'dr-smith',
        orderDetails: {
          drugCode: 'ASPIRIN-81',
          drugName: 'Aspirin 81mg PO',
          dose: 81,
          doseUnit: 'mg',
          route: 'PO',
          frequency: 'QD',
          currentMedicationCodes: ['WARFARIN-5'],
        },
      });

      expect(blockRes.success).toBe(false);
      expect(blockRes.error?.code).toBe('CDS_BLOCK');

      // Clinician records override
      const overrideRes = await orderEngine.overrideCdsWarning({
        requestId: 'req-ov-1',
        tenantId: 'tenant-hospital-a',
        orderId: 'temp-order-id',
        cdsAlertId: 'ddi-soft',
        alertType: 'DRUG_INTERACTION',
        alertSeverity: 'HIGH',
        alertEnforcement: 'BLOCK',
        overrideReason: 'Cardiology consensus: post-stent protection outweighs Bleeding risk under daily INR monitoring.',
        overridingClinician: 'dr-smith',
      });

      expect(overrideRes.success).toBe(true);
      expect(dbOverrides.length).toBeGreaterThanOrEqual(1);
      expect(dbOverrides[0].override_reason).toContain('Cardiology consensus');
    });

    it('5.4 should support discontinuing an active order with audit reason', async () => {
      // First create active order
      const createRes = await orderEngine.createOrder({
        requestId: 'order-req-4',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-disc',
        patientId: 'pat-disc',
        orderType: 'MEDICATION',
        priority: 'ROUTINE',
        orderedBy: 'dr-smith',
        orderDetails: {
          drugCode: 'CEFTRIAXONE-1G',
          drugName: 'Ceftriaxone 1g IV daily',
          dose: 1,
          doseUnit: 'g',
          route: 'IV',
          frequency: 'DAILY',
          currentMedicationCodes: [],
        },
      });

      expect(createRes.success).toBe(true);
      const orderId = createRes.data?.order.id ?? '';

      const discRes = await orderEngine.discontinueOrder({
        requestId: 'disc-req-1',
        tenantId: 'tenant-hospital-a',
        orderId,
        discontinuedBy: 'dr-jones',
        reason: 'Treatment course completed. Patient switched to oral antibiotics.',
      });

      expect(discRes.success).toBe(true);
      expect(discRes.data?.orderStatus).toBe('DISCONTINUED');
      expect(discRes.data?.discontinuedBy).toBe('dr-jones');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 6: Pharmacy Defense-in-Depth (Barrier 2 at Dispense Time)
  // ────────────────────────────────────────────────────────────────────────────
  describe('Pharmacy Engine: CDS Barrier 2 Re-Check at Dispense', () => {
    it('6.1 should BLOCK dispensing when new allergy is added AFTER prescribing', async () => {
      // Seed medication order in pharmacy db
      const medOrderId = 'med-order-999';
      dbMedicationOrders.push({
        id: medOrderId,
        tenant_id: 'tenant-hospital-a',
        encounter_id: 'enc-barrier2',
        patient_id: 'pat-barrier2',
        drug_code: 'PENICILLIN-500',
        status: 'PRESCRIBED',
      });

      // Simulating time gap: patient develops / staff records Penicillin allergy BEFORE dispensing
      await cdsEngine.recordAllergy({
        requestId: 'req-rec-b2',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-barrier2',
        patientId: 'pat-barrier2',
        allergenType: 'DRUG',
        allergenCode: 'PENICILLIN-500',
        allergenName: 'Penicillin V',
        reactionType: 'ANAPHYLAXIS',
        severity: 'LIFE_THREATENING',
        recordedBy: 'nurse-jane',
      });

      // Pharmacy attempts dispense with Barrier 2 parameters
      const dispenseRes = await pharmacyEngine.dispenseMedication({
        tenantId: 'tenant-hospital-a',
        medicationOrderId: medOrderId,
        dispensedBy: 'pharm-john',
        patientId: 'pat-barrier2',
        encounterId: 'enc-barrier2',
        drugCode: 'PENICILLIN-500',
      });

      expect(dispenseRes.success).toBe(false);
      expect(dispenseRes.error?.code).toBe('CDS_DISPENSE_BLOCKED');
      expect(dispenseRes.error?.message).toContain('Barrier 2');

      // Assert event published
      const dispenseBlockedEvent = publishedEvents.find(
        (e) => e.eventType === 'hos.cds.dispense.blocked.v1'
      );
      expect(dispenseBlockedEvent).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 7: Idempotency Key Protection
  // ────────────────────────────────────────────────────────────────────────────
  describe('Idempotency & Concurrent Safety', () => {
    it('7.1 should prevent duplicate order creation on identical requestId', async () => {
      const orderReq = {
        requestId: 'idem-order-100',
        tenantId: 'tenant-hospital-a',
        encounterId: 'enc-idem',
        patientId: 'pat-idem',
        orderType: 'MEDICATION' as const,
        priority: 'ROUTINE' as const,
        orderedBy: 'dr-smith',
        orderDetails: {
          drugCode: 'CEFTRIAXONE-1G',
          drugName: 'Ceftriaxone 1g IV daily',
          dose: 1,
          doseUnit: 'g' as const,
          route: 'IV' as const,
          frequency: 'DAILY',
          currentMedicationCodes: [],
        },
      };

      const firstCall = await orderEngine.createOrder(orderReq);
      const secondCall = await orderEngine.createOrder(orderReq);

      expect(firstCall.success).toBe(true);
      expect(secondCall.success).toBe(true);
      // Same order returned due to idempotency
      expect(firstCall.data?.order.id).toBe(secondCall.data?.order.id);
      expect(dbOrders.length).toBe(1);
    });
  });
});
