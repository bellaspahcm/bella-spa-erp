/**
 * Bella Preschool OS — Phase P8 Staff Scheduling & Shift Management Types
 */

export type ShiftCode = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';
export type CaregiverRole = 'LEAD_TEACHER' | 'ASSISTANT_TEACHER' | 'CAREGIVER';
export type ShiftAssignmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'REPLACED';
export type LeaveType = 'SICK_LEAVE' | 'ANNUAL_LEAVE' | 'EMERGENCY_LEAVE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ComplianceState = 'COMPLIANT' | 'SHORTAGE_VIOLATION';
export type AgeGroup = 'TODDLER' | 'NURSERY' | 'KINDERGARTEN';

export interface ShiftTemplate {
  id: string;
  tenantId: string;
  name: string;
  code: ShiftCode | string;
  startTime: string; // HH:mm:ss
  endTime: string;   // HH:mm:ss
  createdAt: string;
}

export interface RatioPolicy {
  id: string;
  tenantId: string;
  ageGroup: AgeGroup | string;
  maxChildrenPerCaregiver: number;
  minLeadTeachers: number;
  activityContext: string;
  createdAt: string;
}

export interface StaffAvailability {
  id: string;
  tenantId: string;
  staffPartyId: string;
  dayOfWeek: number; // 1 = Monday .. 7 = Sunday
  shiftTemplateId?: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface ShiftAssignment {
  id: string;
  tenantId: string;
  classroomId: string;
  shiftTemplateId: string;
  staffPartyId: string;
  role: CaregiverRole;
  assignmentDate: string; // YYYY-MM-DD
  status: ShiftAssignmentStatus;
  amendmentVersion: number;
  supersededAssignmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftAssignmentInput {
  tenantId: string;
  classroomId: string;
  shiftTemplateId: string;
  staffPartyId: string;
  role: CaregiverRole;
  assignmentDate: string;
}

export interface AmendShiftAssignmentInput {
  tenantId: string;
  assignmentId: string;
  newStaffPartyId: string;
  newRole?: CaregiverRole;
  reason?: string;
  amendedByPartyId: string;
}

export interface StudentCountsContract {
  enrolledChildren: number;
  expectedChildren: number;
  presentChildren: number;
}

export interface ComplianceCalculationInput {
  tenantId: string;
  classroomId: string;
  snapshotDate: string;
  shiftTemplateId: string;
  counts: StudentCountsContract;
  activityContext?: string;
}

export interface RatioComplianceSnapshot {
  id: string;
  tenantId: string;
  classroomId: string;
  snapshotDate: string;
  shiftTemplateId: string;
  enrolledChildren: number;
  expectedChildren: number;
  presentChildren: number;
  assignedCaregivers: number;
  requiredCaregivers: number;
  complianceState: ComplianceState;
  shortageCount: number;
  createdAt: string;
}
