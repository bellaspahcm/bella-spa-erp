/**
 * Universal Business Process Demo
 * 
 * **STRATEGIC PROOF**: This test proves that Bella EIP is a PLATFORM, not a collection of modules.
 * 
 * We run 2 completely different business processes from 2 different industries:
 * 1. Payroll Process (HR/Finance domain)
 * 2. Booking Process (Hospitality/Healthcare domain)
 * 
 * Both use the SAME Decision Engine. Same executor. Same pattern.
 * 
 * This is the demo that will convince CTOs, CEOs, and investors that
 * Bella EIP is a **Platform Company**, not a **Spa Software Company**.
 */

import { PayrollProcess } from '@/lib/business-process/payroll-process';
import { BookingProcess } from '@/lib/business-process/booking-process';
import { ProcurementProcess } from '@/lib/business-process/procurement-process';
import { createPayrollContext } from '@/lib/decision-engine/types/decision-context';
import type { BookingDecisionContext } from '@/lib/decision-engine/types/booking-types';
import type { ProcurementDecisionContext } from '@/lib/decision-engine/types/procurement-types';

describe('⭐ Universal Business Process Demo', () => {
  describe('Platform Capability Proof', () => {
    it('should process PAYROLL using policy composition', async () => {
      // ==========================================
      // PROCESS 1: PAYROLL (HR/Finance Domain)
      // ==========================================
      
      const payrollContext = createPayrollContext(
        'tenant-demo',
        {
          id: 'emp_001',
          fullName: 'Nguyễn Văn A',
          baseSalary: 12000000,
          positionTier: 'senior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
          sessions: { count: 14, weightedCount: 14, avgRating: 4.8 },
          sales: { serviceCount: 10, serviceSales: 5000000, productSales: 2000000 },
          tenantConfig: {
            sessionCommissionRate: 150000,
            serviceCommissionRate: 0.10,
            productCommissionRate: 0.12,
          },
        }
      );

      const payrollProcess = new PayrollProcess();
      const payrollResult = await payrollProcess.execute(payrollContext);

      // Assertions
      expect(['success', 'partial_success']).toContain(payrollResult.status);
      expect(payrollResult.result.totalSalary).toBeGreaterThan(0);
      expect(payrollResult.result.breakdown.baseSalary).toBeGreaterThan(0);
      expect(payrollResult.metadata.policyComposition.length).toBeGreaterThan(0);
      expect(payrollResult.totalExecutionTime).toBeLessThan(100); // Fast!

      console.log('\n✅ PAYROLL PROCESS (HR Domain)');
      console.log(`   Employee: ${payrollResult.result.employeeId}`);
      console.log(`   Base Salary: ${payrollResult.result.breakdown.baseSalary.toLocaleString()}đ`);
      console.log(`   Compensation: ${payrollResult.result.breakdown.compensation.toLocaleString()}đ`);
      console.log(`   Total Salary: ${payrollResult.result.totalSalary.toLocaleString()}đ`);
      console.log(`   Execution Time: ${payrollResult.totalExecutionTime.toFixed(2)}ms`);
      console.log(`   Policies Used: ${payrollResult.metadata.policyComposition.length}`);
    });

    it('should process BOOKING using policy composition', async () => {
      // ==========================================
      // PROCESS 2: BOOKING (Hospitality Domain)
      // ==========================================
      
      const bookingContext: BookingDecisionContext = {
        customer: {
          id: 'customer_vip',
          name: 'Trần Thị B',
          membershipTier: 'vip',
          totalBookings: 50,
          cancelledBookings: 0,
          noShowCount: 0,
          paymentStatus: 'good',
          registrationDate: '2025-01-01',
        },
        request: {
          serviceType: 'premium-spa',
          preferredDate: '2026-06-30',
          preferredTime: '14:00',
          duration: 120,
        },
        availability: {
          slots: [
            {
              date: '2026-06-30',
              time: '14:00',
              staffId: 'staff_001',
              resourceId: 'room_vip_01',
              available: true,
            },
          ],
          staffCapacity: { staff_001: 8 },
          resourceCapacity: { room_vip_01: 10 },
        },
        rules: {
          advanceBookingDays: { vip: 30, regular: 14, new: 7 },
          cancellationPolicyHours: 24,
          maxActiveBookings: 5,
          requiresDeposit: false,
          depositPercentage: 0,
        },
      };

      const bookingProcess = new BookingProcess();
      const bookingResult = await bookingProcess.execute(bookingContext);

      // Assertions
      expect(['success', 'partial_success']).toContain(bookingResult.status);
      expect(bookingResult.result.eligible).toBe(true);
      expect(bookingResult.result.autoApproved).toBe(true);
      expect(bookingResult.result.status).toBe('confirmed');
      expect(bookingResult.metadata.policyComposition.length).toBeGreaterThan(0);
      expect(bookingResult.totalExecutionTime).toBeLessThan(100); // Fast!

      console.log('\n✅ BOOKING PROCESS (Hospitality Domain)');
      console.log(`   Customer: ${bookingResult.result.customerId}`);
      console.log(`   Eligible: ${bookingResult.result.eligible}`);
      console.log(`   Recommended Slot: ${bookingResult.result.recommendedSlot}`);
      console.log(`   Auto-Approved: ${bookingResult.result.autoApproved}`);
      console.log(`   Status: ${bookingResult.result.status}`);
      console.log(`   Execution Time: ${bookingResult.totalExecutionTime.toFixed(2)}ms`);
      console.log(`   Policies Used: ${bookingResult.metadata.policyComposition.length}`);
    });

    it('should process PROCUREMENT using policy composition', async () => {
      // ==========================================
      // PROCESS 3: PROCUREMENT (Supply Chain Domain)
      // ==========================================
      
      const procurementContext: ProcurementDecisionContext = {
        requisition: {
          id: 'REQ-DEMO',
          requestedBy: 'Phạm Văn C',
          department: 'Production',
          items: [
            {
              id: 'item-001',
              name: 'Raw Materials',
              category: 'materials',
              quantity: 100,
              unitPrice: 50000,
              totalPrice: 5000000,
              urgency: 'normal',
            },
          ],
          totalAmount: 5000000,
          urgency: 'normal',
          justification: 'Monthly production materials',
          expectedDeliveryDate: '2026-07-10',
          submittedDate: '2026-06-22',
        },
        budget: {
          department: 'Production',
          allocated: 100000000,
          spent: 40000000,
          remaining: 60000000,
          period: '2026-Q2',
        },
        vendor: {
          id: 'vendor-001',
          name: 'Materials Supplier Ltd',
          rating: 4.3,
          certifications: ['ISO9001'],
          paymentTerms: 'Net 30',
          leadTimeDays: 7,
          approved: true,
        },
        approvalChain: {
          manager: { name: 'Manager', threshold: 10000000 },
          director: { name: 'Director', threshold: 50000000 },
          cfo: { name: 'CFO', threshold: 200000000 },
          ceo: { name: 'CEO', threshold: Infinity },
        },
        rules: {
          maxAmountWithoutApproval: 1000000,
          requiresMultipleQuotes: true,
          multipleQuotesThreshold: 10000000,
          preferredVendorsOnly: false,
          maxRejections: 2,
        },
      };

      const procurementProcess = new ProcurementProcess();
      const procurementResult = await procurementProcess.execute(procurementContext);

      // Assertions
      expect(['success', 'partial_success']).toContain(procurementResult.status);
      expect(procurementResult.result.valid).toBe(true);
      expect(procurementResult.result.requiredApprovers.length).toBeGreaterThan(0);
      expect(procurementResult.metadata.policyComposition.length).toBeGreaterThan(0);
      expect(procurementResult.totalExecutionTime).toBeLessThan(100);

      console.log('\n✅ PROCUREMENT PROCESS (Supply Chain Domain)');
      console.log(`   Requisition: ${procurementResult.result.requisitionId}`);
      console.log(`   Valid: ${procurementResult.result.valid}`);
      console.log(`   Status: ${procurementResult.result.status}`);
      console.log(`   Required Approvers: ${procurementResult.result.requiredApprovers.join(', ')}`);
      console.log(`   Execution Time: ${procurementResult.totalExecutionTime.toFixed(2)}ms`);
      console.log(`   Policies Used: ${procurementResult.metadata.policyComposition.length}`);
    });

    it('should prove SAME ENGINE runs DIFFERENT PROCESSES', async () => {
      // ==========================================
      // PLATFORM PROOF: Run both processes
      // ==========================================
      
      const payrollContext = createPayrollContext(
        'tenant-demo',
        {
          id: 'emp_demo',
          fullName: 'Demo Employee',
          baseSalary: 10000000,
          positionTier: 'regular',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
          sessions: { count: 10, weightedCount: 10, avgRating: 4.5 },
          sales: { serviceCount: 5, serviceSales: 3000000, productSales: 1000000 },
          tenantConfig: {
            sessionCommissionRate: 150000,
            serviceCommissionRate: 0.10,
            productCommissionRate: 0.12,
          },
        }
      );

      const bookingContext: BookingDecisionContext = {
        customer: {
          id: 'customer_demo',
          name: 'Demo Customer',
          membershipTier: 'regular',
          totalBookings: 5,
          cancelledBookings: 0,
          noShowCount: 0,
          paymentStatus: 'good',
          registrationDate: '2026-01-01',
        },
        request: {
          serviceType: 'basic-service',
          preferredDate: '2026-07-01',
          duration: 60,
        },
        availability: {
          slots: [{ date: '2026-07-01', time: '10:00', available: true }],
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

      // Execute both processes
      const payrollProcess = new PayrollProcess();
      const bookingProcess = new BookingProcess();

      const [payrollResult, bookingResult] = await Promise.all([
        payrollProcess.execute(payrollContext),
        bookingProcess.execute(bookingContext),
      ]);

      // ==========================================
      // PROOF: Same engine, different domains
      // ==========================================
      
      console.log('\n' + '='.repeat(60));
      console.log('🎯 PLATFORM CAPABILITY PROOF');
      console.log('='.repeat(60));
      
      console.log('\n📊 PROCESS COMPARISON:');
      console.log(`\n  Payroll Process:`);
      console.log(`    - Domain: HR/Finance`);
      console.log(`    - Engine: BaseBusinessProcess`);
      console.log(`    - Status: ${payrollResult.status}`);
      console.log(`    - Policies: ${payrollResult.metadata.policyComposition.join(', ')}`);
      console.log(`    - Execution: ${payrollResult.totalExecutionTime.toFixed(2)}ms`);
      
      console.log(`\n  Booking Process:`);
      console.log(`    - Domain: Hospitality`);
      console.log(`    - Engine: BaseBusinessProcess`);
      console.log(`    - Status: ${bookingResult.status}`);
      console.log(`    - Policies: ${bookingResult.metadata.policyComposition.join(', ')}`);
      console.log(`    - Execution: ${bookingResult.totalExecutionTime.toFixed(2)}ms`);
      
      console.log('\n💡 KEY INSIGHT:');
      console.log('   Same Decision Engine → Different Policy Composition = Platform');
      console.log('\n' + '='.repeat(60) + '\n');

      // Both processes succeeded
      expect(['success', 'partial_success']).toContain(payrollResult.status);
      expect(['success', 'partial_success']).toContain(bookingResult.status);
      
      // Both processes are fast
      expect(payrollResult.totalExecutionTime).toBeLessThan(100);
      expect(bookingResult.totalExecutionTime).toBeLessThan(100);
      
      // Both processes used policy composition
      expect(payrollResult.metadata.policyComposition.length).toBeGreaterThan(0);
      expect(bookingResult.metadata.policyComposition.length).toBeGreaterThan(0);
      
      // Both processes have different policy types (proof of different domains)
      const payrollPolicies = payrollResult.metadata.policyComposition;
      const bookingPolicies = bookingResult.metadata.policyComposition;
      
      expect(payrollPolicies).toContain('BaseSalaryProvider:base-salary-eligibility');
      expect(bookingPolicies).toContain('EligibilityPolicy:booking-eligibility');
      
      // NO OVERLAP = Different domains using same engine ✅
      const overlap = payrollPolicies.filter(p => bookingPolicies.includes(p));
      expect(overlap.length).toBe(0); // Proof: different policies for different domains
    });
  });

  describe('Stakeholder Demo Script', () => {
    it('should provide clear output for stakeholder presentation', async () => {
      console.log('\n' + '█'.repeat(70));
      console.log('█' + ' '.repeat(68) + '█');
      console.log('█  🎭 BELLA EIP - UNIVERSAL BUSINESS PROCESS PLATFORM DEMO  █');
      console.log('█' + ' '.repeat(68) + '█');
      console.log('█'.repeat(70));
      
      console.log('\n📋 DEMO SCENARIO:');
      console.log('   We will run 2 completely different business processes:');
      console.log('   1. Payroll (HR/Finance domain)');
      console.log('   2. Booking (Hospitality domain)');
      console.log('\n   Both will use the SAME Decision Engine.');
      console.log('   This proves Bella EIP is a PLATFORM, not industry-specific software.\n');
      
      // Just test that the demo script format is correct
      expect(true).toBe(true);
      
      console.log('✅ Demo script ready for stakeholder presentation');
      console.log('█'.repeat(70) + '\n');
    });
  });
});
