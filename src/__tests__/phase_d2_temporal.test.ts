/**
 * Phase D2 — Temporal Intelligence Engine Tests
 * Tests: event-driven capture, point-in-time query, version monotonicity,
 *        snapshot diff, immutability guards.
 *
 * Key architectural constraint verified:
 *   - Snapshots are CAPTURED by explicit captureSnapshot() calls (event-driven)
 *   - NOT by DB triggers on domain tables
 *   - getAtPointInTime() answers "What did system know at T?" (read-only)
 *   - diffSnapshots() surfaces field-level changes between versions
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { TemporalEngineService } from '@/platform/host/temporal-engine';
import crypto from 'crypto';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const TEST_TENANT_ID = '88888888-8888-8888-8888-888888888888';

const TEST_ENTITY_TYPE = 'test_clinical_order';

let supabase: ReturnType<typeof createClient<Database>>;
let engine: TemporalEngineService;

beforeAll(() => {
  supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  engine = new TemporalEngineService(supabase, TEST_TENANT_ID);
});

// ─────────────────────────────────────────────────────────────────
// Suite 1: Snapshot Capture — version monotonicity
// ─────────────────────────────────────────────────────────────────
describe('D2 TemporalEngine — Snapshot capture and versioning', () => {
  it('should capture INSERT snapshot with version=1', async () => {
    const entityId = crypto.randomUUID();

    const snap = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: { id: entityId, status: 'PENDING', priority: 'ROUTINE', quantity: 1 },
      changeType: 'INSERT',
      changeSummary: 'Order created',
      sourceEventType: 'hos.order.created.v1',
    });

    expect(snap.snapshotVersion).toBe(1);
    expect(snap.changeType).toBe('INSERT');
    expect(snap.snapshotData['status']).toBe('PENDING');
    expect(snap.entityType).toBe(TEST_ENTITY_TYPE);
  });

  it('should auto-increment version on subsequent snapshots for same entity', async () => {
    const entityId = crypto.randomUUID();

    const snap1 = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: { status: 'PENDING' },
      changeType: 'INSERT',
    });

    const snap2 = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: { status: 'ACTIVE' },
      changeType: 'UPDATE',
      changedFields: ['status'],
      changeSummary: 'Order approved',
    });

    const snap3 = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: { status: 'DISCONTINUED' },
      changeType: 'SOFT_DELETE',
      changeSummary: 'Order cancelled',
    });

    expect(snap1.snapshotVersion).toBe(1);
    expect(snap2.snapshotVersion).toBe(2);
    expect(snap3.snapshotVersion).toBe(3);
  });

  it('should capture with D1 transaction linkage', async () => {
    const entityId = crypto.randomUUID();
    const fakeTransactionId = '66666666-6666-6666-6666-666666666666';

    const snap = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: { status: 'ROLLED_BACK_VIA_D1' },
      changeType: 'UPDATE',
      changeSummary: 'State reverted by RollbackEngine',
      correlationId: fakeTransactionId,
    });

    expect(snap.id).toBeDefined();
    expect(snap.correlationId).toBe(fakeTransactionId);
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 2: getAtPointInTime — "What did system know at T?"
// ─────────────────────────────────────────────────────────────────
describe('D2 TemporalEngine — Point-in-time queries', () => {
  let entityId: string;

  beforeAll(async () => {
    entityId = crypto.randomUUID();
    // Seed 3 snapshots with known states
    await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId, snapshotData: { status: 'PENDING' }, changeType: 'INSERT' });
    await new Promise(r => setTimeout(r, 100)); // ensure different timestamps
    await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId, snapshotData: { status: 'ACTIVE' }, changeType: 'UPDATE', changedFields: ['status'] });
    await new Promise(r => setTimeout(r, 100));
    await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId, snapshotData: { status: 'COMPLETED' }, changeType: 'UPDATE', changedFields: ['status'] });
  });

  it('should return latest snapshot for "now"', async () => {
    const snap = await engine.getAtPointInTime(
      TEST_ENTITY_TYPE,
      entityId,
      new Date(Date.now() + 60000).toISOString() // 1 minute in future to avoid database clock skew
    );

    expect(snap).not.toBeNull();
    expect(snap?.snapshotData['status']).toBe('COMPLETED');
    expect(snap?.snapshotVersion).toBe(3);
  });

  it('should return null for timestamp before entity existed', async () => {
    const snap = await engine.getAtPointInTime(
      TEST_ENTITY_TYPE,
      entityId,
      '2020-01-01T00:00:00Z'  // before our test data
    );
    expect(snap).toBeNull();
  });

  it('should return getLatestSnapshot matching current state', async () => {
    const snap = await engine.getLatestSnapshot(TEST_ENTITY_TYPE, entityId);
    expect(snap?.snapshotData['status']).toBe('COMPLETED');
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 3: getHistory — full chronological audit trail
// ─────────────────────────────────────────────────────────────────
describe('D2 TemporalEngine — History queries', () => {
  let entityId: string;

  beforeAll(async () => {
    entityId = crypto.randomUUID();
    await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId, snapshotData: { status: 'PENDING' }, changeType: 'INSERT' });
    await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId, snapshotData: { status: 'ACTIVE' }, changeType: 'UPDATE', changedFields: ['status'] });
    await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId, snapshotData: { status: 'DISCONTINUED' }, changeType: 'SOFT_DELETE' });
  });

  it('should return all 3 snapshots in ascending version order', async () => {
    const history = await engine.getHistory(TEST_ENTITY_TYPE, entityId);
    expect(history.length).toBe(3);
    expect(history[0]?.changeType).toBe('INSERT');
    expect(history[1]?.changeType).toBe('UPDATE');
    expect(history[2]?.changeType).toBe('SOFT_DELETE');
    // Versions ascending
    expect(history[0]?.snapshotVersion).toBeLessThan(history[1]!.snapshotVersion);
    expect(history[1]?.snapshotVersion).toBeLessThan(history[2]!.snapshotVersion);
  });

  it('should filter history by changeTypes', async () => {
    const updates = await engine.getHistory(TEST_ENTITY_TYPE, entityId, {
      changeTypes: ['UPDATE', 'SOFT_DELETE'],
    });
    expect(updates.length).toBe(2);
    expect(updates.every(s => s.changeType !== 'INSERT')).toBe(true);
  });

  it('should respect limit option', async () => {
    const limited = await engine.getHistory(TEST_ENTITY_TYPE, entityId, { limit: 2 });
    expect(limited.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 4: diffSnapshots — field-level change detection
// ─────────────────────────────────────────────────────────────────
describe('D2 TemporalEngine — Snapshot diff', () => {
  it('should surface changed, added, and removed fields between two snapshots', async () => {
    const entityId = crypto.randomUUID();

    const v1 = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: {
        status: 'PENDING',
        priority: 'ROUTINE',
        note: 'Initial order',
        quantity: 5,
      },
      changeType: 'INSERT',
    });

    const v2 = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: {
        status: 'ACTIVE',    // changed
        priority: 'ROUTINE', // unchanged
        // note removed
        quantity: 10,        // changed
        approvedBy: 'dr-uuid', // added
      },
      changeType: 'UPDATE',
      changedFields: ['status', 'quantity', 'approvedBy', 'note'],
    });

    const diff = await engine.diffSnapshots(v1.id, v2.id);

    expect(diff.version1).toBe(v1.snapshotVersion);
    expect(diff.version2).toBe(v2.snapshotVersion);

    // Changed fields
    expect(diff.changes['status']).toEqual({ before: 'PENDING', after: 'ACTIVE' });
    expect(diff.changes['quantity']).toEqual({ before: 5, after: 10 });

    // Added fields
    expect(diff.addedFields).toContain('approvedBy');

    // Removed fields
    expect(diff.removedFields).toContain('note');

    // Unchanged field should not appear in changes
    expect(diff.changes['priority']).toBeUndefined();
  });

  it('should throw if comparing snapshots from different entities', async () => {
    const entity1 = crypto.randomUUID();
    const entity2 = crypto.randomUUID();

    const s1 = await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId: entity1, snapshotData: { x: 1 }, changeType: 'INSERT' });
    const s2 = await engine.captureSnapshot({ entityType: TEST_ENTITY_TYPE, entityId: entity2, snapshotData: { x: 2 }, changeType: 'INSERT' });

    await expect(engine.diffSnapshots(s1.id, s2.id)).rejects.toThrow(/different entities/);
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 5: Immutability guards
// ─────────────────────────────────────────────────────────────────
describe('D2 TemporalEngine — Immutability', () => {
  it('should reject UPDATE on platform_temporal_snapshots', async () => {
    const entityId = crypto.randomUUID();
    const snap = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: { status: 'PENDING' },
      changeType: 'INSERT',
    });

    const { error } = await supabase
      .from('platform_temporal_snapshots')
      .update({ change_summary: 'Attempted tamper' })
      .eq('id', snap.id);

    expect(error).toBeDefined();
    expect(error?.message).toContain('append-only');
  });

  it('should reject DELETE on platform_temporal_snapshots', async () => {
    const entityId = crypto.randomUUID();
    const snap = await engine.captureSnapshot({
      entityType: TEST_ENTITY_TYPE,
      entityId,
      snapshotData: { status: 'ACTIVE' },
      changeType: 'INSERT',
    });

    const { error } = await supabase
      .from('platform_temporal_snapshots')
      .delete()
      .eq('id', snap.id);

    expect(error).toBeDefined();
    expect(error?.message).toContain('append-only');
  });
});
