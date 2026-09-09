/**
 * Bella Preschool OS — Staff Roster Service
 * 
 * Manages shift planning, staff roster assignments, availability checks,
 * and append-only shift amendments.
 */

import { PreschoolSchedulingRepository } from '../repositories/preschool-scheduling.repository';
import {
  ShiftTemplate,
  ShiftAssignment,
  CreateShiftAssignmentInput,
  AmendShiftAssignmentInput,
  StaffAvailability,
} from '../domain/scheduling.types';

export class StaffRosterService {
  constructor(private repo: PreschoolSchedulingRepository) {}

  async createShiftTemplate(input: {
    tenantId: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
  }): Promise<ShiftTemplate> {
    if (!input.name || !input.code || !input.startTime || !input.endTime) {
      throw new Error('INVALID_SHIFT_TEMPLATE_INPUT: Name, code, start time, and end time required');
    }
    return this.repo.createShiftTemplate(input);
  }

  async setStaffAvailability(input: {
    tenantId: string;
    staffPartyId: string;
    dayOfWeek: number;
    shiftTemplateId?: string;
    isAvailable: boolean;
  }): Promise<StaffAvailability> {
    return this.repo.setStaffAvailability(input);
  }

  async assignShift(input: CreateShiftAssignmentInput): Promise<ShiftAssignment> {
    // 1. Availability Check
    const availabilities = await this.repo.getStaffAvailability(input.tenantId, input.staffPartyId);
    
    // Determine day of week for the assignment date (1 = Monday .. 7 = Sunday)
    const dateObj = new Date(input.assignmentDate);
    const jsDay = dateObj.getDay(); // 0 = Sun, 1 = Mon ...
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const matchingAvail = availabilities.find(
      (a) => a.dayOfWeek === dayOfWeek && (!a.shiftTemplateId || a.shiftTemplateId === input.shiftTemplateId)
    );

    if (matchingAvail && !matchingAvail.isAvailable) {
      throw new Error(`STAFF_UNAVAILABLE_ERROR: Staff member ${input.staffPartyId} is marked unavailable on day ${dayOfWeek}`);
    }

    // 2. Create Assignment
    return this.repo.createShiftAssignment(input);
  }

  async amendShiftAssignment(input: AmendShiftAssignmentInput): Promise<ShiftAssignment> {
    if (!input.assignmentId || !input.newStaffPartyId || !input.amendedByPartyId) {
      throw new Error('INVALID_AMENDMENT_INPUT: assignmentId, newStaffPartyId, and amendedByPartyId required');
    }

    return this.repo.supersedeShiftAssignment(
      input.tenantId,
      input.assignmentId,
      input.newStaffPartyId,
      input.newRole
    );
  }

  async listRosterForClassroom(
    tenantId: string,
    classroomId: string,
    assignmentDate: string
  ): Promise<ShiftAssignment[]> {
    const all = await this.repo.listShiftAssignments(tenantId, {
      classroomId,
      assignmentDate,
    });
    // Return active roster assignments only (SCHEDULED or COMPLETED)
    return all.filter((a) => a.status === 'SCHEDULED' || a.status === 'COMPLETED');
  }
}
