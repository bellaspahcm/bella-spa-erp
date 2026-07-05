/**
 * Base Salary Provider Tests
 * 
 * Covers all 8 base salary calculation scenarios:
 * 1. Full month salary (26 days present)
 * 2. Pro-rata salary (partial month, 20 days)
 * 3. Resignation cap (resigned on day 15)
 * 4. Min salary floor enforcement
 * 5. Position multiplier (Senior 1.2x)
 * 6. Contract type adjustment (Part-time 50%)
 * 7. Probation discount (85%)
 * 8. Max salary cap enforcement
 */

import { BaseSalaryProvider } from '@/services/providers/base-salary-provider';
import type { PayrollDecisionContext } from '@/lib/decision-engine/types/decision-context';
import { createPayrollContext } from '@/lib/decision-engine/types/decision-context';

describe('BaseSalaryProvider', () => {
  let provider: BaseSalaryProvider;

  beforeEach(() => {
    provider = new BaseSalaryProvider();
  });

  describe('Full Month Salary', () => {
    it('should return full base salary when employee worked 26 days', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-001',
          fullName: 'Nguyễn Văn A',
          baseSalary: 8000000,
          positionTier: 'junior',
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
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(8000000);
      expect(result.reason).toContain('Full month');
      expect(result.metadata?.calculationType).toBe('full-month');
      expect(result.metadata?.workingDays).toBe(26);
    });

    it('should return full salary even with more than 26 days (overtime scenario)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-002',
          fullName: 'Trần Thị B',
          baseSalary: 7000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2022-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 28, // Worked extra days
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(7000000);
      expect(result.reason).toContain('Full month');
    });
  });

  describe('Pro-rata Salary (Partial Month)', () => {
    it('should calculate pro-rata salary for 20 days worked', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-003',
          fullName: 'Lê Văn C',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 20,
            lateDays: 0,
            absentDays: 6,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = Math.round((8000000 / 26) * 20); // 6,153,846

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Pro-rata');
      expect(result.reason).toContain('20/26 days');
      expect(result.metadata?.calculationType).toBe('pro-rata');
      expect(result.metadata?.workingDays).toBe(20);
      expect(result.metadata?.divisor).toBe(26);
    });

    it('should calculate pro-rata salary for 15 days worked', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-004',
          fullName: 'Phạm Thị D',
          baseSalary: 6000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2024-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 15,
            lateDays: 0,
            absentDays: 11,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = Math.round((6000000 / 26) * 15); // 3,461,538

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Pro-rata');
      expect(result.reason).toContain('15/26 days');
    });

    it('should return not eligible when 0 days worked', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-005',
          fullName: 'Hoàng Văn E',
          baseSalary: 7000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 0,
            lateDays: 0,
            absentDays: 26,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toContain('No attendance recorded');
    });
  });

  describe('Resignation Cap', () => {
    it('should cap salary at resignation date (day 15 of month)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-006',
          fullName: 'Ngô Thị F',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2022-01-01',
          resignationDate: '2026-06-15', // Resigned on day 15
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 15,
            lateDays: 0,
            absentDays: 11,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = Math.round((8000000 / 26) * 15); // 4,615,385

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Resignation cap');
      expect(result.reason).toContain('15/26 days');
      expect(result.reason).toContain('Resigned');
      expect(result.metadata?.calculationType).toBe('resignation-cap');
      expect(result.metadata?.dayOfResignation).toBe(15);
    });

    it('should cap salary at resignation date (day 20 of month)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-007',
          fullName: 'Đỗ Văn G',
          baseSalary: 7500000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2021-01-01',
          resignationDate: '2026-06-20', // Resigned on day 20
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 20,
            lateDays: 0,
            absentDays: 6,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = Math.round((7500000 / 26) * 20); // 5,769,231

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Resignation cap');
      expect(result.metadata?.dayOfResignation).toBe(20);
    });

    it('should NOT apply resignation cap if resignation is in a future month', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-008',
          fullName: 'Bùi Thị H',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2022-01-01',
          resignationDate: '2026-07-15', // Resignation in July, not June
        },
        '2026-06-01', // Calculating June salary
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      // Should get full month salary, not resignation cap
      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(8000000);
      expect(result.reason).toContain('Full month');
      expect(result.metadata?.calculationType).toBe('full-month');
    });
  });

  describe('Min Salary Floor Constraint', () => {
    it('should enforce minimum base salary floor', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-009',
          fullName: 'Vũ Văn I',
          baseSalary: 6000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2024-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 10, // Low attendance = low pro-rata
            lateDays: 0,
            absentDays: 16,
            halfDays: 0,
          },
          tenantConfig: {
            minBaseSalary: 4000000, // Regional minimum wage
          },
        }
      );

      const result = await provider.evaluate(context);

      const proRataAmount = Math.round((6000000 / 26) * 10); // 2,307,692
      // Should be lifted to minimum floor

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(4000000); // Min floor applied
      expect(result.reason).toContain('Min floor applied');
      expect(result.metadata?.baseCalculation).toBe(proRataAmount);
    });
  });

  describe('Position Multiplier', () => {
    it('should apply senior position multiplier (1.2x)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-010',
          fullName: 'Cao Thị J',
          baseSalary: 8000000,
          positionTier: 'senior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2021-01-01',
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
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = 8000000 * 1.2; // 9,600,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Position senior (1.2x)');
      expect(result.metadata?.baseCalculation).toBe(8000000);
    });

    it('should apply lead position multiplier (1.5x)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-011',
          fullName: 'Dương Văn K',
          baseSalary: 8000000,
          positionTier: 'lead',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2020-01-01',
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
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = 8000000 * 1.5; // 12,000,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Position lead (1.5x)');
    });

    it('should apply manager position multiplier (2.0x)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-012',
          fullName: 'Lý Thị L',
          baseSalary: 8000000,
          positionTier: 'manager',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2019-01-01',
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
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = 8000000 * 2.0; // 16,000,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Position manager (2x)');
    });
  });

  describe('Contract Type Adjustment', () => {
    it('should apply part-time multiplier (50%)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-013',
          fullName: 'Mạc Văn M',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'part-time',
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
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = 8000000 * 0.5; // 4,000,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Contract part-time (0.5x)');
    });

    it('should apply contract multiplier (80%)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-014',
          fullName: 'Quách Thị N',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'contract',
          status: 'active',
          hireDate: '2024-01-01',
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
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = 8000000 * 0.8; // 6,400,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Contract contract (0.8x)');
    });

    it('should apply intern multiplier (60%)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-015',
          fullName: 'Tô Văn O',
          baseSalary: 6000000,
          positionTier: 'junior',
          contractType: 'intern',
          status: 'active',
          hireDate: '2025-01-01',
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
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = 6000000 * 0.6; // 3,600,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Contract intern (0.6x)');
    });
  });

  describe('Probation Discount', () => {
    it('should apply probation discount (85%)', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-016',
          fullName: 'Hồ Thị P',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'probation',
          hireDate: '2026-05-01',
          resignationDate: null,
          probationEndDate: '2026-08-01', // Probation until August
        },
        '2026-06-01', // June is within probation
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      const expectedAmount = 8000000 * 0.85; // 6,800,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(expectedAmount);
      expect(result.reason).toContain('Probation period (85%)');
    });

    it('should NOT apply probation discount if probation ended', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-017',
          fullName: 'Trịnh Văn Q',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'probation',
          hireDate: '2026-01-01',
          resignationDate: null,
          probationEndDate: '2026-04-01', // Probation ended in April
        },
        '2026-06-01', // June is after probation
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      // Should get full salary without probation discount
      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(8000000);
      expect(result.reason).not.toContain('Probation');
    });
  });

  describe('Max Salary Cap Constraint', () => {
    it('should enforce maximum base salary cap', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-018',
          fullName: 'Ông Thị R',
          baseSalary: 20000000,
          positionTier: 'manager',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2018-01-01',
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
          tenantConfig: {
            maxBaseSalary: 35000000, // Max cap
          },
        }
      );

      const result = await provider.evaluate(context);

      const calculatedAmount = 20000000 * 2.0; // 40,000,000 (manager 2x)
      // Should be capped at 35,000,000

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(35000000); // Max cap applied
      expect(result.reason).toContain('Max cap applied');
      expect(result.metadata?.baseCalculation).toBe(20000000);
    });
  });

  describe('Manual Override', () => {
    it('should use manual override amount when provided', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-019',
          fullName: 'Đặng Văn S',
          baseSalary: 8000000,
          positionTier: 'senior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2021-01-01',
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
          overrides: {
            baseSalary: 10000000, // Manual override
          },
        }
      );

      const result = await provider.evaluate(context, { applyOverrides: true });

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(10000000);
      expect(result.reason).toContain('Manual override');
      expect(result.metadata?.override).toBe(true);
      expect(result.metadata?.originalAmount).toBe(8000000);
    });
  });

  describe('No Base Salary Configured', () => {
    it('should return not eligible when employee has no base salary', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-020',
          fullName: 'Diệp Thị T',
          baseSalary: 0, // No base salary
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2025-01-01',
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
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toContain('No base salary configured');
    });
  });
});
