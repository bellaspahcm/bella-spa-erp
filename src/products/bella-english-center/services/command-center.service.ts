/**
 * E9 - English Center Chain Command Center Service
 */

import type { IOrgUnitContract, OrgUnit } from '@/platform/org-unit';
import {
  ChainCommandCenterDashboard,
  ChainCommandCenterInput,
  CommandCenterBranch,
  CommandCenterBranchKpi,
  CommandCenterEngagementRecipientRow,
  CommandCenterOperationalRows,
  CommandCenterRiskThresholds,
  CommandCenterTotals,
  CommandCenterWorkQueueItem,
} from '../types/command-center.types';

const DEFAULT_THRESHOLDS: CommandCenterRiskThresholds = {
  attendanceRateWarning: 0.85,
  attendanceRateCritical: 0.75,
  teacherLoadWarningSessions: 8,
  overdueInvoiceWarning: 1,
};

export interface ChainCommandCenterRepositoryContract {
  loadOperationalRows(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterOperationalRows>;
}

export interface ChainCommandCenterContracts {
  readonly orgUnits: Pick<IOrgUnitContract, 'getHierarchy' | 'getOrgUnits'>;
}

interface BranchAccumulator {
  activeEnrollments: number;
  activeClasses: number;
  teacherIds: Set<string>;
  scheduledSessions: number;
  completedSessions: number;
  teacherSessionCounts: Map<string, number>;
  attendanceRecords: number;
  attendancePresent: number;
  attendanceRiskEnrollmentIds: Set<string>;
  needsSupportEnrollmentIds: Set<string>;
  outstandingTuitionMinor: bigint;
  overdueInvoiceCount: number;
  engagementMessages: number;
  pendingAcknowledgements: number;
  failedDeliveries: number;
}

export class ChainCommandCenterService {
  constructor(
    private readonly repository: ChainCommandCenterRepositoryContract,
    private readonly contracts: ChainCommandCenterContracts
  ) {}

  async getDashboard(
    tenantId: string,
    input: ChainCommandCenterInput = {}
  ): Promise<ChainCommandCenterDashboard> {
    this.assertTenant(tenantId);

    const asOf = input.asOf || new Date().toISOString();
    const thresholds = { ...DEFAULT_THRESHOLDS, ...(input.thresholds || {}) };
    const branches = await this.resolveBranches(tenantId, input);
    const branchIds = input.branchIds && input.branchIds.length > 0
      ? [...input.branchIds]
      : branches.map((branch) => branch.id);

    const rows = await this.repository.loadOperationalRows({
      tenantId,
      branchIds,
      asOf,
    });

    const branchKpis = this.buildBranchKpis(branches, rows, thresholds, asOf);
    const workQueue = this.buildWorkQueue(branchKpis, thresholds, asOf);

    return {
      tenantId,
      asOf,
      branches: branchKpis,
      totals: this.buildTotals(branchKpis),
      workQueue,
    };
  }

  private async resolveBranches(
    tenantId: string,
    input: ChainCommandCenterInput
  ): Promise<CommandCenterBranch[]> {
    const orgUnits = input.rootOrgUnitId !== undefined
      ? (await this.contracts.orgUnits.getHierarchy(input.rootOrgUnitId, tenantId))
        .map((item) => item.unit)
      : await this.contracts.orgUnits.getOrgUnits({
        tenantId,
        unitType: 'branch',
        isActive: true,
      });

    const requested = new Set(input.branchIds || []);
    return orgUnits
      .filter((unit) => unit.unitType === 'branch')
      .filter((unit) => unit.isActive)
      .filter((unit) => requested.size === 0 || requested.has(unit.id))
      .map((unit) => this.mapBranch(unit));
  }

  private mapBranch(unit: OrgUnit): CommandCenterBranch {
    return {
      id: unit.id,
      tenantId: unit.tenantId,
      code: unit.code || unit.id,
      name: unit.name,
      parentId: unit.parentId || null,
      isActive: unit.isActive,
    };
  }

