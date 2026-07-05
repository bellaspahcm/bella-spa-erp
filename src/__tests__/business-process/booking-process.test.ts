/**
 * Booking Process Tests
 * 
 * Tests that prove Booking Process works using the same
 * Decision Engine as Payroll Process.
 * 
 * This is part of Universal Business Process Demo.
 */

import { BookingProcess } from '@/lib/business-process/booking-process';
import type { BookingDecisionContext } from '@/lib/decision-engine/types/booking-types';

describe('Booking Process', () => {
  describe('VIP Customer Booking', () => {
    it('should auto-approve VIP customer with exact preference match', async () => {
      const context: BookingDecisionContext = {
        customer: {
          id: 'customer_001',
          name: 'Nguyễn Thị VIP',
          membershipTier: 'vip',
          totalBookings: 25,
          cancelledBookings: 0,
          noShowCount: 0,
          paymentStatus: 'good',
          registrationDate: '2025-01-15',
        },
        request: {
          serviceType: 'premium-massage',
          preferredDate: '2026-06-25',
          preferredTime: '10:00',
          duration: 90,
        },
        availability: {
          slots: [
            {
              date: '2026-06-25',
              time: '10:00',
              staffId: 'staff_123',
              resourceId: 'room_vip_01',
              available: true,
            },
            {
              date: '2026-06-25',
              time: '14:00',
              staffId: 'staff_456',
              resourceId: 'room_02',
              available: true,
            },
          ],
          staffCapacity: { staff_123: 4, staff_456: 6 },
          resourceCapacity: { room_vip_01: 8, room_02: 10 },
        },
        rules: {
          advanceBookingDays: { vip: 30, regular: 14, new: 7 },
          cancellationPolicyHours: 24,
          maxActiveBookings: 5,
          requiresDeposit: false,
          depositPercentage: 0,
        },
      };

      const process = new BookingProcess();
      const result = await process.execute(context);

      // Assertions
      expect(['success', 'partial_success']).toContain(result.status);
      expect(result.result.eligible).toBe(true);
      expect(result.result.autoApproved).toBe(true);
      expect(result.result.recommendedSlot).toBe('2026-06-25T10:00');
      expect(result.result.recommendedStaff).toBe('staff_123');
      expect(result.result.status).toBe('confirmed');
      expect(result.result.requiresDeposit).toBe(false);

      // Check policy composition
      expect(result.metadata.policyComposition).toEqual([
        'EligibilityPolicy:booking-eligibility',
        'RecommendationPolicy:booking-recommendation',
        'ApprovalPolicy:booking-approval',
      ]);

      // Check execution time
      expect(result.totalExecutionTime).toBeLessThan(100);
    });
  });

  describe('New Customer Booking', () => {
    it('should require approval and deposit for new customer', async () => {
      const context: BookingDecisionContext = {
        customer: {
          id: 'customer_new',
          name: 'Trần Văn Mới',
          membershipTier: 'new',
          totalBookings: 0,
          cancelledBookings: 0,
          noShowCount: 0,
          paymentStatus: 'good',
          registrationDate: '2026-06-20',
        },
        request: {
          serviceType: 'basic-massage',
          preferredDate: '2026-06-25',
          preferredTime: '14:00',
          duration: 60,
        },
        availability: {
          slots: [
            {
              date: '2026-06-25',
              time: '14:00',
              staffId: 'staff_456',
              resourceId: 'room_02',
              available: true,
            },
          ],
          staffCapacity: { staff_456: 6 },
          resourceCapacity: { room_02: 10 },
        },
        rules: {
          advanceBookingDays: { vip: 30, regular: 14, new: 7 },
          cancellationPolicyHours: 24,
          maxActiveBookings: 2,
          requiresDeposit: true,
          depositPercentage: 50,
        },
      };

      const process = new BookingProcess();
      const result = await process.execute(context);

      expect(['success', 'partial_success']).toContain(result.status);
      expect(result.result.eligible).toBe(true);
      expect(result.result.autoApproved).toBe(false);
      expect(result.result.requiresDeposit).toBe(true);
      expect(result.result.depositAmount).toBe(500000); // Fixed demo amount
      expect(result.result.status).toBe('pending_approval');
    });
  });

  describe('Customer with Violations', () => {
    it('should reject customer with overdue payment', async () => {
      const context: BookingDecisionContext = {
        customer: {
          id: 'customer_overdue',
          name: 'Lê Thị Nợ',
          membershipTier: 'regular',
          totalBookings: 10,
          cancelledBookings: 2,
          noShowCount: 1,
          paymentStatus: 'overdue',
          registrationDate: '2025-03-10',
        },
        request: {
          serviceType: 'basic-massage',
          preferredDate: '2026-06-25',
          duration: 60,
        },
        availability: {
          slots: [
            {
              date: '2026-06-25',
              time: '10:00',
              available: true,
            },
          ],
          staffCapacity: {},
          resourceCapacity: {},
        },
        rules: {
          advanceBookingDays: { vip: 30, regular: 14, new: 7 },
          cancellationPolicyHours: 24,
          maxActiveBookings: 3,
          requiresDeposit: false,
          depositPercentage: 0,
        },
      };

      const process = new BookingProcess();
      const result = await process.execute(context);

      expect(['success', 'partial_success']).toContain(result.status);
      expect(result.result.eligible).toBe(false);
      expect(result.result.status).toBe('rejected');
      expect(result.result.reason).toContain('overdue payments');
    });

    it('should reject customer with too many no-shows', async () => {
      const context: BookingDecisionContext = {
        customer: {
          id: 'customer_noshow',
          name: 'Phạm Văn Vắng',
          membershipTier: 'regular',
          totalBookings: 15,
          cancelledBookings: 1,
          noShowCount: 5, // More than max 3
          paymentStatus: 'good',
          registrationDate: '2025-05-01',
        },
        request: {
          serviceType: 'basic-massage',
          preferredDate: '2026-06-25',
          duration: 60,
        },
        availability: {
          slots: [
            {
              date: '2026-06-25',
              time: '10:00',
              available: true,
            },
          ],
          staffCapacity: {},
          resourceCapacity: {},
        },
        rules: {
          advanceBookingDays: { vip: 30, regular: 14, new: 7 },
          cancellationPolicyHours: 24,
          maxActiveBookings: 3,
          requiresDeposit: false,
          depositPercentage: 0,
        },
      };

      const process = new BookingProcess();
      const result = await process.execute(context);

      expect(['success', 'partial_success']).toContain(result.status);
      expect(result.result.eligible).toBe(false);
      expect(result.result.status).toBe('rejected');
      expect(result.result.reason).toContain('no-shows');
    });
  });

  describe('Regular Customer Booking', () => {
    it('should auto-approve regular customer with good history', async () => {
      const context: BookingDecisionContext = {
        customer: {
          id: 'customer_regular',
          name: 'Hoàng Thị Thường',
          membershipTier: 'regular',
          totalBookings: 8,
          cancelledBookings: 0,
          noShowCount: 0,
          paymentStatus: 'good',
          registrationDate: '2025-10-15',
        },
        request: {
          serviceType: 'basic-massage',
          preferredDate: '2026-06-26',
          duration: 60,
        },
        availability: {
          slots: [
            {
              date: '2026-06-26',
              time: '09:00',
              staffId: 'staff_789',
              available: true,
            },
          ],
          staffCapacity: { staff_789: 8 },
          resourceCapacity: {},
        },
        rules: {
          advanceBookingDays: { vip: 30, regular: 14, new: 7 },
          cancellationPolicyHours: 24,
          maxActiveBookings: 3,
          requiresDeposit: false,
          depositPercentage: 0,
        },
      };

      const process = new BookingProcess();
      const result = await process.execute(context);

      expect(['success', 'partial_success']).toContain(result.status);
      expect(result.result.eligible).toBe(true);
      expect(result.result.autoApproved).toBe(true);
      expect(result.result.status).toBe('confirmed');
    });
  });

  describe('Recommendation Engine', () => {
    it('should find alternative slot when exact preference unavailable', async () => {
      const context: BookingDecisionContext = {
        customer: {
          id: 'customer_flex',
          name: 'Đỗ Văn Linh Hoạt',
          membershipTier: 'regular',
          totalBookings: 12,
          cancelledBookings: 0,
          noShowCount: 0,
          paymentStatus: 'good',
          registrationDate: '2025-08-01',
        },
        request: {
          serviceType: 'premium-massage',
          preferredDate: '2026-06-25',
          preferredTime: '10:00', // Not available
          duration: 90,
        },
        availability: {
          slots: [
            {
              date: '2026-06-25',
              time: '11:00', // 1 hour later
              staffId: 'staff_123',
              available: true,
            },
            {
              date: '2026-06-25',
              time: '15:00', // 5 hours later
              staffId: 'staff_456',
              available: true,
            },
          ],
          staffCapacity: { staff_123: 4, staff_456: 6 },
          resourceCapacity: {},
        },
        rules: {
          advanceBookingDays: { vip: 30, regular: 14, new: 7 },
          cancellationPolicyHours: 24,
          maxActiveBookings: 3,
          requiresDeposit: false,
          depositPercentage: 0,
        },
      };

      const process = new BookingProcess();
      const result = await process.execute(context);

      expect(['success', 'partial_success']).toContain(result.status);
      expect(result.result.eligible).toBe(true);
      // Should recommend 11:00 (closer to 10:00 than 15:00)
      expect(result.result.recommendedSlot).toBe('2026-06-25T11:00');
      expect(result.result.status).toBe('confirmed');
    });
  });
});
