/**
 * Bella Nail Product Service
 * 
 * Factory Proof #1: Product orchestration layer
 * Reuses Beauty OS application services unchanged
 * No new contracts or tables needed
 */

import {
  AppointmentService,
  ProfessionalAssignmentService,
  ResourceAllocationService,
  SessionTrackingService,
} from '../../platform/beauty/application/services';
import type {
  AppointmentRepository,
  ProfessionalAssignmentRepository,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
  SessionRepository,
  Clock,
  IdGenerator,
} from '../../platform/beauty/application/ports';
import type {
  AppointmentRecord,
  ProfessionalAssignmentRecord,
  ResourceAllocationRecord,
  SessionRecord,
  TimeInterval,
} from '../../platform/beauty/contracts';
import type { NailSessionOutcome } from './adapters';

// ============================================================================
// NAIL SERVICE ORCHESTRATION
// ============================================================================

export interface BookNailServiceInput {
  tenantId: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  technicianId: string;
  interval: TimeInterval;
  resources: Array<{
    resourceId: string;
    resourceType: string;
  }>;
}

export interface BookNailServiceOutput {
  appointment: AppointmentRecord;
  assignment: ProfessionalAssignmentRecord;
  allocations: ResourceAllocationRecord[];
  serviceCommitmentId: string;
}

export interface CompleteNailSessionInput {
  sessionId: string;
  outcome: NailSessionOutcome;
}

/**
 * Nail Service
 * 
 * REUSE: All Beauty OS application services
 * DELTA: Product-specific orchestration only
 */
export class NailService {
  private readonly appointmentService: AppointmentService;
  private readonly assignmentService: ProfessionalAssignmentService;
  private readonly allocationService: ResourceAllocationService;
  private readonly sessionService: SessionTrackingService;
  private readonly ids: IdGenerator;

  public constructor(
    appointmentRepo: AppointmentRepository,
    assignmentRepo: ProfessionalAssignmentRepository,
    allocationRepo: ResourceAllocationRepository,
    sessionRepo: SessionRepository,
    availability: ResourceAvailabilityPort,
    ids: IdGenerator,
    clock: Clock,
  ) {
    this.appointmentService = new AppointmentService(appointmentRepo, ids);
    this.assignmentService = new ProfessionalAssignmentService(assignmentRepo, ids, clock);
    this.allocationService = new ResourceAllocationService(allocationRepo, availability, ids, clock);
    this.sessionService = new SessionTrackingService(sessionRepo, clock);
    this.ids = ids;
  }

  /**
   * Book nail service with technician and resources
   * 
   * Workflow: Customer → Service → Technician → Time → Resources → Confirm
   * 
   * REUSE: Beauty OS services unchanged
   * Supports multi-resource (station + foot spa for pedicure)
   */
  public async bookService(input: BookNailServiceInput): Promise<BookNailServiceOutput> {
    const serviceCommitmentId = this.ids.next('commitment');

    // Create appointment
    const appointment = await this.appointmentService.create({
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      serviceId: input.serviceId,
      interval: input.interval,
    });

    // Assign technician
    const proposed = await this.assignmentService.propose({
      tenantId: input.tenantId,
      serviceCommitmentId,
      professionalId: input.technicianId,
    });
    const assignment = await this.assignmentService.decide(proposed, 'ACCEPTED', 'system');

    // Allocate resources (supports multi-resource)
    const allocations: ResourceAllocationRecord[] = [];
    for (const resource of input.resources) {
      const allocation = await this.allocationService.allocate({
        tenantId: input.tenantId,
        serviceCommitmentId,
        segmentId: `segment-${resource.resourceType}`,
        resourceId: resource.resourceId,
        interval: input.interval,
        capacityUnits: 1,
      });
      allocations.push(allocation);
    }

    return {
      appointment,
      assignment,
      allocations,
      serviceCommitmentId,
    };
  }

  /**
   * Reassign technician (disruption recovery)
   * 
   * REUSE: Beauty OS disruption pattern unchanged
   */
  public async reassignTechnician(
    assignment: ProfessionalAssignmentRecord,
    newTechnicianId: string,
    reason: string,
    actorId: string,
  ): Promise<ProfessionalAssignmentRecord> {
    const replacement = await this.assignmentService.disruptAndReplace({
      assignment,
      replacementProfessionalId: newTechnicianId,
      actorId,
      reason,
    });
    return this.assignmentService.decide(replacement, 'ACCEPTED', actorId);
  }

  /**
   * Start nail session
   * 
   * REUSE: Beauty OS session tracking unchanged
   */
  public async startSession(
    session: SessionRecord,
    technicianId: string,
  ): Promise<SessionRecord> {
    return this.sessionService.start(session, technicianId);
  }

  /**
   * Complete nail session with outcome
   * 
   * REUSE: Beauty OS session tracking unchanged
   * DELTA: Nail metadata stored in outcome jsonb field
   */
  public async completeSession(
    session: SessionRecord,
    outcome: NailSessionOutcome,
  ): Promise<SessionRecord> {
    return this.sessionService.complete(session, JSON.stringify(outcome));
  }
}