  private buildBranchKpis(
    branches: readonly CommandCenterBranch[],
    rows: CommandCenterOperationalRows,
    thresholds: CommandCenterRiskThresholds,
    asOf: string
  ): CommandCenterBranchKpi[] {
    const byBranch = new Map<string, BranchAccumulator>();
    const messageBranch = new Map<string, string>();

    for (const branch of branches) {
      byBranch.set(branch.id, this.emptyAccumulator());
    }

    for (const enrollment of rows.enrollments) {
      const branch = byBranch.get(enrollment.branch_id);
      if (branch) branch.activeEnrollments += 1;
    }

    for (const klass of rows.classes) {
      const branch = byBranch.get(klass.branch_id);
      if (!branch || klass.status !== 'active') continue;
      branch.activeClasses += 1;
      if (klass.teacher_id) branch.teacherIds.add(klass.teacher_id);
    }

    for (const teacherBranch of rows.teacherBranches) {
      const branch = byBranch.get(teacherBranch.branch_id);
      if (!branch || teacherBranch.status !== 'active') continue;
      branch.teacherIds.add(teacherBranch.teacher_id);
    }

    for (const session of rows.sessions) {
      const branch = byBranch.get(session.branch_id);
      if (!branch || session.status === 'cancelled') continue;
      branch.scheduledSessions += 1;
      if (session.status === 'completed') branch.completedSessions += 1;
      if (session.teacher_id) {
        branch.teacherSessionCounts.set(
          session.teacher_id,
          (branch.teacherSessionCounts.get(session.teacher_id) || 0) + 1
        );
      }
    }

    const absentCounts = new Map<string, number>();
    for (const attendance of rows.attendance) {
      const branch = byBranch.get(attendance.branch_id);
      if (!branch) continue;
      branch.attendanceRecords += 1;
      if (attendance.status === 'present') branch.attendancePresent += 1;
      if (attendance.status === 'absent') {
        const count = (absentCounts.get(attendance.english_enrollment_id) || 0) + 1;
        absentCounts.set(attendance.english_enrollment_id, count);
        if (count >= 2) branch.attendanceRiskEnrollmentIds.add(attendance.english_enrollment_id);
      }
    }

    for (const progress of rows.progress) {
      const branch = byBranch.get(progress.branch_id);
      if (branch && progress.progress_label === 'needs_support') {
        branch.needsSupportEnrollmentIds.add(progress.english_enrollment_id);
      }
    }

    for (const invoice of rows.invoices) {
      const branch = byBranch.get(invoice.branch_id);
      if (!branch || invoice.settlement_status === 'paid') continue;
      branch.outstandingTuitionMinor += BigInt(invoice.outstanding_amount_minor);
      if (invoice.due_date < asOf.slice(0, 10)) branch.overdueInvoiceCount += 1;
    }

    for (const message of rows.engagementMessages) {
      const branch = byBranch.get(message.branch_id);
      if (!branch) continue;
      messageBranch.set(message.id, message.branch_id);
      branch.engagementMessages += 1;
      if (message.acknowledgement_status === 'pending') {
        branch.pendingAcknowledgements += 1;
      }
    }

    for (const recipient of rows.engagementRecipients) {
      this.applyRecipientDelivery(byBranch, messageBranch, recipient);
    }

    return branches.map((branch) => {
      const metrics = byBranch.get(branch.id) || this.emptyAccumulator();
      const attendanceRate = this.rate(metrics.attendancePresent, metrics.attendanceRecords);
      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        activeEnrollments: metrics.activeEnrollments,
        activeClasses: metrics.activeClasses,
        teacherCount: metrics.teacherIds.size,
        scheduledSessions: metrics.scheduledSessions,
        completedSessions: metrics.completedSessions,
        scheduleHealthRate: this.rate(metrics.completedSessions, metrics.scheduledSessions),
        teacherLoad: this.maxMapValue(metrics.teacherSessionCounts),
        attendanceRecords: metrics.attendanceRecords,
        attendancePresent: metrics.attendancePresent,
        attendanceRate,
        attendanceRiskCount: attendanceRate < thresholds.attendanceRateWarning
          ? metrics.attendanceRiskEnrollmentIds.size
          : 0,
        learningSupportCount: metrics.needsSupportEnrollmentIds.size,
        outstandingTuitionMinor: metrics.outstandingTuitionMinor.toString(),
        overdueInvoiceCount: metrics.overdueInvoiceCount,
        engagementMessages: metrics.engagementMessages,
        pendingAcknowledgements: metrics.pendingAcknowledgements,
        failedDeliveries: metrics.failedDeliveries,
      };
    });
  }

  private applyRecipientDelivery(
    byBranch: Map<string, BranchAccumulator>,
    messageBranch: Map<string, string>,
    recipient: CommandCenterEngagementRecipientRow
  ): void {
    if (recipient.delivery_status !== 'failed') return;
    const branchId = messageBranch.get(recipient.message_id);
    if (!branchId) return;
    const branch = byBranch.get(branchId);
    if (branch) branch.failedDeliveries += 1;
  }

  private buildTotals(branches: readonly CommandCenterBranchKpi[]): CommandCenterTotals {
    const attendancePresent = branches.reduce((sum, branch) => sum + branch.attendancePresent, 0);
    const attendanceRecords = branches.reduce((sum, branch) => sum + branch.attendanceRecords, 0);
    const outstanding = branches.reduce(
      (sum, branch) => sum + BigInt(branch.outstandingTuitionMinor),
      BigInt(0)
    );

    return {
      branchCount: branches.length,
      activeEnrollments: this.sum(branches, 'activeEnrollments'),
      activeClasses: this.sum(branches, 'activeClasses'),
      teacherCount: this.sum(branches, 'teacherCount'),
      scheduledSessions: this.sum(branches, 'scheduledSessions'),
      completedSessions: this.sum(branches, 'completedSessions'),
      attendanceRate: this.rate(attendancePresent, attendanceRecords),
      attendanceRiskCount: this.sum(branches, 'attendanceRiskCount'),
      learningSupportCount: this.sum(branches, 'learningSupportCount'),
      outstandingTuitionMinor: outstanding.toString(),
      overdueInvoiceCount: this.sum(branches, 'overdueInvoiceCount'),
      pendingAcknowledgements: this.sum(branches, 'pendingAcknowledgements'),
      failedDeliveries: this.sum(branches, 'failedDeliveries'),
    };
  }

