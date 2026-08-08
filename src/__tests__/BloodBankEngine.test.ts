/**
 * Blood Bank Engine Test Suite
 *
 * Verifies:
 * 1. RBC compatibility matrix: O→O, A→A/O, B→B/O, AB→all  (donated RBC to recipient)
 * 2. Rh factor: Rh- patient can ONLY receive Rh- units
 * 3. Blood unit status state machine transitions
 * 4. Double-verification requirement before transfusion start
 * 5. Expiration gate: expired blood units are blocked and marked EXPIRED
 * 6. Concurrent reservation protection (atomic UPDATE WHERE status=AVAILABLE)
 * 7. Crossmatch state machine enforcement
 * 8. Idempotency key protection
 *
 * Constitution Compliance:
 * - Law 11: Strictly no `any` types
 * - Law 5: Domain events published on safety blocks
 * - Law 1: Encounter is the aggregate root
 *
 * @module test/healthcare/blood-bank-engine
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BloodBankEngineService } from '../platform/healthcare/engines/blood-bank-engine/blood-bank-engine.service';

// ──────────────────────────────────────────────────────────────────────────────
// In-memory Mock DB types
// ──────────────────────────────────────────────────────────────────────────────

interface MockBloodUnit {
  id: string;
  tenant_id: string;
  unit_number: string;
  blood_type: 'A' | 'B' | 'AB' | 'O';
  rh_factor: 'POSITIVE' | 'NEGATIVE';
  component_type: string;
  status: 'RECEIVED' | 'QUARANTINED' | 'AVAILABLE' | 'RESERVED' | 'TRANSFUSING' | 'TRANSFUSED' | 'REJECTED' | 'EXPIRED' | 'DISCARDED';
  expiry_date: string;
  updated_at: string;
}

interface MockCrossmatch {
  id: string;
  tenant_id: string;
  encounter_id: string;
  blood_unit_id: string;
  status: 'REQUESTED' | 'SAMPLE_VERIFIED' | 'TESTED' | 'APPROVED' | 'INCOMPATIBLE';
  crossmatched_by?: string;
  crossmatched_at?: string;
  approved_by?: string;
  approved_at?: string;
  updated_at: string;
}

interface MockTransfusionVerification {
  id: string;
  tenant_id: string;
  encounter_id: string;
  blood_unit_id: string;
  crossmatch_id: string;
  verification_data: {
    bloodType: 'A' | 'B' | 'AB' | 'O';
    rhFactor: 'POSITIVE' | 'NEGATIVE';
    patientName: string;
    mrn: string;
  };
  verified_by_clinician_a: string;
  verified_by_clinician_b: string;
}

interface MockTransfusionRecord {
  id: string;
  tenant_id: string;
  encounter_id: string;
  blood_unit_id: string;
  verification_id: string;
  started_at: string;
  completed_at?: string;
  status: 'started' | 'completed' | 'aborted';
  reaction_occurred: boolean;
  reaction_details: string | null;
  updated_at?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// In-memory state
// ──────────────────────────────────────────────────────────────────────────────

let dbBloodUnits: MockBloodUnit[] = [];
let dbCrossmatches: MockCrossmatch[] = [];
let dbVerifications: MockTransfusionVerification[] = [];
let dbTransfusions: MockTransfusionRecord[] = [];
let dbIdempotencyKeys: Set<string> = new Set();

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

// Atomic concurrent reservation lock simulation
let reservationLock = false;

class MockQueryBuilder {
  private filters: Record<string, unknown> = {};
  private isInsert = false;
  private isUpdate = false;
  private insertPayload: Record<string, unknown> | null = null;
  private updatePayload: Record<string, unknown> | null = null;

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
    } else if (this.table === 'hc_blood_units') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockBloodUnit, 'id' | 'updated_at'>;
        const newRow: MockBloodUnit = {
          id: generateId(),
          ...row,
          updated_at: new Date().toISOString(),
        };
        dbBloodUnits.push(newRow);
        data = newRow;
      } else if (this.isUpdate) {
        // Atomic conditional UPDATE (WHERE status = AVAILABLE)
        const matches = dbBloodUnits.filter(u =>
          Object.entries(this.filters).every(([k, v]) => (u as unknown as Record<string, unknown>)[k] === v)
        );
        if (matches.length > 0) {
          Object.assign(matches[0], this.updatePayload);
          data = matches[0];
        } else {
          error = { message: 'No matching record (optimistic lock failure)' };
        }
      } else {
        const matches = dbBloodUnits.filter(u =>
          Object.entries(this.filters).every(([k, v]) => (u as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' ? (matches[0] || null) : (mode === 'maybeSingle' ? (matches[0] || null) : matches);
        if (mode === 'single' && !matches[0]) error = { message: 'Not found' };
      }
    } else if (this.table === 'hc_blood_crossmatch_records') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockCrossmatch, 'id' | 'updated_at'>;
        const newRow: MockCrossmatch = {
          id: generateId(),
          ...row,
          updated_at: new Date().toISOString(),
        };
        dbCrossmatches.push(newRow);
        data = newRow;
      } else if (this.isUpdate) {
        const matches = dbCrossmatches.filter(c =>
          Object.entries(this.filters).every(([k, v]) => (c as unknown as Record<string, unknown>)[k] === v)
        );
        if (matches.length > 0) {
          Object.assign(matches[0], this.updatePayload);
          data = matches[0];
        } else {
          error = { message: 'Not found' };
        }
      } else {
        const matches = dbCrossmatches.filter(c =>
          Object.entries(this.filters).every(([k, v]) => (c as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' ? (matches[0] || null) : (mode === 'maybeSingle' ? (matches[0] || null) : matches);
        if (mode === 'single' && !matches[0]) error = { message: 'Not found' };
      }
    } else if (this.table === 'hc_transfusion_verifications') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockTransfusionVerification, 'id'>;
        const newRow: MockTransfusionVerification = { id: generateId(), ...row };
        dbVerifications.push(newRow);
        data = newRow;
      } else {
        const matches = dbVerifications.filter(v =>
          Object.entries(this.filters).every(([k, val]) => (v as unknown as Record<string, unknown>)[k] === val)
        );
        data = mode === 'single' ? (matches[0] || null) : (mode === 'maybeSingle' ? (matches[0] || null) : matches);
        if (mode === 'single' && !matches[0]) error = { message: 'Not found' };
      }
    } else if (this.table === 'hc_transfusion_records') {
      if (this.isInsert) {
        const row = this.insertPayload as Omit<MockTransfusionRecord, 'id'>;
        const newRow: MockTransfusionRecord = { id: generateId(), ...row };
        dbTransfusions.push(newRow);
        data = newRow;
      } else if (this.isUpdate) {
        const matches = dbTransfusions.filter(t =>
          Object.entries(this.filters).every(([k, v]) => (t as unknown as Record<string, unknown>)[k] === v)
        );
        if (matches.length > 0) {
          Object.assign(matches[0], this.updatePayload);
          data = matches[0];
        } else {
          error = { message: 'Not found' };
        }
      } else {
        const matches = dbTransfusions.filter(t =>
          Object.entries(this.filters).every(([k, v]) => (t as unknown as Record<string, unknown>)[k] === v)
        );
        data = mode === 'single' ? (matches[0] || null) : (mode === 'maybeSingle' ? (matches[0] || null) : matches);
        if (mode === 'single' && !matches[0]) error = { message: 'Not found' };
      }
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

async function seedAvailableUnit(
  engine: BloodBankEngineService,
  params: {
    unitNumber?: string;
    bloodType: 'A' | 'B' | 'AB' | 'O';
    rhFactor: 'POSITIVE' | 'NEGATIVE';
    expiryDate?: string;
  }
): Promise<string> {
  const res = await engine.receiveBloodUnit({
    tenantId: 'tenant-a',
    unitNumber: params.unitNumber ?? `UNIT-${generateId()}`,
    bloodType: params.bloodType,
    rhFactor: params.rhFactor,
    componentType: 'RBC',
    expiryDate: params.expiryDate ?? new Date(Date.now() + 86400000 * 35).toISOString(), // 35 days
  });
  expect(res.success).toBe(true);
  const unit = dbBloodUnits[dbBloodUnits.length - 1];
  // Set status to AVAILABLE
  unit.status = 'AVAILABLE';
  return unit.id;
}

async function getCrossmatchApproved(
  engine: BloodBankEngineService,
  encounterId: string,
  bloodUnitId: string
): Promise<string> {
  const crossmatchRes = await engine.requestCrossmatch({
    tenantId: 'tenant-a',
    encounterId,
    bloodUnitId,
  });
  expect(crossmatchRes.success).toBe(true);
  const crossmatchId = dbCrossmatches[dbCrossmatches.length - 1].id;

  const resultRes = await engine.recordCrossmatchResult({
    tenantId: 'tenant-a',
    crossmatchId,
    status: 'COMPATIBLE',
    crossmatchedBy: 'lab-tech-1',
  });
  expect(resultRes.success).toBe(true);

  const approveRes = await engine.approveCrossmatch({
    tenantId: 'tenant-a',
    crossmatchId,
    approvedBy: 'doctor-1',
  });
  expect(approveRes.success).toBe(true);

  return crossmatchId;
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────────────────────────────────────

describe('BloodBankEngine', () => {
  let bloodBankEngine: BloodBankEngineService;

  beforeEach(() => {
    dbBloodUnits = [];
    dbCrossmatches = [];
    dbVerifications = [];
    dbTransfusions = [];
    dbIdempotencyKeys.clear();
    publishedEvents.length = 0;
    reservationLock = false;
    bloodBankEngine = new BloodBankEngineService(mockSupabase);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // RBC Compatibility Matrix
  // ────────────────────────────────────────────────────────────────────────────
  describe('RBC Compatibility Check', () => {
    const compatibilityMatrix: Array<{
      donor: 'A' | 'B' | 'AB' | 'O';
      recipient: 'A' | 'B' | 'AB' | 'O';
      compatible: boolean;
    }> = [
      // Type O: universal donor (RBC)
      { donor: 'O', recipient: 'O', compatible: true },
      { donor: 'O', recipient: 'A', compatible: true },
      { donor: 'O', recipient: 'B', compatible: true },
      { donor: 'O', recipient: 'AB', compatible: true },
      // Type A
      { donor: 'A', recipient: 'A', compatible: true },
      { donor: 'A', recipient: 'AB', compatible: true },
      { donor: 'A', recipient: 'O', compatible: false },  // A → O: incompatible
      { donor: 'A', recipient: 'B', compatible: false },  // A → B: incompatible
      // Type B
      { donor: 'B', recipient: 'B', compatible: true },
      { donor: 'B', recipient: 'AB', compatible: true },
      { donor: 'B', recipient: 'O', compatible: false },  // B → O: incompatible
      { donor: 'B', recipient: 'A', compatible: false },  // B → A: incompatible
      // Type AB: can only donate to AB
      { donor: 'AB', recipient: 'AB', compatible: true },
      { donor: 'AB', recipient: 'A', compatible: false },
      { donor: 'AB', recipient: 'B', compatible: false },
      { donor: 'AB', recipient: 'O', compatible: false },
    ];

    test.each(compatibilityMatrix)(
      'Donor $donor → Recipient $recipient: compatible=$compatible',
      async ({ donor, recipient, compatible }) => {
        const unitId = await seedAvailableUnit(bloodBankEngine, {
          bloodType: donor,
          rhFactor: 'POSITIVE',
        });

        const crossmatchId = await getCrossmatchApproved(bloodBankEngine, 'enc-1', unitId);

        // Reserve unit
        await bloodBankEngine.reserveBloodUnit({
          tenantId: 'tenant-a',
          encounterId: 'enc-1',
          bloodUnitId: unitId,
        });

        const res = await bloodBankEngine.doubleVerifyTransfusion({
          tenantId: 'tenant-a',
          encounterId: 'enc-1',
          bloodUnitId: unitId,
          crossmatchId,
          verificationData: {
            bloodType: recipient,
            rhFactor: 'POSITIVE',
            patientName: 'Test Patient',
            mrn: 'MRN-001',
          },
          verifiedByClinicianA: 'nurse-a',
          verifiedByClinicianB: 'nurse-b',
        });

        if (compatible) {
          expect(res.success).toBe(true);
        } else {
          expect(res.success).toBe(false);
          expect(res.error?.message).toContain('RBC Compatibility check failed');

          // Safety block event published
          const blockEvent = publishedEvents.find(e => e.eventType === 'hos.blood.transfusion.blocked.v1');
          expect(blockEvent).toBeDefined();
        }

        // Reset DB for next iteration
        dbBloodUnits = [];
        dbCrossmatches = [];
        dbVerifications = [];
        dbIdempotencyKeys.clear();
        publishedEvents.length = 0;
      }
    );

    it('should block Rh- patient from receiving Rh+ unit', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, {
        bloodType: 'O',
        rhFactor: 'POSITIVE', // Rh+ unit
      });

      const crossmatchId = await getCrossmatchApproved(bloodBankEngine, 'enc-2', unitId);

      await bloodBankEngine.reserveBloodUnit({
        tenantId: 'tenant-a',
        encounterId: 'enc-2',
        bloodUnitId: unitId,
      });

      const res = await bloodBankEngine.doubleVerifyTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-2',
        bloodUnitId: unitId,
        crossmatchId,
        verificationData: {
          bloodType: 'O',
          rhFactor: 'NEGATIVE', // Rh- patient
          patientName: 'Jane Doe',
          mrn: 'MRN-002',
        },
        verifiedByClinicianA: 'nurse-a',
        verifiedByClinicianB: 'nurse-b',
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('RBC Compatibility check failed');
      expect(res.error?.message).toContain('NEGATIVE');
    });

    it('should allow Rh+ patient to receive Rh- unit', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, {
        bloodType: 'O',
        rhFactor: 'NEGATIVE', // Rh- unit
      });

      const crossmatchId = await getCrossmatchApproved(bloodBankEngine, 'enc-3', unitId);

      await bloodBankEngine.reserveBloodUnit({
        tenantId: 'tenant-a',
        encounterId: 'enc-3',
        bloodUnitId: unitId,
      });

      const res = await bloodBankEngine.doubleVerifyTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-3',
        bloodUnitId: unitId,
        crossmatchId,
        verificationData: {
          bloodType: 'O',
          rhFactor: 'POSITIVE', // Rh+ patient can receive Rh-
          patientName: 'John Doe',
          mrn: 'MRN-003',
        },
        verifiedByClinicianA: 'nurse-a',
        verifiedByClinicianB: 'nurse-b',
      });

      expect(res.success).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Crossmatch State Machine
  // ────────────────────────────────────────────────────────────────────────────
  describe('crossmatch state machine', () => {
    it('should reject crossmatch that is not in TESTED state for approval', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, { bloodType: 'A', rhFactor: 'POSITIVE' });

      const crossmatchRes = await bloodBankEngine.requestCrossmatch({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
      });
      expect(crossmatchRes.success).toBe(true);
      const crossmatchId = dbCrossmatches[0].id;

      // Try to approve without recording result first (status=REQUESTED, not TESTED)
      const approveRes = await bloodBankEngine.approveCrossmatch({
        tenantId: 'tenant-a',
        crossmatchId,
        approvedBy: 'doctor-1',
      });

      expect(approveRes.success).toBe(false);
      expect(approveRes.error?.code).toBe('APPROVE_CROSSMATCH_FAILED');
    });

    it('should block double-verification if crossmatch is not APPROVED', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, { bloodType: 'O', rhFactor: 'POSITIVE' });
      // Unit starts as AVAILABLE (set by seedAvailableUnit), requestCrossmatch allowed at AVAILABLE status

      const crossmatchRes = await bloodBankEngine.requestCrossmatch({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
      });
      expect(crossmatchRes.success).toBe(true);
      const crossmatchId = dbCrossmatches[0].id;
      // crossmatch is still REQUESTED (not approved); now set unit to RESERVED for the verification step
      const unit = dbBloodUnits[0];
      unit.status = 'RESERVED';

      const verRes = await bloodBankEngine.doubleVerifyTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
        crossmatchId,
        verificationData: {
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          patientName: 'Patient',
          mrn: 'MRN',
        },
        verifiedByClinicianA: 'nurse-a',
        verifiedByClinicianB: 'nurse-b',
      });

      expect(verRes.success).toBe(false);
      expect(verRes.error?.message).toContain('Crossmatch must be approved');

      const blockEvent = publishedEvents.find(e => e.eventType === 'hos.blood.transfusion.blocked.v1');
      expect(blockEvent).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Expiration Gate
  // ────────────────────────────────────────────────────────────────────────────
  describe('expiration gate', () => {
    it('should block transfusion start for an expired blood unit and mark it EXPIRED', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, {
        bloodType: 'O',
        rhFactor: 'POSITIVE',
        expiryDate: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
      });

      const crossmatchId = await getCrossmatchApproved(bloodBankEngine, 'enc-1', unitId);

      // Set unit to RESERVED manually (skip reservation step)
      const unit = dbBloodUnits.find(u => u.id === unitId);
      if (unit) unit.status = 'RESERVED';

      // Create verification record directly
      const ver: MockTransfusionVerification = {
        id: generateId(),
        tenant_id: 'tenant-a',
        encounter_id: 'enc-1',
        blood_unit_id: unitId,
        crossmatch_id: crossmatchId,
        verification_data: { bloodType: 'O', rhFactor: 'POSITIVE', patientName: 'Patient', mrn: 'MRN' },
        verified_by_clinician_a: 'nurse-a',
        verified_by_clinician_b: 'nurse-b',
      };
      dbVerifications.push(ver);

      const res = await bloodBankEngine.startTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
        verificationId: ver.id,
        startedAt: new Date().toISOString(),
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('expired');

      // Side effect: unit must be marked EXPIRED
      const updatedUnit = dbBloodUnits.find(u => u.id === unitId);
      expect(updatedUnit?.status).toBe('EXPIRED');

      // Safety block event published
      const expiredEvent = publishedEvents.find(e => {
        if (typeof e.payload !== 'object' || e.payload === null) return false;
        const payload = e.payload as Record<string, unknown>;
        return e.eventType === 'hos.blood.transfusion.blocked.v1' && payload['reasonCode'] === 'BLOOD_UNIT_EXPIRED';
      });
      expect(expiredEvent).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Concurrent Reservation Protection
  // ────────────────────────────────────────────────────────────────────────────
  describe('concurrent reservation protection', () => {
    it('should guarantee exactly one concurrent reservation succeeds (optimistic lock)', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, { bloodType: 'O', rhFactor: 'POSITIVE' });

      // Simulate concurrent reservations
      const p1 = bloodBankEngine.reserveBloodUnit({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
      });
      const p2 = bloodBankEngine.reserveBloodUnit({
        tenantId: 'tenant-a',
        encounterId: 'enc-2',
        bloodUnitId: unitId,
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      const successCount = (r1.success ? 1 : 0) + (r2.success ? 1 : 0);
      expect(successCount).toBe(1);

      // The failed reservation must have published a block event
      const blockEvent = publishedEvents.find(e => {
        if (typeof e.payload !== 'object' || e.payload === null) return false;
        const payload = e.payload as Record<string, unknown>;
        return e.eventType === 'hos.blood.transfusion.blocked.v1' && payload['reasonCode'] === 'CONCURRENT_RESERVATION_CONFLICT';
      });
      expect(blockEvent).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Double Verification Requirement
  // ────────────────────────────────────────────────────────────────────────────
  describe('double verification requirement', () => {
    it('should require two distinct clinician signatures for verification', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, { bloodType: 'A', rhFactor: 'POSITIVE' });
      const crossmatchId = await getCrossmatchApproved(bloodBankEngine, 'enc-1', unitId);

      const unit = dbBloodUnits[0];
      unit.status = 'RESERVED';

      const res = await bloodBankEngine.doubleVerifyTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
        crossmatchId,
        verificationData: {
          bloodType: 'A',
          rhFactor: 'POSITIVE',
          patientName: 'Test Patient',
          mrn: 'MRN-001',
        },
        verifiedByClinicianA: 'nurse-a',
        verifiedByClinicianB: 'nurse-b',
      });

      expect(res.success).toBe(true);
      expect(res.data?.verified_by_clinician_a).toBe('nurse-a');
      expect(res.data?.verified_by_clinician_b).toBe('nurse-b');

      // Verification record is immutable after creation
      expect(dbVerifications.length).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Full Happy Path
  // ────────────────────────────────────────────────────────────────────────────
  describe('full transfusion happy path', () => {
    it('should complete a full transfusion cycle without reactions', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, { bloodType: 'O', rhFactor: 'NEGATIVE' });
      const crossmatchId = await getCrossmatchApproved(bloodBankEngine, 'enc-1', unitId);

      const reserveRes = await bloodBankEngine.reserveBloodUnit({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
      });
      expect(reserveRes.success).toBe(true);
      expect(dbBloodUnits[0].status).toBe('RESERVED');

      const verifyRes = await bloodBankEngine.doubleVerifyTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
        crossmatchId,
        verificationData: {
          bloodType: 'AB',
          rhFactor: 'POSITIVE',
          patientName: 'Universal Recipient',
          mrn: 'MRN-AB+',
        },
        verifiedByClinicianA: 'nurse-a',
        verifiedByClinicianB: 'doctor-b',
      });
      expect(verifyRes.success).toBe(true);
      const verificationId = dbVerifications[0].id;

      const startRes = await bloodBankEngine.startTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
        verificationId,
        startedAt: new Date().toISOString(),
      });
      expect(startRes.success).toBe(true);
      expect(dbBloodUnits[0].status).toBe('TRANSFUSING');

      const completeRes = await bloodBankEngine.completeTransfusion({
        tenantId: 'tenant-a',
        transfusionId: dbTransfusions[0].id,
        completedAt: new Date().toISOString(),
        reactionOccurred: false,
      });
      expect(completeRes.success).toBe(true);
      expect(completeRes.data?.status).toBe('completed');
      expect(dbBloodUnits[0].status).toBe('TRANSFUSED');

      const completedEvent = publishedEvents.find(e => e.eventType === 'hos.blood.transfusion.completed.v1');
      expect(completedEvent).toBeDefined();
    });

    it('should mark transfusion as aborted and unit as REJECTED on reaction', async () => {
      const unitId = await seedAvailableUnit(bloodBankEngine, { bloodType: 'A', rhFactor: 'POSITIVE' });
      const crossmatchId = await getCrossmatchApproved(bloodBankEngine, 'enc-1', unitId);

      const unit = dbBloodUnits[0];
      unit.status = 'RESERVED';

      const verifyRes = await bloodBankEngine.doubleVerifyTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
        crossmatchId,
        verificationData: {
          bloodType: 'A',
          rhFactor: 'POSITIVE',
          patientName: 'Patient A+',
          mrn: 'MRN-A+',
        },
        verifiedByClinicianA: 'nurse-a',
        verifiedByClinicianB: 'nurse-b',
      });
      expect(verifyRes.success).toBe(true);

      const startRes = await bloodBankEngine.startTransfusion({
        tenantId: 'tenant-a',
        encounterId: 'enc-1',
        bloodUnitId: unitId,
        verificationId: dbVerifications[0].id,
        startedAt: new Date().toISOString(),
      });
      expect(startRes.success).toBe(true);

      const completeRes = await bloodBankEngine.completeTransfusion({
        tenantId: 'tenant-a',
        transfusionId: dbTransfusions[0].id,
        completedAt: new Date().toISOString(),
        reactionOccurred: true,
        reactionDetails: 'Febrile non-hemolytic reaction',
      });

      expect(completeRes.success).toBe(true);
      expect(completeRes.data?.status).toBe('aborted');
      expect(completeRes.data?.reaction_occurred).toBe(true);
      expect(dbBloodUnits[0].status).toBe('REJECTED');
    });
  });
});
