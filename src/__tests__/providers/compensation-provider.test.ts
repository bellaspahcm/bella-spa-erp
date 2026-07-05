/**
 * Compensation Provider Tests (BPL-Based)
 * 
 * Tests Policy Composition Architecture:
 * - REWARD POLICIES: R1 (Activity), R2 (Value), R3 (Sales)
 * - MULTIPLIER POLICIES: M1 (Performance), M2 (Position)
 * - INCENTIVE POLICIES: I1 (Volume), I2 (Team)
 * - CONSTRAINT POLICIES: C1 (MinThreshold), C2 (MaxCap)
 * 
 * Verifies:
 * 1. Policy composition metadata tracking
 * 2. Cross-industry abstraction (activityMetric, valueMetric, salesMetric)
 * 3. Each policy can be independently tested
 * 4. No regression from old commission calculation
 */

import { CompensationProvider } from '@/services/providers/compensation-provider';
import type { PayrollDecisionContext } from '@/lib/decision-engine/types/decision-context';
import { createPayrollContext } from '@/lib/decision-engine/types/decision-context';

describe('CompensationProvider (BPL)', () => {
  let provider: CompensationProvider;

  beforeEach(() => {
    provider = new CompensationProvider();
  });

  describe('REWARD POLICIES', () => {
    describe('R1: Activity-Based Reward', () => {
      it('should calculate activity reward (15 sessions × 150k)', async () => {
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
            sessions: { count: 15, weightedCount: 15, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.activityReward).toBe(2250000); // 15 × 150k
        expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(
          expect.stringContaining('R1:Activity')
        );
        expect(result.metadata?.activityMetric).toBe(15);
      });

      it('should use weightedCount if provided (package multiplier)', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-002',
            fullName: 'Trần Thị B',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 10, weightedCount: 15, avgRating: null }, // VIP package 1.5x
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.activityReward).toBe(2250000); // 15 × 150k (weighted)
        expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(
          expect.stringContaining('R1:Activity(15×150.000')
        );
      });

      it('should return 0 when no activity', async () => {
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
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(false);
        expect(result.amount).toBe(0);
        expect(result.reason).toContain('No compensation-eligible activity');
        expect(result.metadata?.activityMetric).toBe(0);
      });
    });

    describe('R2: Value-Based Reward', () => {
      it('should calculate value reward (percentage rate)', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-004',
            fullName: 'Phạm Thị D',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 10, serviceSales: 8000000, productSales: 0 },
            tenantConfig: {
              serviceCommissionRate: 0.10, // 10%
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.valueReward).toBe(800000); // 8M × 10%
        expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(
          expect.stringContaining('R2:Value')
        );
        expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(
          expect.stringContaining('10%')
        );
      });

      it('should calculate value reward (fixed rate per item)', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-005',
            fullName: 'Hoàng Văn E',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 5, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              serviceCommissionRate: 200000, // 200k per service
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.valueReward).toBe(1000000); // 5 × 200k
      });
    });

    describe('R3: Sales-Based Reward', () => {
      it('should calculate sales reward', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-006',
            fullName: 'Ngô Thị F',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 3000000 },
            tenantConfig: {
              productCommissionRate: 0.12, // 12%
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.salesReward).toBe(360000); // 3M × 12%
        expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(
          expect.stringContaining('R3:Sales')
        );
        expect(result.metadata?.salesMetric).toBe(3000000);
      });

      it('should combine all 3 reward policies (R1+R2+R3)', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-007',
            fullName: 'Đỗ Văn G',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: null },
            sales: { serviceCount: 10, serviceSales: 8000000, productSales: 3000000 },
            tenantConfig: {
              sessionCommissionRate: 150000,    // Activity
              serviceCommissionRate: 0.10,       // Value
              productCommissionRate: 0.12,       // Sales
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.activityReward).toBe(2250000); // 15 × 150k
        expect(result.breakdown?.valueReward).toBe(800000);     // 8M × 10%
        expect(result.breakdown?.salesReward).toBe(360000);     // 3M × 12%
        expect(result.amount).toBe(3410000); // 2.25M + 800k + 360k
        expect(result.metadata?.policyComposition?.rewardPolicies).toHaveLength(3);
      });
    });
  });

  describe('MULTIPLIER POLICIES', () => {
    describe('M1: Performance Multiplier', () => {
      it('should apply 1.1x multiplier for rating >= 4.5', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-008',
            fullName: 'Bùi Thị H',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: 4.6 },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        const baseReward = 2250000; // 15 × 150k
        const performanceBonus = Math.round(baseReward * 0.1); // 1.1x = +10%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.activityReward).toBe(2250000);
        expect(result.breakdown?.performanceBonus).toBe(performanceBonus);
        expect(result.amount).toBe(baseReward + performanceBonus);
        expect(result.metadata?.policyComposition?.multiplierPolicies).toContainEqual(
          expect.stringContaining('M1:Performance(4.6→1.1x')
        );
        expect(result.metadata?.performanceScore).toBe(4.6);
      });

      it('should apply 1.15x multiplier for rating >= 4.8', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-009',
            fullName: 'Vũ Văn I',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: 4.9 },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        const baseReward = 2250000;
        const performanceBonus = Math.round(baseReward * 0.15); // 1.15x = +15%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.performanceBonus).toBe(performanceBonus);
        expect(result.metadata?.policyComposition?.multiplierPolicies).toContainEqual(
          expect.stringContaining('M1:Performance(4.9→1.15x')
        );
      });

      it('should apply 1.2x multiplier for rating >= 5.0', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-010',
            fullName: 'Cao Thị J',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: 5.0 },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        const baseReward = 2250000;
        const performanceBonus = Math.round(baseReward * 0.2); // 1.2x = +20%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.performanceBonus).toBe(performanceBonus);
        expect(result.metadata?.multipliers?.performance).toBe(1.2);
      });

      it('should NOT apply multiplier when rating < 4.5', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-011',
            fullName: 'Dương Văn K',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: 4.2 },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.performanceBonus).toBeUndefined();
        expect(result.amount).toBe(2250000); // No bonus
        expect(result.metadata?.policyComposition?.multiplierPolicies).toEqual([]);
      });
    });

    describe('M2: Position Multiplier', () => {
      it('should apply 1.2x multiplier for senior (only to value+sales)', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-012',
            fullName: 'Lý Thị L',
            baseSalary: 8000000,
            positionTier: 'senior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: null },
            sales: { serviceCount: 10, serviceSales: 8000000, productSales: 3000000 },
            tenantConfig: {
              sessionCommissionRate: 150000,
              serviceCommissionRate: 0.10,
              productCommissionRate: 0.12,
            },
          }
        );

        const result = await provider.evaluate(context);

        const activityReward = 2250000; // NOT affected by position
        const valueReward = 800000;     // 8M × 10%
        const salesReward = 360000;     // 3M × 12%
        const positionBonus = Math.round((valueReward + salesReward) * 0.2); // 1.2x = +20%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.activityReward).toBe(2250000);
        expect(result.breakdown?.valueReward).toBe(800000);
        expect(result.breakdown?.salesReward).toBe(360000);
        expect(result.breakdown?.positionBonus).toBe(positionBonus);
        expect(result.metadata?.policyComposition?.multiplierPolicies).toContainEqual(
          expect.stringContaining('M2:Position(senior→1.2x')
        );
      });

      it('should apply 1.5x multiplier for lead', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-013',
            fullName: 'Mạc Văn M',
            baseSalary: 8000000,
            positionTier: 'lead',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 10, serviceSales: 8000000, productSales: 0 },
            tenantConfig: {
              serviceCommissionRate: 0.10,
            },
          }
        );

        const result = await provider.evaluate(context);

        const valueReward = 800000;
        const positionBonus = Math.round(valueReward * 0.5); // 1.5x = +50%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.positionBonus).toBe(positionBonus);
        expect(result.metadata?.policyComposition?.multiplierPolicies).toContainEqual(
          expect.stringContaining('M2:Position(lead→1.5x')
        );
      });

      it('should apply 2.0x multiplier for manager', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-014',
            fullName: 'Quách Thị N',
            baseSalary: 8000000,
            positionTier: 'manager',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 3000000 },
            tenantConfig: {
              productCommissionRate: 0.12,
            },
          }
        );

        const result = await provider.evaluate(context);

        const salesReward = 360000;
        const positionBonus = Math.round(salesReward * 1.0); // 2.0x = +100%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.positionBonus).toBe(positionBonus);
        expect(result.metadata?.multipliers?.position).toBe(2.0);
      });

      it('should NOT apply multiplier for junior', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-015',
            fullName: 'Tô Văn O',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 10, serviceSales: 8000000, productSales: 0 },
            tenantConfig: {
              serviceCommissionRate: 0.10,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.positionBonus).toBeUndefined();
        expect(result.amount).toBe(800000); // No bonus
      });
    });
  });

  describe('INCENTIVE POLICIES', () => {
    describe('I1: Volume Incentive', () => {
      it('should give 500k bonus for 30+ sessions', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-016',
            fullName: 'Hồ Thị P',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 35, weightedCount: 35, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.volumeIncentive).toBe(500000);
        expect(result.metadata?.policyComposition?.incentivePolicies).toContainEqual(
          expect.stringContaining('I1:Volume(Activity>=30→500k)')
        );
      });

      it('should give 1M bonus for 50+ sessions', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-017',
            fullName: 'Trịnh Văn Q',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 55, weightedCount: 55, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.volumeIncentive).toBe(1000000);
        expect(result.metadata?.policyComposition?.incentivePolicies).toContainEqual(
          expect.stringContaining('I1:Volume(Activity>=50→1M)')
        );
      });

      it('should give revenue-based bonuses (50M/100M/200M)', async () => {
        const context1 = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-018',
            fullName: 'Ông Thị R',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 50, serviceSales: 60000000, productSales: 0, totalRevenue: 60000000 },
            tenantConfig: {
              serviceCommissionRate: 0.05,
            },
          }
        );

        const result1 = await provider.evaluate(context1);
        expect(result1.breakdown?.volumeIncentive).toBe(500000); // 50M+

        const context2 = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-019',
            fullName: 'Đặng Văn S',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 0, weightedCount: 0, avgRating: null },
            sales: { serviceCount: 100, serviceSales: 120000000, productSales: 0, totalRevenue: 120000000 },
            tenantConfig: {
              serviceCommissionRate: 0.05,
            },
          }
        );

        const result2 = await provider.evaluate(context2);
        expect(result2.breakdown?.volumeIncentive).toBe(1500000); // 100M+
      });
    });

    describe('I2: Team Incentive', () => {
      it('should give 0.5% team bonus for lead', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-020',
            fullName: 'Diệp Thị T',
            baseSalary: 8000000,
            positionTier: 'lead',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
            metadata: {
              teamTotalCompensation: 50000000, // Team earned 50M total
            },
          }
        );

        const result = await provider.evaluate(context);

        const teamIncentive = 50000000 * 0.005; // 0.5%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.teamIncentive).toBe(teamIncentive);
        expect(result.metadata?.policyComposition?.incentivePolicies).toContainEqual(
          expect.stringContaining('I2:Team(lead→0.5%')
        );
      });

      it('should give 1% team bonus for manager', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-021',
            fullName: 'Nguyễn Thị U',
            baseSalary: 8000000,
            positionTier: 'manager',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
            metadata: {
              teamTotalCompensation: 50000000,
            },
          }
        );

        const result = await provider.evaluate(context);

        const teamIncentive = 50000000 * 0.01; // 1%

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.teamIncentive).toBe(teamIncentive);
        expect(result.metadata?.policyComposition?.incentivePolicies).toContainEqual(
          expect.stringContaining('I2:Team(manager→')
        );
      });

      it('should NOT give team bonus for junior/senior', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-022',
            fullName: 'Trần Văn V',
            baseSalary: 8000000,
            positionTier: 'senior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
            },
            metadata: {
              teamTotalCompensation: 50000000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.breakdown?.teamIncentive).toBeUndefined();
      });
    });
  });

  describe('CONSTRAINT POLICIES', () => {
    describe('C1: Min Threshold Constraint', () => {
      it('should block when below minimum threshold', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-023',
            fullName: 'Lê Thị W',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 2, weightedCount: 2, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
              minSessionsForCommission: 3, // Minimum 3 sessions
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(false);
        expect(result.amount).toBe(0);
        expect(result.reason).toContain('Did not meet minimum threshold');
        expect(result.reason).toContain('2/3');
        expect(result.metadata?.policyComposition?.constraintPolicies).toContainEqual(
          expect.stringContaining('C1:MinThreshold(2/3→BLOCKED)')
        );
      });

      it('should pass when at or above minimum threshold', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-024',
            fullName: 'Phạm Văn X',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 5, weightedCount: 5, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
              minSessionsForCommission: 3,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.amount).toBe(750000); // 5 × 150k
        expect(result.metadata?.policyComposition?.constraintPolicies).toContainEqual(
          expect.stringContaining('C1:MinThreshold(5/3→PASS)')
        );
      });
    });

    describe('C2: Max Cap Constraint', () => {
      it('should apply max cap when exceeded', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-025',
            fullName: 'Hoàng Thị Y',
            baseSalary: 8000000,
            positionTier: 'senior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 100, weightedCount: 100, avgRating: 5.0 },
            sales: { serviceCount: 50, serviceSales: 50000000, productSales: 10000000, totalRevenue: 60000000 },
            tenantConfig: {
              sessionCommissionRate: 150000,
              serviceCommissionRate: 0.10,
              productCommissionRate: 0.12,
              maxCompensationPerMonth: 15000000, // Max cap
            },
          }
        );

        const result = await provider.evaluate(context);

        // Would calculate much higher, but capped at 15M
        expect(result.eligible).toBe(true);
        expect(result.amount).toBe(15000000);
        expect(result.metadata?.policyComposition?.constraintPolicies).toContainEqual(
          expect.stringContaining('C2:MaxCap')
        );
      });

      it('should NOT apply cap when under limit', async () => {
        const context = createPayrollContext(
          'tenant-001',
          {
            id: 'ktv-026',
            fullName: 'Vũ Văn Z',
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            sessions: { count: 15, weightedCount: 15, avgRating: null },
            sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
            tenantConfig: {
              sessionCommissionRate: 150000,
              maxCompensationPerMonth: 5000000,
            },
          }
        );

        const result = await provider.evaluate(context);

        expect(result.eligible).toBe(true);
        expect(result.amount).toBe(2250000); // Under cap, not applied
      });
    });
  });

  describe('POLICY COMPOSITION', () => {
    it('should track all applied policies in metadata', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-027',
          fullName: 'Nguyễn Văn AA',
          baseSalary: 8000000,
          positionTier: 'senior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: { count: 35, weightedCount: 35, avgRating: 4.8 },
          sales: { serviceCount: 10, serviceSales: 8000000, productSales: 3000000, totalRevenue: 11000000 },
          tenantConfig: {
            sessionCommissionRate: 150000,
            serviceCommissionRate: 0.10,
            productCommissionRate: 0.12,
            minSessionsForCommission: 3,
          },
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(true);
      expect(result.metadata?.policyComposition).toBeDefined();
      
      // Should have all 4 policy types
      expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(expect.stringContaining('R1:Activity'));
      expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(expect.stringContaining('R2:Value'));
      expect(result.metadata?.policyComposition?.rewardPolicies).toContainEqual(expect.stringContaining('R3:Sales'));
      
      expect(result.metadata?.policyComposition?.multiplierPolicies).toContainEqual(expect.stringContaining('M1:Performance'));
      expect(result.metadata?.policyComposition?.multiplierPolicies).toContainEqual(expect.stringContaining('M2:Position'));
      
      expect(result.metadata?.policyComposition?.incentivePolicies).toContainEqual(expect.stringContaining('I1:Volume'));
      
      expect(result.metadata?.policyComposition?.constraintPolicies).toContainEqual(expect.stringContaining('C1:MinThreshold'));
    });

    it('should show policy-based reason format', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-028',
          fullName: 'Trần Thị BB',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: { count: 15, weightedCount: 15, avgRating: 4.6 },
          sales: { serviceCount: 0, serviceSales: 0, productSales: 0 },
          tenantConfig: {
            sessionCommissionRate: 150000,
          },
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('Rewards:');
      expect(result.reason).toContain('R1:Activity');
      expect(result.reason).toContain('Multipliers:');
      expect(result.reason).toContain('M1:Performance');
    });

    it('should calculate complex scenario correctly (regression test)', async () => {
      // This is the same scenario as old "Commission Provider" tests
      // Verifies no regression in behavior after refactoring to BPL
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-029',
          fullName: 'Lê Văn CC',
          baseSalary: 8000000,
          positionTier: 'senior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: { count: 15, weightedCount: 15, avgRating: 4.6 },
          sales: { serviceCount: 10, serviceSales: 8000000, productSales: 3000000 },
          tenantConfig: {
            sessionCommissionRate: 150000,
            serviceCommissionRate: 0.10,
            productCommissionRate: 0.12,
          },
        }
      );

      const result = await provider.evaluate(context);

      // OLD calculation (for reference):
      // session: 15 × 150k = 2,250,000
      // service: 8M × 10% = 800,000
      // product: 3M × 12% = 360,000
      // base = 3,410,000
      // 
      // position (senior 1.2x on service+product): (800k + 360k) × 0.2 = 232,000
      // performance (4.6 = 1.1x on base): 3,410,000 × 0.1 = 341,000
      // total = 3,410,000 + 232,000 + 341,000 = 3,983,000

      const expectedActivity = 2250000;
      const expectedValue = 800000;
      const expectedSales = 360000;
      const expectedBase = expectedActivity + expectedValue + expectedSales; // 3,410,000
      const expectedPosition = Math.round((expectedValue + expectedSales) * 0.2); // 232,000
      const expectedPerformance = Math.round(expectedBase * 0.1); // 341,000
      const expectedTotal = expectedBase + expectedPosition + expectedPerformance; // 3,983,000

      expect(result.eligible).toBe(true);
      expect(result.breakdown?.activityReward).toBe(expectedActivity);
      expect(result.breakdown?.valueReward).toBe(expectedValue);
      expect(result.breakdown?.salesReward).toBe(expectedSales);
      expect(result.breakdown?.positionBonus).toBe(expectedPosition);
      expect(result.breakdown?.performanceBonus).toBe(expectedPerformance);
      expect(result.amount).toBe(expectedTotal);
      expect(result.metadata?.baseCompensation).toBe(expectedBase);
    });
  });

  describe('MANUAL OVERRIDE', () => {
    it('should use manual override amount when provided', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-030',
          fullName: 'Phạm Thị DD',
          baseSalary: 8000000,
          positionTier: 'senior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: { count: 15, weightedCount: 15, avgRating: 4.6 },
          sales: { serviceCount: 10, serviceSales: 8000000, productSales: 3000000 },
          tenantConfig: {
            sessionCommissionRate: 150000,
            serviceCommissionRate: 0.10,
            productCommissionRate: 0.12,
          },
          overrides: {
            compensation: 5000000, // Manual override
          },
        }
      );

      const result = await provider.evaluate(context, { applyOverrides: true });

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(5000000);
      expect(result.reason).toContain('Manual override');
      expect(result.metadata?.override).toBe(true);
      expect(result.metadata?.policyComposition).toBeDefined();
    });
  });

  describe('EDGE CASES', () => {
    it('should return not eligible when no config rates provided', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-031',
          fullName: 'Hoàng Văn EE',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: { count: 15, weightedCount: 15, avgRating: null },
          sales: { serviceCount: 10, serviceSales: 8000000, productSales: 3000000 },
          tenantConfig: {
            // No rates configured
          },
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toContain('No compensation-eligible activity');
    });

    it('should handle null/undefined sessions gracefully', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-032',
          fullName: 'Vũ Thị FF',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: null,
          sales: { serviceCount: 10, serviceSales: 8000000, productSales: 0 },
          tenantConfig: {
            serviceCommissionRate: 0.10,
          },
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(800000); // Only value reward
      expect(result.breakdown?.activityReward).toBeUndefined();
    });

    it('should handle null/undefined sales gracefully', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-033',
          fullName: 'Cao Văn GG',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: { count: 15, weightedCount: 15, avgRating: null },
          sales: null,
          tenantConfig: {
            sessionCommissionRate: 150000,
          },
        }
      );

      const result = await provider.evaluate(context);

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(2250000); // Only activity reward
      expect(result.breakdown?.valueReward).toBeUndefined();
      expect(result.breakdown?.salesReward).toBeUndefined();
    });

    it('should round amounts correctly', async () => {
      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'ktv-034',
          fullName: 'Dương Thị HH',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          sessions: { count: 0, weightedCount: 0, avgRating: null },
          sales: { serviceCount: 7, serviceSales: 6666666, productSales: 0 },
          tenantConfig: {
            serviceCommissionRate: 0.15, // 15%
          },
        }
      );

      const result = await provider.evaluate(context);

      const expectedValue = 6666666 * 0.15; // 999,999.9 → should round

      expect(result.eligible).toBe(true);
      expect(result.amount).toBe(Math.round(expectedValue));
    });
  });
});
