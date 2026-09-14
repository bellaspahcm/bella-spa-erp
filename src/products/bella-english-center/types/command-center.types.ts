/**
 * E9 - English Center Chain Command Center Types
 */

export type CommandCenterWorkQueueType =
  | 'attendance_risk'
  | 'learning_support'
  | 'tuition_overdue'
  | 'engagement_follow_up'
  | 'schedule_health'
  | 'teacher_load';

export type CommandCenterSeverity = 'low' | 'medium' | 'high';

export interface CommandCenterRiskThresholds {
  readonly attendanceRateWarning: number;
  readonly attendanceRateCritical: number;
  readonly teacherLoadWarningSessions: number;
  readonly overdueInvoiceWarning: number;
}

export interface ChainCommandCenterInput {
  readonly rootOrgUnitId?: string | null;
  readonly branchIds?: readonly string[];
  readonly asOf?: string;
  readonly thresholds?: Partial<CommandCenterRiskThresholds>;
}

export interface CommandCenterBranch {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly isActive: boolean;
}

export interface CommandCenterBranchKpi {
  readonly branchId: string;
  readonly branchCode: string;
  readonly branchName: string;
  readonly activeEnrollments: number;
  readonly activeClasses: number;
  readonly teacherCount: number;
  readonly scheduledSessions: number;
  readonly completedSessions: number;
  readonly scheduleHealthRate: number;
  readonly teacherLoad: number;
  readonly attendanceRecords: number;
  readonly attendancePresent: number;
  readonly attendanceRate: number;
  readonly attendanceRiskCount: number;
  readonly learningSupportCount: number;
  readonly outstandingTuitionMinor: string;
  readonly overdueInvoiceCount: number;
  readonly engagementMessages: number;
  readonly pendingAcknowledgements: number;
  readonly failedDeliveries: number;
}

export interface CommandCenterTotals {
  readonly branchCount: number;
  readonly activeEnrollments: number;
  readonly activeClasses: number;
  readonly teacherCount: number;
  readonly scheduledSessions: number;
  readonly completedSessions: number;
  readonly attendanceRate: number;
  readonly attendanceRiskCount: number;
  readonly learningSupportCount: number;
  readonly outstandingTuitionMinor: string;
  readonly overdueInvoiceCount: number;
  readonly pendingAcknowledgements: number;
  readonly failedDeliveries: number;
}

export interface CommandCenterWorkQueueItem {
  readonly id: string;
  readonly type: CommandCenterWorkQueueType;
  readonly severity: CommandCenterSeverity;
  readonly branchId: string;
  readonly branchName: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly title: string;
  readonly reason: string;
  readonly metric: number | string;
  readonly createdAt: string;
}

export interface ChainCommandCenterDashboard {
  readonly tenantId: string;
  readonly asOf: string;
  readonly branches: readonly CommandCenterBranchKpi[];
  readonly totals: CommandCenterTotals;
  readonly workQueue: readonly CommandCenterWorkQueueItem[];
}

export interface CommandCenterOperationalRows {
  readonly enrollments: readonly CommandCenterEnrollmentRow[];
  readonly classes: readonly CommandCenterClassRow[];
  readonly teacherBranches: readonly CommandCenterTeacherBranchRow[];
  readonly sessions: readonly CommandCenterSessionRow[];
  readonly attendance: readonly CommandCenterAttendanceRow[];
  readonly progress: readonly CommandCenterProgressRow[];
  readonly invoices: readonly CommandCenterInvoiceRow[];
  readonly engagementMessages: readonly CommandCenterEngagementMessageRow[];
  readonly engagementRecipients: readonly CommandCenterEngagementRecipientRow[];
}

export interface CommandCenterEnrollmentRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  class_id: string | null;
  created_at: string;
}

export interface CommandCenterClassRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  teacher_id: string | null;
  capacity: number;
  enrolled_count: number;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface CommandCenterTeacherBranchRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  branch_id: string;
  status: string;
}

export interface CommandCenterSessionRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  class_id: string;
  teacher_id: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  starts_at: string;
  ends_at: string;
}

export interface CommandCenterAttendanceRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  english_enrollment_id: string;
  status: 'present' | 'absent' | 'excused';
  recorded_at: string;
}

export interface CommandCenterProgressRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  english_enrollment_id: string;
  progress_label: 'needs_support' | 'on_track' | 'strong' | 'excellent';
  recorded_at: string;
}

export interface CommandCenterInvoiceRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  settlement_status: 'unpaid' | 'partially_paid' | 'paid' | 'overpaid';
  outstanding_amount_minor: string;
  due_date: string;
  created_at: string;
}

export interface CommandCenterEngagementMessageRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  acknowledgement_status: 'not_required' | 'pending' | 'acknowledged' | 'declined';
  created_at: string;
}

export interface CommandCenterEngagementRecipientRow {
  id: string;
  tenant_id: string;
  message_id: string;
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';
  created_at: string;
}
