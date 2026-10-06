import { describe, expect, it } from '@jest/globals';
import { PreschoolAnalyticsService } from '../analytics/services/preschool-analytics.service';
import type { PreschoolAnalyticsRepository } from '../analytics/repositories/preschool-analytics.repository';

const tenantId = 'tenant-a';

function makeRepoStub(): PreschoolAnalyticsRepository {
  return {
    async getEnrollmentRawData(inputTenantId: string) {
      expect(inputTenantId).toBe(tenantId);
      return {
        enrolledStudents: [
          { id: 'enrollment-a', course_id: 'course-a', student_party_id: 'student-a', status: 'active' },
          { id: 'enrollment-b', course_id: 'course-a', student_party_id: 'student-b', status: 'pending' },
        ],
        classrooms: [
          { id: 'course-a', name: 'Canonical Course A', max_capacity: 10 },
        ],
      };
    },
    async getAttendanceRawData(inputTenantId: string, date: string) {
      expect(inputTenantId).toBe(tenantId);
      expect(date).toBe('2026-10-06');
      return [
        { id: 'attendance-a', enrollment_id: 'enrollment-a', attendance_status: 'present', record_date: date },
        { id: 'attendance-b', enrollment_id: 'enrollment-b', attendance_status: 'absent', record_date: date },
      ];
    },
    async getCareSafetyRawData() {
      return { activeIncidents: [], pendingMedications: [] };
    },
    async getLearningRawData() {
      return { draftPortfolios: [], pendingObservations: [] };
    },
    async getParentEngagementRawData() {
      return [];
    },
    async getFinanceRawData() {
      return {
        invoices: [{ gross_amount: 5000000, settlement_status: 'UNPAID', due_date: '2026-10-01' }],
        reconciliations: [{ allocated_amount: 2000000 }],
      };
    },
    async getWorkforceRawData() {
      return { activeViolations: [], openExceptions: [] };
    },
    async getFacilitiesRawData() {
      return {
        unhealthyAssets: [],
        unhealthyZones: [],
        overdueSchedules: [],
        safetyExceptions: [],
      };
    },
  } as unknown as PreschoolAnalyticsRepository;
}

describe('Preschool analytics canonical read-back service', () => {
  it('computes executive metrics from canonical enrollment course_id and daily attendance state status', async () => {
    const dashboard = await new PreschoolAnalyticsService(makeRepoStub()).getExecutiveDashboard(
      tenantId,
      '2026-10-06',
    );

    expect(dashboard.enrollment.totalEnrolledStudents).toBe(2);
    expect(dashboard.enrollment.classroomUtilization).toEqual([expect.objectContaining({
      classId: 'course-a',
      currentEnrollment: 2,
      utilizationRate: 20,
    })]);
    expect(dashboard.attendance).toMatchObject({
      todayPresentCount: 1,
      todayAbsentCount: 1,
      todayLateCount: 0,
      presentVsEnrolledRate: 50,
    });
    expect(dashboard.finance).toMatchObject({
      invoicedGrossTotal: 5000000,
      reconciledCashCollected: 2000000,
      outstandingBalanceTotal: 3000000,
      overdueAccountsCount: 1,
    });
  });
});
