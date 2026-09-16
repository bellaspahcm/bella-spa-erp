import {
  ProfessionalAssignmentRecord,
  ResourceAllocationRecord,
  ResourceCapacityWindow,
  SessionRecord,
  TimeInterval,
} from './domain';

export type InvariantViolation =
  | 'INVALID_INTERVAL'
  | 'INVALID_CAPACITY'
  | 'REASON_REQUIRED'
  | 'ACTOR_REQUIRED'
  | 'DECISION_TIME_REQUIRED'
  | 'REPLACEMENT_LINK_REQUIRED'
  | 'INVALID_SESSION_TIMES'
  | 'COMPLETION_REQUIRES_OUTCOME'
  | 'ACTUAL_PERFORMER_REQUIRED'
  | 'TENANT_MISMATCH'
  | 'RESOURCE_UNAVAILABLE'
  | 'RESOURCE_CAPACITY_CONFLICT';

export function validateInterval(interval: TimeInterval): InvariantViolation | null {
  const startsAt = Date.parse(interval.startsAt);
  const endsAt = Date.parse(interval.endsAt);
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt < endsAt
    ? null
    : 'INVALID_INTERVAL';
}

export function validateAssignmentChange(
  assignment: ProfessionalAssignmentRecord,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (assignment.status === 'REJECTED' || assignment.status === 'DISRUPTED') {
    if (!assignment.reason) violations.push('REASON_REQUIRED');
    if (!assignment.actorId) violations.push('ACTOR_REQUIRED');
    if (!assignment.decidedAt) violations.push('DECISION_TIME_REQUIRED');
  }
  if (assignment.replacementForId === assignment.id) {
    violations.push('REPLACEMENT_LINK_REQUIRED');
  }
  return violations;
}

export function validateAllocation(
  allocation: ResourceAllocationRecord,
  availability: ResourceCapacityWindow,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (allocation.tenantId !== availability.tenantId) violations.push('TENANT_MISMATCH');
  if (validateInterval(allocation.interval)) violations.push('INVALID_INTERVAL');
  if (allocation.capacityUnits <= 0) violations.push('INVALID_CAPACITY');
  if (availability.unavailable) violations.push('RESOURCE_UNAVAILABLE');
  if (allocation.capacityUnits > availability.capacityUnits) {
    violations.push('RESOURCE_CAPACITY_CONFLICT');
  }
  return violations;
}

export function validateSession(session: SessionRecord): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (session.actualEndAt && !session.actualStartAt) violations.push('INVALID_SESSION_TIMES');
  if (session.actualStartAt && session.actualEndAt) {
    const start = Date.parse(session.actualStartAt);
    const end = Date.parse(session.actualEndAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      violations.push('INVALID_SESSION_TIMES');
    }
  }
  if (session.status === 'COMPLETED' && !session.outcome) violations.push('COMPLETION_REQUIRES_OUTCOME');
  if (session.status === 'COMPLETED' && !session.actualPerformerId) {
    violations.push('ACTUAL_PERFORMER_REQUIRED');
  }
  return violations;
}

export function intervalsOverlap(left: TimeInterval, right: TimeInterval): boolean {
  const leftStart = Date.parse(left.startsAt);
  const leftEnd = Date.parse(left.endsAt);
  const rightStart = Date.parse(right.startsAt);
  const rightEnd = Date.parse(right.endsAt);
  return leftStart < rightEnd && rightStart < leftEnd;
}
