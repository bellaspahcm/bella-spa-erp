import {
  intervalsOverlap,
  validateAllocation,
  validateAssignmentChange,
  validateSession,
} from '../invariants';
import { ProfessionalAssignmentRecord, ResourceAllocationRecord, ResourceCapacityWindow, SessionRecord } from '../domain';

const interval = { startsAt: '2026-09-16T10:00:00.000Z', endsAt: '2026-09-16T10:30:00.000Z' };

describe('Beauty OS H8 invariants', () => {
  it('uses half-open interval semantics for resource conflicts', () => {
    expect(intervalsOverlap(interval, { startsAt: interval.endsAt, endsAt: '2026-09-16T11:00:00.000Z' })).toBe(false);
    expect(intervalsOverlap(interval, { startsAt: '2026-09-16T10:29:00.000Z', endsAt: '2026-09-16T11:00:00.000Z' })).toBe(true);
  });

  it('requires reason, actor, and decision time for assignment disruption', () => {
    const assignment: ProfessionalAssignmentRecord = {
      id: 'a1', tenantId: 't1', serviceCommitmentId: 'c1', professionalId: 'p1',
      status: 'DISRUPTED', replacementForId: null, reason: null, actorId: null,
      proposedAt: '2026-09-16T09:00:00.000Z', decidedAt: null,
    };
    expect(validateAssignmentChange(assignment)).toEqual(['REASON_REQUIRED', 'ACTOR_REQUIRED', 'DECISION_TIME_REQUIRED']);
  });

  it('blocks allocation against unavailable or insufficient tenant-scoped capacity', () => {
    const allocation: ResourceAllocationRecord = {
      id: 'al1', tenantId: 't1', serviceCommitmentId: 'c1', segmentId: 'seg1', resourceId: 'r1',
      interval, capacityUnits: 2, status: 'PROPOSED', replacementForId: null, reason: null, actorId: null,
    };
    const capacity: ResourceCapacityWindow = {
      tenantId: 't2', resourceId: 'r1', interval, capacityUnits: 1, unavailable: true,
    };
    expect(validateAllocation(allocation, capacity)).toEqual([
      'TENANT_MISMATCH', 'RESOURCE_UNAVAILABLE', 'RESOURCE_CAPACITY_CONFLICT',
    ]);
  });

  it('keeps actual performer canonical in Session Tracking', () => {
    const session: SessionRecord = {
      id: 's1', tenantId: 't1', appointmentId: 'ap1', serviceCommitmentId: 'c1',
      status: 'COMPLETED', actualStartAt: '2026-09-16T10:00:00.000Z',
      actualEndAt: '2026-09-16T10:30:00.000Z', actualPerformerId: null, outcome: 'done',
    };
    expect(validateSession(session)).toEqual(['ACTUAL_PERFORMER_REQUIRED']);
  });
});
