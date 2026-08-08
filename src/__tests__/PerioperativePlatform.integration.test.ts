/**
 * Perioperative Platform Integration Test Suite
 * 
 * Verifies the complete perioperative Care Journey:
 * 1. Success journey: create case, assign team, sterilization cycles, safety checklist,
 *    anesthesia vitals log & meds, PACU recovery Aldrete scoring, and policy-driven discharge.
 * 2. WHO Checklist Gates:
 *    - Block procedure start if Sign-In or Time-Out checklists are incomplete.
 *    - Block procedure completion if Sign-Out checklist is incomplete.
 * 3. Anesthesia state transition machine invariants validation.
 * 4. OR Readiness fail-safe evaluation:
 *    - Provider exception / unknown result -> UNKNOWN status -> BLOCKED.
 *    - Missing consent / dirty room -> NOT_READY status -> BLOCKED.
 * 
 * Enforces Platform Constitution Law 11 (Strictly No any Types).
 * 
 * @module test/healthcare/perioperative-platform-integration
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { OREngineService } from '../platform/healthcare/engines/or-engine/or-engine.service';
import { SurgicalEngineService } from '../platform/healthcare/engines/surgical-engine/surgical-engine.service';
import { AnesthesiaEngineService } from '../platform/healthcare/engines/anesthesia-engine/anesthesia-engine.service';
import { CssdEngineService } from '../platform/healthcare/engines/cssd-engine/cssd-engine.service';
import { PacuEngineService } from '../platform/healthcare/engines/pacu-engine/pacu-engine.service';
import { ORReadinessEngineService } from '../platform/healthcare/engines/or-readiness-engine/or-readiness-engine.service';
import type { ConsentStatusProvider, RoomReadinessProvider } from '../platform/healthcare/contracts/or-readiness-engine.contract';

interface MockScheduleRow {
  id: string;
  tenant_id: string;
  operating_room_id: string;
  scheduled_time_range: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MockCaseRow {
  id: string;
  tenant_id: string;
  encounter_id: string;
  case_number: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MockChecklistRow {
  id: string;
  tenant_id: string;
  surgical_case_id: string;
  signin_completed: boolean;
  signin_completed_by: string | null;
  signin_completed_at: string | null;
  timeout_completed: boolean;
  timeout_completed_by: string | null;
  timeout_completed_at: string | null;
  signout_completed: boolean;
  signout_completed_by: string | null;
  signout_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MockTeamRow {
  id: string;
  tenant_id: string;
  surgical_case_id: string;
  user_id: string;
  role: string;
  assigned_at: string;
  left_at: string | null;
}

interface MockAnesthesiaRecordRow {
  id: string;
  tenant_id: string;
  surgical_case_id: string;
  status: string;
  asa_classification: number | null;
  pre_op_assessment: string | null;
  post_op_assessment: string | null;
  created_at: string;
  updated_at: string;
}

interface MockObservationRow {
  id: string;
  tenant_id: string;
  anesthesia_record_id: string;
  observation_time: string;
  type: string;
  value: number;
  created_at: string;
}

interface MockMedicationRow {
  id: string;
  tenant_id: string;
  anesthesia_record_id: string;
  inventory_item_id: string;
  administered_at: string;
  dose: number;
  unit: string;
  waste: number;
  verified_by: string | null;
  created_at: string;
}

interface MockPacuAdmissionRow {
  id: string;
  tenant_id: string;
  surgical_case_id: string;
  admitted_at: string;
  discharged_at: string | null;
  discharge_policy_version: string;
  aldrete_score: number | null;
  pain_score: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MockEquipmentRow {
  id: string;
  tenant_id: string;
  name: string;
  serial_number: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MockCssdCycleRow {
  id: string;
  tenant_id: string;
  cycle_number: string;
  started_at: string;
  completed_at: string | null;
  indicator_result: string;
  created_at: string;
  updated_at: string;
}

interface MockCssdCycleItemRow {
  id: string;
  tenant_id: string;
  cssd_cycle_id: string;
  equipment_id: string;
  created_at: string;
}

interface MockEquipmentUsageRow {
  id: string;
  tenant_id: string;
  surgical_case_id: string;
  equipment_id: string;
  cssd_cycle_id: string;
  used_at: string;
  returned_at: string | null;
}

interface MockDb {
  schedules: MockScheduleRow[];
  cases: MockCaseRow[];
  checklists: MockChecklistRow[];
  teams: MockTeamRow[];
  anesthesiaRecords: MockAnesthesiaRecordRow[];
  observations: MockObservationRow[];
  medications: MockMedicationRow[];
  pacuAdmissions: MockPacuAdmissionRow[];
  equipments: MockEquipmentRow[];
  cssdCycles: MockCssdCycleRow[];
  cssdCycleItems: MockCssdCycleItemRow[];
  equipmentUsages: MockEquipmentUsageRow[];
  idempotencyKeys: Set<string>;
}

describe('Perioperative Care Platform Integration', () => {
  let db: MockDb;

  // Mock Providers for OR Readiness
  let mockConsentResult: 'signed' | 'missing' | 'unknown' | (() => Promise<never>);
  let mockCleaningResult: 'cleaned' | 'dirty' | 'unknown' | (() => Promise<never>);

  const consentProvider: ConsentStatusProvider = {
    getConsentStatus: async () => {
      if (typeof mockConsentResult === 'function') {
        return await mockConsentResult();
      }
      return mockConsentResult;
    },
  };

  const roomReadinessProvider: RoomReadinessProvider = {
    getCleaningStatus: async () => {
      if (typeof mockCleaningResult === 'function') {
        return await mockCleaningResult();
      }
      return mockCleaningResult;
    },
  };

  class MockQueryBuilder {
    private filters: Record<string, string | number | boolean | null> = {};
    private inFilters: Record<string, string[]> = {};
    private isInsert = false;
    private isUpdate = false;
    private isDelete = false;
    private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
    private selectCols = '';

    constructor(private readonly table: string) {}

    select(cols = '*') {
      this.selectCols = cols;
      return this;
    }

    insert(data: Record<string, unknown> | Record<string, unknown>[]) {
      this.isInsert = true;
      this.payload = data;
      return this;
    }

    update(data: Record<string, unknown>) {
      this.isUpdate = true;
      this.payload = data;
      return this;
    }

    delete() {
      this.isDelete = true;
      return this;
    }

    eq(col: string, val: string | number | boolean | null) {
      this.filters[col] = val;
      return this;
    }

    in(col: string, vals: string[]) {
      this.inFilters[col] = vals;
      return this;
    }

    limit(val: number) {
      return this;
    }

    maybeSingle() {
      return this.execute('maybeSingle');
    }

    single() {
      return this.execute('single');
    }

    then(onfulfilled?: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown): Promise<unknown> {
      return this.execute('many').then(onfulfilled, onrejected);
    }

    private async execute(mode: 'single' | 'maybeSingle' | 'many'): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
      let data: unknown = null;
      let error: { code?: string; message: string } | null = null;

      try {
        if (this.isInsert) {
          if (this.table === 'hc_idempotency_keys') {
            const row = this.payload as Record<string, string>;
            const key = `${row.tenant_id}:${row.request_id}:${row.operation}`;
            if (db.idempotencyKeys.has(key)) {
              error = { code: '23505', message: 'Unique violation' };
            } else {
              db.idempotencyKeys.add(key);
            }
          } else if (this.table === 'hc_surgical_cases') {
            const row = this.payload as Record<string, string>;
            const newRow: MockCaseRow = {
              id: `case-${Math.random()}`,
              tenant_id: row.tenant_id,
              encounter_id: row.encounter_id,
              case_number: row.case_number,
              status: row.status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            db.cases.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_surgical_safety_checklists') {
            const row = this.payload as Record<string, unknown>;
            const newRow: MockChecklistRow = {
              id: `chk-${Math.random()}`,
              tenant_id: String(row.tenant_id),
              surgical_case_id: String(row.surgical_case_id),
              signin_completed: Boolean(row.signin_completed),
              signin_completed_by: (row.signin_completed_by as string) || null,
              signin_completed_at: (row.signin_completed_at as string) || null,
              timeout_completed: Boolean(row.timeout_completed),
              timeout_completed_by: (row.timeout_completed_by as string) || null,
              timeout_completed_at: (row.timeout_completed_at as string) || null,
              signout_completed: Boolean(row.signout_completed),
              signout_completed_by: (row.signout_completed_by as string) || null,
              signout_completed_at: (row.signout_completed_at as string) || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            db.checklists.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_surgical_teams') {
            const row = this.payload as Record<string, string>;
            const newRow: MockTeamRow = {
              id: `team-${Math.random()}`,
              tenant_id: row.tenant_id,
              surgical_case_id: row.surgical_case_id,
              user_id: row.user_id,
              role: row.role,
              assigned_at: new Date().toISOString(),
              left_at: null,
            };
            db.teams.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_anesthesia_records') {
            const row = this.payload as Record<string, string>;
            const newRow: MockAnesthesiaRecordRow = {
              id: `anes-${Math.random()}`,
              tenant_id: row.tenant_id,
              surgical_case_id: row.surgical_case_id,
              status: row.status,
              asa_classification: null,
              pre_op_assessment: null,
              post_op_assessment: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            db.anesthesiaRecords.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_anesthesia_observations') {
            const row = this.payload as Record<string, unknown>;
            const newRow: MockObservationRow = {
              id: `obs-${Math.random()}`,
              tenant_id: String(row.tenant_id),
              anesthesia_record_id: String(row.anesthesia_record_id),
              observation_time: String(row.observation_time),
              type: String(row.type),
              value: Number(row.value),
              created_at: new Date().toISOString(),
            };
            db.observations.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_anesthesia_medications') {
            const row = this.payload as Record<string, unknown>;
            const newRow: MockMedicationRow = {
              id: `med-${Math.random()}`,
              tenant_id: String(row.tenant_id),
              anesthesia_record_id: String(row.anesthesia_record_id),
              inventory_item_id: String(row.inventory_item_id),
              administered_at: String(row.administered_at),
              dose: Number(row.dose),
              unit: String(row.unit),
              waste: Number(row.waste || 0),
              verified_by: (row.verified_by as string) || null,
              created_at: new Date().toISOString(),
            };
            db.medications.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_equipment') {
            const row = this.payload as Record<string, string>;
            const newRow: MockEquipmentRow = {
              id: `eq-${Math.random()}`,
              tenant_id: row.tenant_id,
              name: row.name,
              serial_number: row.serial_number,
              status: 'available',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            db.equipments.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_cssd_cycles') {
            const row = this.payload as Record<string, string>;
            const newRow: MockCssdCycleRow = {
              id: `cyc-${Math.random()}`,
              tenant_id: row.tenant_id,
              cycle_number: row.cycle_number,
              started_at: row.started_at,
              completed_at: null,
              indicator_result: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            db.cssdCycles.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_cssd_cycle_items') {
            const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Record<string, string>[];
            const added: MockCssdCycleItemRow[] = [];
            rows.forEach(r => {
              const newRow: MockCssdCycleItemRow = {
                id: `item-${Math.random()}`,
                tenant_id: r.tenant_id,
                cssd_cycle_id: r.cssd_cycle_id,
                equipment_id: r.equipment_id,
                created_at: new Date().toISOString(),
              };
              db.cssdCycleItems.push(newRow);
              added.push(newRow);
            });
            data = added;
          } else if (this.table === 'hc_or_equipment_usage') {
            const row = this.payload as Record<string, string>;
            const newRow: MockEquipmentUsageRow = {
              id: `use-${Math.random()}`,
              tenant_id: row.tenant_id,
              surgical_case_id: row.surgical_case_id,
              equipment_id: row.equipment_id,
              cssd_cycle_id: row.cssd_cycle_id,
              used_at: row.used_at,
              returned_at: null,
            };
            db.equipmentUsages.push(newRow);
            data = newRow;
          } else if (this.table === 'hc_pacu_admissions') {
            const row = this.payload as Record<string, string>;
            const newRow: MockPacuAdmissionRow = {
              id: `pacu-${Math.random()}`,
              tenant_id: row.tenant_id,
              surgical_case_id: row.surgical_case_id,
              admitted_at: row.admitted_at,
              discharged_at: null,
              discharge_policy_version: row.discharge_policy_version,
              aldrete_score: null,
              pain_score: null,
              status: 'admitted',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            db.pacuAdmissions.push(newRow);
            data = newRow;
          }
        } else if (this.isUpdate) {
          const updateData = this.payload as Record<string, unknown>;
          if (this.table === 'hc_surgical_cases') {
            const matches = db.cases.filter(c => Object.keys(this.filters).every(k => String(c[k as keyof MockCaseRow]) === String(this.filters[k])));
            matches.forEach(m => Object.assign(m, updateData, { updated_at: new Date().toISOString() }));
            data = matches[0] || null;
          } else if (this.table === 'hc_surgical_safety_checklists') {
            const matches = db.checklists.filter(c => Object.keys(this.filters).every(k => String(c[k as keyof MockChecklistRow]) === String(this.filters[k])));
            matches.forEach(m => Object.assign(m, updateData, { updated_at: new Date().toISOString() }));
            data = matches[0] || null;
          } else if (this.table === 'hc_anesthesia_records') {
            const matches = db.anesthesiaRecords.filter(r => Object.keys(this.filters).every(k => String(r[k as keyof MockAnesthesiaRecordRow]) === String(this.filters[k])));
            matches.forEach(m => Object.assign(m, updateData, { updated_at: new Date().toISOString() }));
            data = matches[0] || null;
          } else if (this.table === 'hc_equipment') {
            const matches = db.equipments.filter(e => {
              const colMatch = Object.keys(this.filters).every(k => String(e[k as keyof MockEquipmentRow]) === String(this.filters[k]));
              const inMatch = Object.keys(this.inFilters).every(k => this.inFilters[k].includes(String(e[k as keyof MockEquipmentRow])));
              return colMatch && inMatch;
            });
            matches.forEach(m => Object.assign(m, updateData, { updated_at: new Date().toISOString() }));
            data = matches[0] || null;
          } else if (this.table === 'hc_cssd_cycles') {
            const matches = db.cssdCycles.filter(c => Object.keys(this.filters).every(k => String(c[k as keyof MockCssdCycleRow]) === String(this.filters[k])));
            matches.forEach(m => Object.assign(m, updateData, { updated_at: new Date().toISOString() }));
            data = matches[0] || null;
          } else if (this.table === 'hc_or_equipment_usage') {
            const matches = db.equipmentUsages.filter(u => Object.keys(this.filters).every(k => String(u[k as keyof MockEquipmentUsageRow]) === String(this.filters[k])));
            matches.forEach(m => Object.assign(m, updateData));
            data = matches[0] || null;
          } else if (this.table === 'hc_pacu_admissions') {
            const matches = db.pacuAdmissions.filter(p => Object.keys(this.filters).every(k => String(p[k as keyof MockPacuAdmissionRow]) === String(this.filters[k])));
            matches.forEach(m => Object.assign(m, updateData, { updated_at: new Date().toISOString() }));
            data = matches[0] || null;
          }
        } else if (this.isDelete) {
          if (this.table === 'hc_surgical_cases') {
            db.cases = db.cases.filter(c => !Object.keys(this.filters).every(k => String(c[k as keyof MockCaseRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_cssd_cycles') {
            db.cssdCycles = db.cssdCycles.filter(c => !Object.keys(this.filters).every(k => String(c[k as keyof MockCssdCycleRow]) === String(this.filters[k])));
          }
          data = null;
        } else {
          // Select operation
          let matches: unknown[] = [];
          if (this.table === 'hc_surgical_cases') {
            matches = db.cases.filter(c => Object.keys(this.filters).every(k => String(c[k as keyof MockCaseRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_surgical_safety_checklists') {
            matches = db.checklists.filter(c => Object.keys(this.filters).every(k => String(c[k as keyof MockChecklistRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_surgical_teams') {
            matches = db.teams.filter(t => Object.keys(this.filters).every(k => String(t[k as keyof MockTeamRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_anesthesia_records') {
            matches = db.anesthesiaRecords.filter(r => Object.keys(this.filters).every(k => String(r[k as keyof MockAnesthesiaRecordRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_equipment') {
            matches = db.equipments.filter(e => Object.keys(this.filters).every(k => String(e[k as keyof MockEquipmentRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_cssd_cycles') {
            matches = db.cssdCycles.filter(c => Object.keys(this.filters).every(k => String(c[k as keyof MockCssdCycleRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_cssd_cycle_items') {
            matches = db.cssdCycleItems.filter(i => Object.keys(this.filters).every(k => String(i[k as keyof MockCssdCycleItemRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_or_equipment_usage') {
            const raw = db.equipmentUsages.filter(u => Object.keys(this.filters).every(k => String(u[k as keyof MockEquipmentUsageRow]) === String(this.filters[k])));
            matches = raw.map(m => {
              const eq = db.equipments.find(e => e.id === m.equipment_id);
              const cyc = db.cssdCycles.find(c => c.id === m.cssd_cycle_id);
              return {
                ...m,
                hc_equipment: eq,
                hc_cssd_cycles: cyc,
              };
            });
          } else if (this.table === 'hc_pacu_admissions') {
            matches = db.pacuAdmissions.filter(p => Object.keys(this.filters).every(k => String(p[k as keyof MockPacuAdmissionRow]) === String(this.filters[k])));
          } else if (this.table === 'hc_or_schedules') {
            matches = db.schedules.filter(s => Object.keys(this.filters).every(k => String(s[k as keyof MockScheduleRow]) === String(this.filters[k])));
          }

          if (mode === 'single') {
            data = matches[0] || null;
            if (!data) {
              error = { message: 'Row not found' };
            }
          } else if (mode === 'maybeSingle') {
            data = matches[0] || null;
          } else {
            data = matches;
          }
        }
      } catch (err: unknown) {
        error = { message: err instanceof Error ? err.message : 'Unknown database error' };
      }

      return { data, error };
    }
  }

  const mockSupabase = {
    from: (table: string) => {
      return new MockQueryBuilder(table);
    },
  } as unknown as SupabaseClient;

  let orEngine: OREngineService;
  let surgicalEngine: SurgicalEngineService;
  let anesthesiaEngine: AnesthesiaEngineService;
  let cssdEngine: CssdEngineService;
  let pacuEngine: PacuEngineService;
  let readinessEngine: ORReadinessEngineService;

  beforeEach(() => {
    db = {
      schedules: [],
      cases: [],
      checklists: [],
      teams: [],
      anesthesiaRecords: [],
      observations: [],
      medications: [],
      pacuAdmissions: [],
      equipments: [],
      cssdCycles: [],
      cssdCycleItems: [],
      equipmentUsages: [],
      idempotencyKeys: new Set(),
    };

    orEngine = new OREngineService(mockSupabase);
    surgicalEngine = new SurgicalEngineService(mockSupabase);
    anesthesiaEngine = new AnesthesiaEngineService(mockSupabase);
    cssdEngine = new CssdEngineService(mockSupabase);
    pacuEngine = new PacuEngineService(mockSupabase);

    mockConsentResult = 'signed';
    mockCleaningResult = 'cleaned';
    readinessEngine = new ORReadinessEngineService(mockSupabase, consentProvider, roomReadinessProvider);
  });

  describe('Flow 1: Complete Perioperative Surgical Journey', () => {
    it('should complete the entire clinical safety workflow without violations', async () => {
      const tenantId = 'tenant-a';
      const encounterId = 'enc-123';

      // 1. Create Case
      const caseRes = await surgicalEngine.createCase({
        tenantId,
        encounterId,
        caseNumber: 'CASE-001',
      });
      expect(caseRes.success).toBe(true);
      const caseId = caseRes.data!.id;

      // 2. Assign team members
      await surgicalEngine.assignTeamMember({ tenantId, surgicalCaseId: caseId, userId: 'u-1', role: 'surgeon' });
      await surgicalEngine.assignTeamMember({ tenantId, surgicalCaseId: caseId, userId: 'u-2', role: 'anesthesiologist' });

      // 3. Sterilization Cycle
      const equipRes = await cssdEngine.registerEquipment({ tenantId, name: 'Surgical Tray #1', serialNumber: 'ST-01' });
      expect(equipRes.success).toBe(true);
      const eqId = equipRes.data!.id;

      const cycleStartRes = await cssdEngine.startCycle({ tenantId, cycleNumber: 'CYC-01', equipmentIds: [eqId], startedAt: new Date().toISOString() });
      expect(cycleStartRes.success).toBe(true);
      const cycleId = cycleStartRes.data!.id;

      const cycleCompleteRes = await cssdEngine.completeCycle({ tenantId, cycleId, completedAt: new Date().toISOString(), indicatorResult: 'pass' });
      expect(cycleCompleteRes.success).toBe(true);

      // Verify equipment became available after passing biological indicator
      expect(db.equipments[0].status).toBe('available');

      // Issue Equipment to Case
      const issueRes = await cssdEngine.issueEquipment({ tenantId, surgicalCaseId: caseId, equipmentId: eqId, cssdCycleId: cycleId, usedAt: new Date().toISOString() });
      expect(issueRes.success).toBe(true);

      // 4. Anesthesia Record Initialization
      const anesthesiaRes = await anesthesiaEngine.createRecord({ tenantId, surgicalCaseId: caseId });
      expect(anesthesiaRes.success).toBe(true);
      const anesthesiaRecordId = anesthesiaRes.data!.id;

      await anesthesiaEngine.recordPreOpAssessment({ tenantId, anesthesiaRecordId, asaClassification: 2, preOpAssessment: 'Healthy patient with mild systemic disease' });

      // 5. Checklist Sign-In and Time-Out
      await surgicalEngine.completeSignIn({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });
      await surgicalEngine.completeTimeOut({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });

      // 6. Start Procedure
      const startRes = await surgicalEngine.startProcedure({ tenantId, surgicalCaseId: caseId });
      expect(startRes.success).toBe(true);
      expect(db.cases[0].status).toBe('in_progress');

      // 7. Record Observations (moves anesthesia to intra_op status)
      const obsRes = await anesthesiaEngine.recordObservation({ tenantId, anesthesiaRecordId: anesthesiaRecordId, observationTime: new Date().toISOString(), type: 'HR', value: 80 });
      expect(obsRes.success).toBe(true);
      expect(db.anesthesiaRecords[0].status).toBe('intra_op');

      // Record Medication
      const medRes = await anesthesiaEngine.recordMedication({ tenantId, anesthesiaRecordId, inventoryItemId: 'item-1', administeredAt: new Date().toISOString(), dose: 100, unit: 'mg' });
      expect(medRes.success).toBe(true);

      // 8. Sign-Out Checklist
      await surgicalEngine.completeSignOut({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });

      // Record Post-Op Assessment (moves anesthesia to post_op status)
      await anesthesiaEngine.recordPostOp({ tenantId, anesthesiaRecordId, postOpAssessment: 'Stable recovery' });

      // Complete Procedure
      const completeRes = await surgicalEngine.completeProcedure({ tenantId, surgicalCaseId: caseId });
      expect(completeRes.success).toBe(true);
      expect(db.cases[0].status).toBe('completed');

      // Complete Anesthesia Record
      await anesthesiaEngine.completeRecord(tenantId, anesthesiaRecordId);
      expect(db.anesthesiaRecords[0].status).toBe('completed');

      // 9. PACU Admission
      const pacuRes = await pacuEngine.admitToPacu({ tenantId, surgicalCaseId: caseId, admittedAt: new Date().toISOString(), dischargePolicyVersion: 'standard-v1' });
      expect(pacuRes.success).toBe(true);

      // Record recovery scores (Aldrete score = 9, pain = 2 -> meets standard-v1 criteria)
      const scoreRes = await pacuEngine.recordAldreteScore({
        tenantId,
        surgicalCaseId: caseId,
        activity: 2,
        respiration: 2,
        circulation: 1,
        consciousness: 2,
        oxygenSaturation: 2,
        painScore: 2,
      });
      expect(scoreRes.success).toBe(true);
      expect(scoreRes.data!.status).toBe('ready_for_discharge');

      // Discharge
      const dischargeRes = await pacuEngine.dischargeFromPacu({ tenantId, surgicalCaseId: caseId, dischargedAt: new Date().toISOString() });
      expect(dischargeRes.success).toBe(true);
      expect(db.pacuAdmissions[0].status).toBe('discharged');
    });
  });

  describe('Flow 2: WHO Safety Checklist Gates', () => {
    it('should block procedure start if Sign-In or Time-Out checklists are incomplete', async () => {
      const tenantId = 'tenant-a';
      const encounterId = 'enc-123';

      const caseRes = await surgicalEngine.createCase({ tenantId, encounterId, caseNumber: 'CASE-002' });
      const caseId = caseRes.data!.id;

      // Try starting immediately -> blocked
      const res1 = await surgicalEngine.startProcedure({ tenantId, surgicalCaseId: caseId });
      expect(res1.success).toBe(false);
      expect(res1.error?.code).toBe('SIGNIN_NOT_COMPLETED');

      // Complete Sign-in only -> still blocked
      await surgicalEngine.completeSignIn({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });
      const res2 = await surgicalEngine.startProcedure({ tenantId, surgicalCaseId: caseId });
      expect(res2.success).toBe(false);
      expect(res2.error?.code).toBe('TIMEOUT_NOT_COMPLETED');

      // Complete Time-out -> allowed
      await surgicalEngine.completeTimeOut({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });
      const res3 = await surgicalEngine.startProcedure({ tenantId, surgicalCaseId: caseId });
      expect(res3.success).toBe(true);
    });

    it('should block procedure completion if Sign-Out is incomplete', async () => {
      const tenantId = 'tenant-a';
      const encounterId = 'enc-123';

      const caseRes = await surgicalEngine.createCase({ tenantId, encounterId, caseNumber: 'CASE-003' });
      const caseId = caseRes.data!.id;

      await surgicalEngine.completeSignIn({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });
      await surgicalEngine.completeTimeOut({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });
      await surgicalEngine.startProcedure({ tenantId, surgicalCaseId: caseId });

      // Try completing without sign-out -> blocked
      const res1 = await surgicalEngine.completeProcedure({ tenantId, surgicalCaseId: caseId });
      expect(res1.success).toBe(false);
      expect(res1.error?.code).toBe('SIGNOUT_NOT_COMPLETED');

      // Complete sign-out -> allowed
      await surgicalEngine.completeSignOut({ tenantId, surgicalCaseId: caseId, completedBy: 'u-1' });
      const res2 = await surgicalEngine.completeProcedure({ tenantId, surgicalCaseId: caseId });
      expect(res2.success).toBe(true);
    });
  });

  describe('Flow 3: Anesthesia State Machine Invariants', () => {
    it('should enforce strict state transition order and complete immutability', async () => {
      const tenantId = 'tenant-a';
      const encounterId = 'enc-123';

      const caseRes = await surgicalEngine.createCase({ tenantId, encounterId, caseNumber: 'CASE-004' });
      const caseId = caseRes.data!.id;

      const recordRes = await anesthesiaEngine.createRecord({ tenantId, surgicalCaseId: caseId });
      const recordId = recordRes.data!.id;

      // Try recording observations in CREATED status -> blocked
      const obsRes = await anesthesiaEngine.recordObservation({ tenantId, anesthesiaRecordId: recordId, observationTime: new Date().toISOString(), type: 'HR', value: 80 });
      expect(obsRes.success).toBe(false);
      expect(obsRes.error?.code).toBe('INVALID_LIFECYCLE_STATE');

      // Move to pre_op_complete
      await anesthesiaEngine.recordPreOpAssessment({ tenantId, anesthesiaRecordId: recordId, asaClassification: 1, preOpAssessment: 'Healthy' });

      // Record observation moves status to intra_op
      const obsRes2 = await anesthesiaEngine.recordObservation({ tenantId, anesthesiaRecordId: recordId, observationTime: new Date().toISOString(), type: 'HR', value: 80 });
      expect(obsRes2.success).toBe(true);
      expect(db.anesthesiaRecords[0].status).toBe('intra_op');

      // Move to post_op
      await anesthesiaEngine.recordPostOp({ tenantId, anesthesiaRecordId: recordId, postOpAssessment: 'Good' });

      // Try completing now -> allowed
      const compRes = await anesthesiaEngine.completeRecord(tenantId, recordId);
      expect(compRes.success).toBe(true);
      expect(db.anesthesiaRecords[0].status).toBe('completed');

      // Try editing completed record -> blocked
      const finalObs = await anesthesiaEngine.recordObservation({ tenantId, anesthesiaRecordId: recordId, observationTime: new Date().toISOString(), type: 'HR', value: 80 });
      expect(finalObs.success).toBe(false);
      expect(finalObs.error?.code).toBe('INVALID_LIFECYCLE_STATE');
    });
  });

  describe('Flow 4: OR Readiness Fail-Safe', () => {
    it('should result in UNKNOWN and block readiness when providers fail (Fail-Safe: Unknown != Ready)', async () => {
      const tenantId = 'tenant-a';
      const encounterId = 'enc-123';

      const caseRes = await surgicalEngine.createCase({ tenantId, encounterId, caseNumber: 'CASE-005' });
      const caseId = caseRes.data!.id;

      // Force provider error/timeout
      mockConsentResult = async () => {
        throw new Error('Connection timeout');
      };

      const readinessRes = await readinessEngine.evaluateReadiness(tenantId, caseId);
      expect(readinessRes.success).toBe(true);
      expect(readinessRes.data!.ready).toBe(false);
      expect(readinessRes.data!.status).toBe('unknown');
      expect(readinessRes.data!.blockers).toContain('Readiness factors are in an unknown state due to provider failure');
    });

    it('should result in NOT_READY and list blockers when consent is missing or room is dirty', async () => {
      const tenantId = 'tenant-a';
      const encounterId = 'enc-123';

      const caseRes = await surgicalEngine.createCase({ tenantId, encounterId, caseNumber: 'CASE-006' });
      const caseId = caseRes.data!.id;

      // Seed schedule
      db.schedules.push({
        id: 'sched-006',
        tenant_id: tenantId,
        operating_room_id: 'room-6',
        scheduled_time_range: '[2026-08-08 10:00:00+00, 2026-08-08 11:00:00+00)',
        status: 'scheduled',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Missing consent, dirty room
      mockConsentResult = 'missing';
      mockCleaningResult = 'dirty';

      const readinessRes = await readinessEngine.evaluateReadiness(tenantId, caseId);
      expect(readinessRes.success).toBe(true);
      expect(readinessRes.data!.ready).toBe(false);
      expect(readinessRes.data!.status).toBe('not_ready');
      expect(readinessRes.data!.blockers).toContain('Patient consent is missing');
      expect(readinessRes.data!.blockers).toContain('Operating room cleaning is incomplete');
    });
  });
});
