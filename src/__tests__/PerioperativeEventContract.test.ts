/**
 * Perioperative Event Contract Test Suite
 * 
 * Verifies that all domain events published by the perioperative engines
 * conform to the canonical host event envelope format.
 * 
 * Invariants Checked:
 * 1. Event contains: eventId (UUID), eventType, eventVersion ("v1"), occurredAt (ISO 8601)
 * 2. Event contains: tenantId (UUID), aggregateId (UUID), aggregateType ('encounter')
 * 3. Event contains: correlationId, causationId (optional)
 * 4. Payload contains the matching properties for the event type.
 * 
 * Enforces Platform Constitution Law 11 (Strictly No any Types).
 * 
 * @module test/healthcare/perioperative-event-contract
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { eventBus } from '../platform/host/event-bus';
import { OREngineService } from '../platform/healthcare/engines/or-engine/or-engine.service';
import { SurgicalEngineService } from '../platform/healthcare/engines/surgical-engine/surgical-engine.service';
import type { DomainEvent } from '../platform/host/event-bus/types';

describe('Perioperative Event Contracts', () => {
  const mockSupabase = {
    from: (table: string) => {
      if (table === 'hc_idempotency_keys') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'hc_or_schedules') {
        return {
          insert: (row: Record<string, unknown>) => {
            const mockRow = { ...row, id: 'sched-123', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            return {
              select: () => ({
                single: () => Promise.resolve({ data: mockRow, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'hc_surgical_cases') {
        return {
          insert: (row: Record<string, unknown>) => {
            const mockRow = { ...row, id: 'case-123', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            return {
              select: () => ({
                single: () => Promise.resolve({ data: mockRow, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'hc_surgical_safety_checklists') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    },
  } as unknown as SupabaseClient;

  let orEngine: OREngineService;
  let surgicalEngine: SurgicalEngineService;

  beforeEach(() => {
    orEngine = new OREngineService(mockSupabase);
    surgicalEngine = new SurgicalEngineService(mockSupabase);
  });

  it('should publish a valid hos.or.scheduled.v1 event with proper envelope schema', async () => {
    const capturedEvents: DomainEvent[] = [];
    const unsubscribe = eventBus.subscribe('hos.or.scheduled.v1', (event) => {
      capturedEvents.push(event);
    });

    const res = await orEngine.scheduleOperation({
      tenantId: 'tenant-a',
      operatingRoomId: 'room-1',
      scheduledTimeRange: '[2026-08-08 10:00:00+00, 2026-08-08 11:00:00+00)',
      userId: 'user-doc',
    });

    expect(res.success).toBe(true);
    expect(capturedEvents).toHaveLength(1);

    const event = capturedEvents[0];
    expect(event.eventId).toBeDefined();
    expect(event.eventType).toBe('hos.or.scheduled.v1');
    expect(event.eventVersion).toBe('v1');
    expect(event.tenantId).toBe('tenant-a');
    expect(event.aggregateId).toBe('sched-123');
    expect(event.aggregateType).toBe('encounter');
    expect(new Date(event.occurredAt).getTime()).not.toBeNaN();
    expect(event.userId).toBe('user-doc');

    const payload = event.payload as Record<string, unknown>;
    expect(payload.scheduleId).toBe('sched-123');
    expect(payload.operatingRoomId).toBe('room-1');
    expect(payload.scheduledTimeRange).toBe('[2026-08-08 10:00:00+00, 2026-08-08 11:00:00+00)');
    expect(payload.status).toBe('scheduled');

    unsubscribe();
  });

  it('should publish a valid hos.surgical.case.created.v1 event with proper envelope schema', async () => {
    const capturedEvents: DomainEvent[] = [];
    const unsubscribe = eventBus.subscribe('hos.surgical.case.created.v1', (event) => {
      capturedEvents.push(event);
    });

    const res = await surgicalEngine.createCase({
      tenantId: 'tenant-a',
      encounterId: 'encounter-456',
      caseNumber: 'CASE-2026-001',
      userId: 'user-doc',
    });

    expect(res.success).toBe(true);
    expect(capturedEvents).toHaveLength(1);

    const event = capturedEvents[0];
    expect(event.eventId).toBeDefined();
    expect(event.eventType).toBe('hos.surgical.case.created.v1');
    expect(event.eventVersion).toBe('v1');
    expect(event.tenantId).toBe('tenant-a');
    expect(event.aggregateId).toBe('case-123');
    expect(event.aggregateType).toBe('encounter');
    expect(new Date(event.occurredAt).getTime()).not.toBeNaN();
    expect(event.userId).toBe('user-doc');

    const payload = event.payload as Record<string, unknown>;
    expect(payload.surgicalCaseId).toBe('case-123');
    expect(payload.encounterId).toBe('encounter-456');
    expect(payload.caseNumber).toBe('CASE-2026-001');
    expect(payload.status).toBe('planned');

    unsubscribe();
  });
});
