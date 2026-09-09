/**
 * Bella Preschool OS — Preschool Scheduling Repository
 * 
 * Interacts with public.edu_sched_* tables under strict multi-tenant isolation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ShiftTemplate,
  RatioPolicy,
  StaffAvailability,
  ShiftAssignment,
  CreateShiftAssignmentInput,
  RatioComplianceSnapshot,
  CaregiverRole,
  ShiftAssignmentStatus,
  ComplianceState,
} from '../domain/scheduling.types';

export class PreschoolSchedulingRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      this.client = createClient(url, key);
    }
  }

  // --- 1. Shift Templates ---
  async createShiftTemplate(input: {
    tenantId: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
  }): Promise<ShiftTemplate> {
    const { data, error } = await this.client
      .from('edu_sched_shift_templates')
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        code: input.code,
        start_time: input.startTime,
        end_time: input.endTime,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`FAILED_TO_CREATE_SHIFT_TEMPLATE: ${error?.message}`);
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      name: data.name,
      code: data.code,
      startTime: data.start_time,
      endTime: data.end_time,
      createdAt: data.created_at,
    };
  }

  async listShiftTemplates(tenantId: string): Promise<ShiftTemplate[]> {
    const { data, error } = await this.client
      .from('edu_sched_shift_templates')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      tenantId: d.tenant_id,
      name: d.name,
      code: d.code,
      startTime: d.start_time,
      endTime: d.end_time,
      createdAt: d.created_at,
    }));
  }

  // --- 2. Ratio Policies ---
  async upsertRatioPolicy(input: {
    tenantId: string;
    ageGroup: string;
    maxChildrenPerCaregiver: number;
    minLeadTeachers?: number;
    activityContext?: string;
  }): Promise<RatioPolicy> {
    const context = input.activityContext || 'CLASSROOM_STANDARD';
    const { data, error } = await this.client
      .from('edu_sched_ratio_policies')
      .upsert(
        {
          tenant_id: input.tenantId,
          age_group: input.ageGroup,
          max_children_per_caregiver: input.maxChildrenPerCaregiver,
          min_lead_teachers: input.minLeadTeachers ?? 1,
          activity_context: context,
        },
        { onConflict: 'tenant_id,age_group,activity_context' }
      )
      .select()
      .single();

    if (error || !data) {
      throw new Error(`FAILED_TO_UPSERT_RATIO_POLICY: ${error?.message}`);
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      ageGroup: data.age_group,
      maxChildrenPerCaregiver: data.max_children_per_caregiver,
      minLeadTeachers: data.min_lead_teachers,
      activityContext: data.activity_context,
      createdAt: data.created_at,
    };
  }

  async getRatioPolicy(
    tenantId: string,
    ageGroup: string,
    activityContext = 'CLASSROOM_STANDARD'
  ): Promise<RatioPolicy | null> {
    const { data, error } = await this.client
      .from('edu_sched_ratio_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('age_group', ageGroup)
      .eq('activity_context', activityContext)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      tenantId: data.tenant_id,
      ageGroup: data.age_group,
      maxChildrenPerCaregiver: data.max_children_per_caregiver,
      minLeadTeachers: data.min_lead_teachers,
      activityContext: data.activity_context,
      createdAt: data.created_at,
    };
  }

  // --- 3. Staff Availability ---
  async setStaffAvailability(input: {
    tenantId: string;
    staffPartyId: string;
    dayOfWeek: number;
    shiftTemplateId?: string;
    isAvailable: boolean;
  }): Promise<StaffAvailability> {
    const { data, error } = await this.client
      .from('edu_sched_staff_availability')
      .insert({
        tenant_id: input.tenantId,
        staff_party_id: input.staffPartyId,
        day_of_week: input.dayOfWeek,
        shift_template_id: input.shiftTemplateId || null,
        is_available: input.isAvailable,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`FAILED_TO_SET_STAFF_AVAILABILITY: ${error?.message}`);
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      staffPartyId: data.staff_party_id,
      dayOfWeek: data.day_of_week,
      shiftTemplateId: data.shift_template_id,
      isAvailable: data.is_available,
      createdAt: data.created_at,
    };
  }

  async getStaffAvailability(tenantId: string, staffPartyId: string): Promise<StaffAvailability[]> {
    const { data, error } = await this.client
      .from('edu_sched_staff_availability')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('staff_party_id', staffPartyId);

    if (error || !data) return [];
    return data.map((d) => ({
      id: d.id,
      tenantId: d.tenant_id,
      staffPartyId: d.staff_party_id,
      dayOfWeek: d.day_of_week,
      shiftTemplateId: d.shift_template_id,
      isAvailable: d.is_available,
      createdAt: d.created_at,
    }));
  }

  // --- 4. Shift Assignments ---
  async createShiftAssignment(input: CreateShiftAssignmentInput): Promise<ShiftAssignment> {
    const { data, error } = await this.client
      .from('edu_sched_shift_assignments')
      .insert({
        tenant_id: input.tenantId,
        classroom_id: input.classroomId,
        shift_template_id: input.shiftTemplateId,
        staff_party_id: input.staffPartyId,
        role: input.role,
        assignment_date: input.assignmentDate,
        status: 'SCHEDULED',
        amendment_version: 1,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`FAILED_TO_CREATE_SHIFT_ASSIGNMENT: ${error?.message}`);
    }

    return this.mapAssignment(data);
  }

  async getShiftAssignment(tenantId: string, assignmentId: string): Promise<ShiftAssignment | null> {
    const { data, error } = await this.client
      .from('edu_sched_shift_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapAssignment(data);
  }

  async listShiftAssignments(
    tenantId: string,
    filter: { classroomId?: string; assignmentDate?: string; staffPartyId?: string }
  ): Promise<ShiftAssignment[]> {
    let query = this.client
      .from('edu_sched_shift_assignments')
      .select('*')
      .eq('tenant_id', tenantId);

    if (filter.classroomId) query = query.eq('classroom_id', filter.classroomId);
    if (filter.assignmentDate) query = query.eq('assignment_date', filter.assignmentDate);
    if (filter.staffPartyId) query = query.eq('staff_party_id', filter.staffPartyId);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((d) => this.mapAssignment(d));
  }

  async supersedeShiftAssignment(
    tenantId: string,
    existingAssignmentId: string,
    newStaffPartyId: string,
    newRole?: CaregiverRole
  ): Promise<ShiftAssignment> {
    // 1. Fetch current assignment
    const existing = await this.getShiftAssignment(tenantId, existingAssignmentId);
    if (!existing) throw new Error('EXISTING_ASSIGNMENT_NOT_FOUND');

    // 2. Mark existing assignment as REPLACED
    await this.client
      .from('edu_sched_shift_assignments')
      .update({ status: 'REPLACED', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', existingAssignmentId);

    // 3. Create new assignment version with incremented version & superseded_assignment_id pointer
    const { data, error } = await this.client
      .from('edu_sched_shift_assignments')
      .insert({
        tenant_id: tenantId,
        classroom_id: existing.classroomId,
        shift_template_id: existing.shiftTemplateId,
        staff_party_id: newStaffPartyId,
        role: newRole || existing.role,
        assignment_date: existing.assignmentDate,
        status: 'SCHEDULED',
        amendment_version: existing.amendmentVersion + 1,
        superseded_assignment_id: existingAssignmentId,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`FAILED_TO_AMEND_SHIFT_ASSIGNMENT: ${error?.message}`);
    }

    return this.mapAssignment(data);
  }

  async updateShiftAssignmentStatus(
    tenantId: string,
    assignmentId: string,
    status: ShiftAssignmentStatus
  ): Promise<ShiftAssignment> {
    const { data, error } = await this.client
      .from('edu_sched_shift_assignments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`FAILED_TO_UPDATE_SHIFT_STATUS: ${error?.message}`);
    }

    return this.mapAssignment(data);
  }

  // --- 5. Compliance Snapshots ---
  async createComplianceSnapshot(input: {
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
  }): Promise<RatioComplianceSnapshot> {
    const { data, error } = await this.client
      .from('edu_sched_compliance_snapshots')
      .insert({
        tenant_id: input.tenantId,
        classroom_id: input.classroomId,
        snapshot_date: input.snapshotDate,
        shift_template_id: input.shiftTemplateId,
        enrolled_children: input.enrolledChildren,
        expected_children: input.expectedChildren,
        present_children: input.presentChildren,
        assigned_caregivers: input.assignedCaregivers,
        required_caregivers: input.requiredCaregivers,
        compliance_state: input.complianceState,
        shortage_count: input.shortageCount,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`FAILED_TO_CREATE_COMPLIANCE_SNAPSHOT: ${error?.message}`);
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      classroomId: data.classroom_id,
      snapshotDate: data.snapshot_date,
      shiftTemplateId: data.shift_template_id,
      enrolledChildren: data.enrolled_children,
      expectedChildren: data.expected_children,
      presentChildren: data.present_children,
      assignedCaregivers: data.assigned_caregivers,
      requiredCaregivers: data.required_caregivers,
      complianceState: data.compliance_state as ComplianceState,
      shortageCount: data.shortage_count,
      createdAt: data.created_at,
    };
  }

  async getLatestComplianceSnapshot(
    tenantId: string,
    classroomId: string,
    snapshotDate: string
  ): Promise<RatioComplianceSnapshot | null> {
    const { data, error } = await this.client
      .from('edu_sched_compliance_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('classroom_id', classroomId)
      .eq('snapshot_date', snapshotDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      tenantId: data.tenant_id,
      classroomId: data.classroom_id,
      snapshotDate: data.snapshot_date,
      shiftTemplateId: data.shift_template_id,
      enrolledChildren: data.enrolled_children,
      expectedChildren: data.expected_children,
      presentChildren: data.present_children,
      assignedCaregivers: data.assigned_caregivers,
      requiredCaregivers: data.required_caregivers,
      complianceState: data.compliance_state as ComplianceState,
      shortageCount: data.shortage_count,
      createdAt: data.created_at,
    };
  }

  private mapAssignment(data: any): ShiftAssignment {
    return {
      id: data.id,
      tenantId: data.tenant_id,
      classroomId: data.classroom_id,
      shiftTemplateId: data.shift_template_id,
      staffPartyId: data.staff_party_id,
      role: data.role as CaregiverRole,
      assignmentDate: data.assignment_date,
      status: data.status as ShiftAssignmentStatus,
      amendmentVersion: data.amendment_version,
      supersededAssignmentId: data.superseded_assignment_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
