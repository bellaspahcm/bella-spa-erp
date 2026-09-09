/**
 * Bella Preschool OS — Scheduling Projection Bridge
 * 
 * Projects staffing shortage events (STAFFING_SHORTAGE_SLA) from P8 Scheduling
 * into the Reusable Exception Work Queue Candidate.
 * 
 * Supreme Invariant:
 * Resolving an exception in the Work Queue DOES NOT mutate P8 scheduling truth.
 * Compliance state strictly remains SHORTAGE_VIOLATION until actual substitute assignment
 * and ratio recalculation occurs.
 */

import { ParentCommunicationRepository } from '../../parent-engagement/repositories/parent-communication.repository';
import { CommunicationExceptionService } from '../../parent-engagement/services/communication-exception.service';
import { RatioComplianceSnapshot } from '../domain/scheduling.types';

export class SchedulingProjectionBridge {
  private exceptionService: CommunicationExceptionService;

  constructor(commRepo?: ParentCommunicationRepository, service?: CommunicationExceptionService) {
    if (service) {
      this.exceptionService = service;
    } else {
      const repo = commRepo || new ParentCommunicationRepository();
      this.exceptionService = new CommunicationExceptionService(repo);
    }
  }

  /**
   * Projects a coverage shortage violation to the Exception Work Queue Candidate.
   */
  async projectShortageException(
    snapshot: RatioComplianceSnapshot,
    escalatedByPartyId: string
  ) {
    if (snapshot.complianceState !== 'SHORTAGE_VIOLATION') {
      throw new Error('NON_SHORTAGE_SNAPSHOT_ERROR: Only SHORTAGE_VIOLATION snapshots can be projected to Exception Work Queue');
    }

    // Idempotency check: check if an OPEN exception already exists for this classroom shortage
    const openExceptions = await this.exceptionService.getStaffWorkQueueExceptions(snapshot.tenantId, 'OPEN');
    const existing = openExceptions.find(
      (e) => e.student_id === snapshot.classroomId && (e.exception_type as string) === 'STAFFING_SHORTAGE_SLA'
    );

    if (existing) {
      return {
        ...existing,
        sourceDomain: 'P8_SCHEDULING',
        sourceEntityId: snapshot.id,
      };
    }

    const payload = {
      tenantId: snapshot.tenantId,
      noticeId: null,
      studentId: snapshot.classroomId, // classroom identifier
      guardianPartyId: escalatedByPartyId, // Manager party receiving escalation
      exceptionType: 'STAFFING_SHORTAGE_SLA' as any,
      severity: 'HIGH' as const,
      assignedRole: 'PRINCIPAL' as const,
    };

    const created = await this.exceptionService.createException(payload);
    return {
      ...created,
      sourceDomain: 'P8_SCHEDULING',
      sourceEntityId: snapshot.id,
    };
  }
}
