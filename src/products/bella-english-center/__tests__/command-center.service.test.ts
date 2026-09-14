/**
 * E9 - English Center Chain Command Center Service Tests
 */

import type { IOrgUnitContract, OrgUnit, OrgUnitHierarchy } from '@/platform/org-unit';
import { ChainCommandCenterRepositoryContract, ChainCommandCenterService } from '../services/command-center.service';
import { CommandCenterOperationalRows } from '../types/command-center.types';

const TENANT_ID = 'tenant-english';
const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const AS_OF = '2026-09-14T12:00:00.000Z';

function makeOrgUnit(id: string, name: string, code: string): OrgUnit {
  return {
    id,
    tenantId: TENANT_ID,
    unitType: 'branch',
    name,
    code,
    parentId: 'region-1',
    isActive: true,
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function emptyRows(): CommandCenterOperationalRows {
  return {
    enrollments: [],
    classes: [],
    teacherBranches: [],
    sessions: [],
    attendance: [],
    progress: [],
    invoices: [],
    engagementMessages: [],
    engagementRecipients: [],
  };
}

function makeRows(): CommandCenterOperationalRows {
  return {
    enrollments: [
      { id: 'enr-1', tenant_id: TENANT_ID, branch_id: BRANCH_A, class_id: 'class-a', created_at: AS_OF },
      { id: 'enr-2', tenant_id: TENANT_ID, branch_id: BRANCH_A, class_id: 'class-a', created_at: AS_OF },
      { id: 'enr-3', tenant_id: TENANT_ID, branch_id: BRANCH_B, class_id: 'class-b', created_at: AS_OF },
    ],
    classes: [
      {
        id: 'class-a',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        teacher_id: 'teacher-a',
        capacity: 12,
        enrolled_count: 2,
        status: 'active',
        created_at: AS_OF,
      },
      {
        id: 'class-b',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_B,
        teacher_id: 'teacher-b',
        capacity: 10,
        enrolled_count: 1,
        status: 'active',
        created_at: AS_OF,
      },
    ],
    teacherBranches: [
      { id: 'tb-a', tenant_id: TENANT_ID, teacher_id: 'teacher-a', branch_id: BRANCH_A, status: 'active' },
      { id: 'tb-b', tenant_id: TENANT_ID, teacher_id: 'teacher-b', branch_id: BRANCH_B, status: 'active' },
    ],
    sessions: [
      {
        id: 'session-a1',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        class_id: 'class-a',
        teacher_id: 'teacher-a',
        status: 'completed',
        starts_at: '2026-09-13T09:00:00.000Z',
        ends_at: '2026-09-13T10:00:00.000Z',
      },
      {
        id: 'session-a2',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        class_id: 'class-a',
        teacher_id: 'teacher-a',
        status: 'scheduled',
        starts_at: '2026-09-14T09:00:00.000Z',
        ends_at: '2026-09-14T10:00:00.000Z',
      },
      {
        id: 'session-b1',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_B,
        class_id: 'class-b',
        teacher_id: 'teacher-b',
        status: 'completed',
        starts_at: '2026-09-13T09:00:00.000Z',
        ends_at: '2026-09-13T10:00:00.000Z',
      },
    ],
    attendance: [
      {
        id: 'att-a1',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        english_enrollment_id: 'enr-1',
        status: 'absent',
        recorded_at: AS_OF,
      },
      {
        id: 'att-a2',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        english_enrollment_id: 'enr-1',
        status: 'absent',
        recorded_at: AS_OF,
      },
      {
        id: 'att-a3',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        english_enrollment_id: 'enr-2',
        status: 'present',
        recorded_at: AS_OF,
      },
      {
        id: 'att-b1',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_B,
        english_enrollment_id: 'enr-3',
        status: 'present',
        recorded_at: AS_OF,
      },
    ],
    progress: [
      {
        id: 'prog-a',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        english_enrollment_id: 'enr-2',
        progress_label: 'needs_support',
        recorded_at: AS_OF,
      },
    ],
    invoices: [
      {
        id: 'inv-a',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        settlement_status: 'unpaid',
        outstanding_amount_minor: '1200000',
        due_date: '2026-09-01',
        created_at: AS_OF,
      },
      {
        id: 'inv-b',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_B,
        settlement_status: 'paid',
        outstanding_amount_minor: '0',
        due_date: '2026-09-01',
        created_at: AS_OF,
      },
    ],
    engagementMessages: [
      {
        id: 'msg-a',
        tenant_id: TENANT_ID,
        branch_id: BRANCH_A,
        acknowledgement_status: 'pending',
        created_at: AS_OF,
      },
    ],
    engagementRecipients: [
      {
        id: 'rec-a',
        tenant_id: TENANT_ID,
        message_id: 'msg-a',
        delivery_status: 'failed',
        created_at: AS_OF,
      },
    ],
  };
}

function makeService(rows: CommandCenterOperationalRows = makeRows()) {
  const repository: jest.Mocked<ChainCommandCenterRepositoryContract> = {
    loadOperationalRows: jest.fn().mockResolvedValue(rows),
  };

  const orgUnits: Pick<IOrgUnitContract, 'getHierarchy' | 'getOrgUnits'> = {
    getHierarchy: jest.fn().mockResolvedValue([
      { unit: makeOrgUnit(BRANCH_A, 'District 1', 'D1'), depth: 1, path: ['region-1', BRANCH_A], pathNames: ['Region', 'District 1'] },
      { unit: makeOrgUnit(BRANCH_B, 'District 7', 'D7'), depth: 1, path: ['region-1', BRANCH_B], pathNames: ['Region', 'District 7'] },
    ] satisfies OrgUnitHierarchy[]),
    getOrgUnits: jest.fn().mockResolvedValue([
      makeOrgUnit(BRANCH_A, 'District 1', 'D1'),
      makeOrgUnit(BRANCH_B, 'District 7', 'D7'),
    ]),
  };

  return {
    repository,
    orgUnits,
    service: new ChainCommandCenterService(repository, { orgUnits }),
  };
}

describe('ChainCommandCenterService', () => {
  it('builds tenant-scoped branch rollups from Platform org hierarchy and E2-E8 projections', async () => {
    const { service } = makeService();

    const dashboard = await service.getDashboard(TENANT_ID, { rootOrgUnitId: 'region-1', asOf: AS_OF });

    expect(dashboard.tenantId).toBe(TENANT_ID);
    expect(dashboard.branches).toHaveLength(2);
    expect(dashboard.branches[0]).toMatchObject({
      branchId: BRANCH_A,
      activeEnrollments: 2,
      activeClasses: 1,
      teacherCount: 1,
      scheduledSessions: 2,
      completedSessions: 1,
      attendanceRecords: 3,
      attendancePresent: 1,
      attendanceRate: 0.3333,
      learningSupportCount: 1,
      outstandingTuitionMinor: '1200000',
      overdueInvoiceCount: 1,
      pendingAcknowledgements: 1,
      failedDeliveries: 1,
    });
  });

  it('passes tenant, branch scope, and as-of timestamp to the read-only repository', async () => {
    const { service, repository } = makeService();

    await service.getDashboard(TENANT_ID, {
      branchIds: [BRANCH_A],
      asOf: AS_OF,
    });

    expect(repository.loadOperationalRows).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      branchIds: [BRANCH_A],
      asOf: AS_OF,
    });
  });

  it('filters requested branches after resolving Platform branch access', async () => {
    const { service } = makeService();

    const dashboard = await service.getDashboard(TENANT_ID, {
      branchIds: [BRANCH_B],
      asOf: AS_OF,
    });

    expect(dashboard.branches).toHaveLength(1);
    expect(dashboard.branches[0].branchId).toBe(BRANCH_B);
  });

  it('generates read-model work queue items without mutating operational records', async () => {
    const { service, repository } = makeService();

    const dashboard = await service.getDashboard(TENANT_ID, { asOf: AS_OF });

    expect(repository.loadOperationalRows).toHaveBeenCalledTimes(1);
    expect(dashboard.workQueue.map((item) => item.type)).toEqual([
      'attendance_risk',
      'learning_support',
      'tuition_overdue',
      'engagement_follow_up',
    ]);
  });

  it('totals reconcile branch metrics across the chain', async () => {
    const { service } = makeService();

    const dashboard = await service.getDashboard(TENANT_ID, { asOf: AS_OF });

    expect(dashboard.totals).toMatchObject({
      branchCount: 2,
      activeEnrollments: 3,
      activeClasses: 2,
      teacherCount: 2,
      scheduledSessions: 3,
      completedSessions: 2,
      attendanceRate: 0.5,
      attendanceRiskCount: 1,
      learningSupportCount: 1,
      outstandingTuitionMinor: '1200000',
      overdueInvoiceCount: 1,
      pendingAcknowledgements: 1,
      failedDeliveries: 1,
    });
  });

  it('keeps financial dashboard numbers sourced from E7 tuition projection rows', async () => {
    const { service } = makeService();

    const dashboard = await service.getDashboard(TENANT_ID, { asOf: AS_OF });
    const districtOne = dashboard.branches.find((branch) => branch.branchId === BRANCH_A);

    expect(districtOne?.outstandingTuitionMinor).toBe('1200000');
    expect(districtOne?.overdueInvoiceCount).toBe(1);
  });

  it('rejects missing tenant scope before any dashboard read', async () => {
    const { service, repository } = makeService(emptyRows());

    await expect(service.getDashboard('   ', { asOf: AS_OF })).rejects.toThrow('TENANT_REQUIRED');
    expect(repository.loadOperationalRows).not.toHaveBeenCalled();
  });
});