  private buildWorkQueue(
    branches: readonly CommandCenterBranchKpi[],
    thresholds: CommandCenterRiskThresholds,
    asOf: string
  ): CommandCenterWorkQueueItem[] {
    return branches.flatMap((branch) => {
      const items: CommandCenterWorkQueueItem[] = [];
      if (branch.attendanceRiskCount > 0) {
        items.push(this.queueItem(branch, 'attendance_risk', 'high', 'attendance', branch.branchId,
          'Attendance risk follow-up',
          'Branch has repeated absences and attendance rate below warning threshold.',
          branch.attendanceRate,
          asOf));
      }
      if (branch.learningSupportCount > 0) {
        items.push(this.queueItem(branch, 'learning_support', 'medium', 'learning_progress', branch.branchId,
          'Learning support review',
          'Students are marked as needing support in recent progress records.',
          branch.learningSupportCount,
          asOf));
      }
      if (branch.overdueInvoiceCount >= thresholds.overdueInvoiceWarning) {
        items.push(this.queueItem(branch, 'tuition_overdue', 'high', 'tuition_invoice', branch.branchId,
          'Overdue tuition follow-up',
          'Branch has unpaid or partially paid invoices past due date.',
          branch.overdueInvoiceCount,
          asOf));
      }
      if (branch.pendingAcknowledgements > 0 || branch.failedDeliveries > 0) {
        items.push(this.queueItem(branch, 'engagement_follow_up', 'medium', 'engagement_message', branch.branchId,
          'Engagement follow-up',
          'Branch has pending acknowledgements or failed delivery attempts.',
          branch.pendingAcknowledgements + branch.failedDeliveries,
          asOf));
      }
      if (branch.teacherLoad >= thresholds.teacherLoadWarningSessions) {
        items.push(this.queueItem(branch, 'teacher_load', 'medium', 'class_session', branch.branchId,
          'Teacher load review',
          'At least one teacher is above the configured scheduled-session load threshold.',
          branch.teacherLoad,
          asOf));
      }
      return items;
    });
  }

  private queueItem(
    branch: CommandCenterBranchKpi,
    type: CommandCenterWorkQueueItem['type'],
    severity: CommandCenterWorkQueueItem['severity'],
    sourceType: string,
    sourceId: string,
    title: string,
    reason: string,
    metric: number | string,
    createdAt: string
  ): CommandCenterWorkQueueItem {
    return {
      id: `${type}:${branch.branchId}`,
      type,
      severity,
      branchId: branch.branchId,
      branchName: branch.branchName,
      sourceType,
      sourceId,
      title,
      reason,
      metric,
      createdAt,
    };
  }

  private emptyAccumulator(): BranchAccumulator {
    return {
      activeEnrollments: 0,
      activeClasses: 0,
      teacherIds: new Set(),
      scheduledSessions: 0,
      completedSessions: 0,
      teacherSessionCounts: new Map(),
      attendanceRecords: 0,
      attendancePresent: 0,
      attendanceRiskEnrollmentIds: new Set(),
      needsSupportEnrollmentIds: new Set(),
      outstandingTuitionMinor: BigInt(0),
      overdueInvoiceCount: 0,
      engagementMessages: 0,
      pendingAcknowledgements: 0,
      failedDeliveries: 0,
    };
  }

  private sum(
    branches: readonly CommandCenterBranchKpi[],
    key: keyof Pick<
      CommandCenterBranchKpi,
      | 'activeEnrollments'
      | 'activeClasses'
      | 'teacherCount'
      | 'scheduledSessions'
      | 'completedSessions'
      | 'attendanceRiskCount'
      | 'learningSupportCount'
      | 'overdueInvoiceCount'
      | 'pendingAcknowledgements'
      | 'failedDeliveries'
    >
  ): number {
    return branches.reduce((total, branch) => total + branch[key], 0);
  }

  private rate(numerator: number, denominator: number): number {
    if (denominator === 0) return 1;
    return Number((numerator / denominator).toFixed(4));
  }

  private maxMapValue(map: ReadonlyMap<string, number>): number {
    return [...map.values()].reduce((max, value) => Math.max(max, value), 0);
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId.trim()) {
      throw new Error('TENANT_REQUIRED');
    }
  }
}
