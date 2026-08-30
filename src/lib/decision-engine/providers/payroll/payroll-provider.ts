/**
 * Payroll Provider
 * 
 * Provider #3: Proves Decision Engine handles complex multi-component calculations.
 * 
 * Integrates payroll salary calculations with Decision Engine Platform.
 * Orchestrates 4 sub-providers (KPI, Attendance, Rating, Commission) using unified rule engine.
 * Follows all 10 Commandments of Decision Engine architecture.
 * 
 * **Architecture Compliance:**
 * - ✅ Commandment #1: Engine doesn't know about Payroll domain
 * - ✅ Commandment #2: Provider-based (this is a provider)
 * - ✅ Commandment #3: Replaceable (can swap calculation logic)
 * - ✅ Commandment #4: Stateless (no instance state)
 * - ✅ Commandment #5: Business logic in Provider (not Engine)
 * - ✅ Commandment #6: Can integrate BI/AI (extensible)
 * - ✅ Commandment #7: Returns standard DecisionResult
 * - ✅ Commandment #8: No direct database access
 * - ✅ Commandment #9: One-way dependency (Provider uses Engine types)
 * - ✅ Commandment #10: Fully auditable via observability layer
 * 
 * @module decision-engine/providers/payroll
 */

import { RuleReasoner } from '../../RuleReasoner';
import type { Policy, Knowledge } from '../../types';
import { allPayrollRules } from './rules';
import type { RuleCondition } from '../../types/rule';
import type {
  PayrollDecisionInput,
  PayrollDecisionOutput,
  PayrollKnowledge,
  SalaryComponent,
  ProviderEvaluationOptions,
  ProviderCategory,
  GateEvaluationResult,
} from './types';
import type { Rule, Condition } from '../../types';

interface BonusTier {
  min: number;
  max: number;
  bonus: number;
}

interface RateTier {
  min: number;
  max: number;
  rate: number;
}

type ReasonerComparisonOperator = Extract<Condition, { type: 'comparison' }>['operator'];

function numberParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' ? value : fallback;
}

function recordParam(params: Record<string, unknown>, key: string, fallback: Record<string, number>): Record<string, number> {
  const value = params[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  );
}

function bonusTierParam(params: Record<string, unknown>, key: string, fallback: BonusTier[]): BonusTier[] {
  const value = params[key];
  if (!Array.isArray(value)) return fallback;
  const tiers = value.filter((tier): tier is BonusTier => {
    if (!tier || typeof tier !== 'object') return false;
    const candidate = tier as Record<string, unknown>;
    return typeof candidate.min === 'number'
      && typeof candidate.max === 'number'
      && typeof candidate.bonus === 'number';
  });
  return tiers.length > 0 ? tiers : fallback;
}

function rateTierParam(params: Record<string, unknown>, key: string, fallback: RateTier[]): RateTier[] {
  const value = params[key];
  if (!Array.isArray(value)) return fallback;
  const tiers = value.filter((tier): tier is RateTier => {
    if (!tier || typeof tier !== 'object') return false;
    const candidate = tier as Record<string, unknown>;
    return typeof candidate.min === 'number'
      && typeof candidate.max === 'number'
      && typeof candidate.rate === 'number';
  });
  return tiers.length > 0 ? tiers : fallback;
}

/**
 * Payroll Provider
 * 
 * Evaluates salary components using Rule-based decision logic.
 * Uses Decision Engine's RuleReasoner with Payroll Policy.
 * 
 * **Process:**
 * 1. Enrich input into Knowledge
 * 2. Evaluate KPI bonus rules
 * 3. Evaluate Attendance deduction rules
 * 4. Evaluate Rating bonus rules
 * 5. Evaluate Commission rules (with gate enforcement)
 * 6. Aggregate results
 * 7. Return standard DecisionResult
 * 
 * **Rules Priority** (low to high):
 * - 200-250: KPI rules (6 rules)
 * - 260-280: Attendance rules (3 rules)
 * - 290-310: Rating rules (3 rules)
 * - 315-350: Commission rules (5 rules, includes gate)
 * 
 * **Rule Evaluation:**
 * - Only ENABLED rules are evaluated (16/17 rules)
 * - Rules evaluated by category (KPI → Attendance → Rating → Commission)
 * - Each category uses first matching rule (priority-based)
 * - Commission includes gate enforcement (minSessions check)
 */
export class PayrollProvider {
  private readonly reasoner: RuleReasoner;
  private readonly policies: Record<ProviderCategory, Policy>;

  constructor(options?: { debug?: boolean }) {
    this.reasoner = new RuleReasoner({ debug: options?.debug });
    
    // Create separate policies for each provider category
    // This allows independent evaluation of each salary component
    this.policies = {
      kpi: this.createPolicy('kpi', 'KPI Bonus Policy', allPayrollRules.filter(r => r.metadata?.category === 'kpi' && r.enabled)),
      attendance: this.createPolicy('attendance', 'Attendance Deduction Policy', allPayrollRules.filter(r => r.metadata?.category === 'attendance' && r.enabled)),
      rating: this.createPolicy('rating', 'Rating Bonus Policy', allPayrollRules.filter(r => r.metadata?.category === 'rating' && r.enabled)),
      commission: this.createPolicy('commission', 'Commission Policy', allPayrollRules.filter(r => r.metadata?.category === 'commission' && r.enabled)),
    };
  }

  /**
   * Evaluate payroll salary components
   * 
   * @param input - Payroll decision input (Knowledge)
   * @param options - Evaluation options (overrides, debug)
   * @returns Payroll decision output (DecisionResult)
   * 
   * @example
   * ```typescript
   * const provider = new PayrollProvider();
   * 
   * const result = await provider.evaluate({
   *   tenantId: 'bella-spa-vn',
   *   employeeId: 'emp-123',
   *   monthYear: '2026-07',
   *   sessions: {
   *     count: 35,
   *     avgRating: 4.8,
   *     totalRevenue: 15000000
   *   },
   *   attendance: {
   *     lateDays: 2,
   *     absentDays: 0,
   *     workingDays: 26
   *   },
   *   employee: {
   *     baseSalary: 8000000
   *   },
   *   config: {
   *     kpi: { enabled: true, strategy: 'threshold', params: { target: 30, bonus: 1000000 } },
   *     attendance: { enabled: true, strategy: 'combined', params: { latePenalty: 50000 } },
   *     rating: { enabled: true, strategy: 'threshold', params: { minRating: 4.5, bonus: 50000 } },
   *     commission: { enabled: true, strategy: 'fixed', params: { rate: 120000 } }
   *   }
   * });
   * 
   * console.log(result.totalBonuses); // 5250000 (KPI + Rating + Commission)
   * console.log(result.totalDeductions); // -100000 (2 late days)
   * console.log(result.netAdjustment); // 5150000
   * ```
   */
  async evaluate(
    input: PayrollDecisionInput,
    options?: ProviderEvaluationOptions
  ): Promise<PayrollDecisionOutput> {
    const startTime = performance.now();

    // Handle manual overrides
    if (options?.applyOverrides && options.overrides) {
      return this.applyManualOverrides(input, options.overrides, startTime);
    }

    // 1. Enrich knowledge
    const knowledge = this.enrichKnowledge(input);

    // 2. Evaluate KPI bonus
    const kpiBonus = await this.evaluateKPI(knowledge, input);

    // 3. Evaluate Attendance deduction
    const attendanceDeduction = await this.evaluateAttendance(knowledge, input);

    // 4. Evaluate Rating bonus
    const ratingBonus = await this.evaluateRating(knowledge, input);

    // 5. Evaluate Commission (with gate enforcement)
    const sessionCommission = await this.evaluateCommission(knowledge, input);

    // 6. Aggregate results
    const totalBonuses = kpiBonus.amount + ratingBonus.amount + sessionCommission.amount;
    const totalDeductions = Math.abs(attendanceDeduction.amount); // Convert to positive for clarity
    const netAdjustment = totalBonuses - totalDeductions;

    const matchedRules: string[] = [];
    if (kpiBonus.eligible) matchedRules.push(...this.getMatchedRules(kpiBonus.metadata?.matchedRules));
    if (attendanceDeduction.eligible) matchedRules.push(...this.getMatchedRules(attendanceDeduction.metadata?.matchedRules));
    if (ratingBonus.eligible) matchedRules.push(...this.getMatchedRules(ratingBonus.metadata?.matchedRules));
    if (sessionCommission.eligible) matchedRules.push(...this.getMatchedRules(sessionCommission.metadata?.matchedRules));

    // 7. Calculate execution time
    const endTime = performance.now();
    const executionTime = Number((endTime - startTime).toFixed(2));

    // 8. Build reason string
    const reasons: string[] = [];
    if (kpiBonus.eligible) reasons.push(kpiBonus.reason);
    if (attendanceDeduction.eligible) reasons.push(attendanceDeduction.reason);
    if (ratingBonus.eligible) reasons.push(ratingBonus.reason);
    if (sessionCommission.eligible) reasons.push(sessionCommission.reason);
    const reason = reasons.length > 0 
      ? reasons.join('; ')
      : 'No salary adjustments applicable';

    // 9. Return standard DecisionResult
    return {
      eligible: totalBonuses > 0 || totalDeductions > 0,
      totalBonuses,
      totalDeductions,
      netAdjustment,
      components: {
        kpiBonus,
        attendanceDeduction,
        ratingBonus,
        sessionCommission,
      },
      matchedRules,
      executionTime,
      provider: 'PayrollProvider',
      confidence: matchedRules.length > 0 ? 1.0 : 0.0,
      reason,
    };
  }

  /**
   * Evaluate KPI bonus component
   * @private
   */
  private async evaluateKPI(
    knowledge: PayrollKnowledge,
    input: PayrollDecisionInput
  ): Promise<SalaryComponent> {
    // Check if KPI provider enabled
    if (!input.config?.kpi?.enabled) {
      return this.createEmptyComponent('kpi-bonus', 'KPI bonus disabled');
    }

    // Evaluate via RuleReasoner
    const result = this.reasoner.evaluate(this.policies.kpi, knowledge as Knowledge);

    if (result.outcome !== 'APPROVE') {
      return this.createEmptyComponent('kpi-bonus', result.explanation || 'KPI target not met');
    }

    // Find matched rule
    const matchedRule = allPayrollRules.find(r => r.name === result.explanation);
    if (!matchedRule) {
      return this.createEmptyComponent('kpi-bonus', 'No KPI rule matched');
    }

    // Calculate bonus based on strategy
    const amount = this.calculateKPIBonus(
      input.sessions.count,
      input.config.kpi.strategy,
      input.config.kpi.params
    );

    return {
      type: 'kpi-bonus',
      eligible: amount > 0,
      amount,
      reason: `KPI ${input.config.kpi.strategy}: ${input.sessions.count} sessions → ${amount.toLocaleString('vi-VN')}đ`,
      strategy: input.config.kpi.strategy,
      metadata: {
        matchedRules: [matchedRule.id],
        strategy: input.config.kpi.strategy,
        sessions: input.sessions.count,
      },
    };
  }

  /**
   * Evaluate Attendance deduction component
   * @private
   */
  private async evaluateAttendance(
    knowledge: PayrollKnowledge,
    input: PayrollDecisionInput
  ): Promise<SalaryComponent> {
    // Check if Attendance provider enabled
    if (!input.config?.attendance?.enabled) {
      return this.createEmptyComponent('attendance-deduction', 'Attendance deduction disabled');
    }

    // Check if any violations
    if (input.attendance.lateDays === 0 && input.attendance.absentDays === 0) {
      return this.createEmptyComponent('attendance-deduction', 'No attendance violations');
    }

    // Evaluate via RuleReasoner
    const result = this.reasoner.evaluate(this.policies.attendance, knowledge as Knowledge);

    if (result.outcome !== 'APPROVE') {
      return this.createEmptyComponent('attendance-deduction', result.explanation || 'No deduction applicable');
    }

    // Find matched rule
    const matchedRule = allPayrollRules.find(r => r.name === result.explanation);
    if (!matchedRule) {
      return this.createEmptyComponent('attendance-deduction', 'No attendance rule matched');
    }

    // Calculate deduction based on strategy
    const amount = this.calculateAttendanceDeduction(
      input.attendance.lateDays,
      input.attendance.absentDays,
      input.config.attendance.strategy,
      input.config.attendance.params
    );

    return {
      type: 'attendance-deduction',
      eligible: amount < 0,
      amount, // Negative value
      reason: `Attendance ${input.config.attendance.strategy}: ${input.attendance.lateDays} late, ${input.attendance.absentDays} absent → ${amount.toLocaleString('vi-VN')}đ`,
      strategy: input.config.attendance.strategy,
      metadata: {
        matchedRules: [matchedRule.id],
        strategy: input.config.attendance.strategy,
        lateDays: input.attendance.lateDays,
        absentDays: input.attendance.absentDays,
      },
    };
  }

  /**
   * Evaluate Rating bonus component
   * @private
   */
  private async evaluateRating(
    knowledge: PayrollKnowledge,
    input: PayrollDecisionInput
  ): Promise<SalaryComponent> {
    // Check if Rating provider enabled
    if (!input.config?.rating?.enabled) {
      return this.createEmptyComponent('rating-bonus', 'Rating bonus disabled');
    }

    // Check if has rating data
    if (input.sessions.avgRating === 0) {
      return this.createEmptyComponent('rating-bonus', 'No rating data available');
    }

    // Evaluate via RuleReasoner
    const result = this.reasoner.evaluate(this.policies.rating, knowledge as Knowledge);

    if (result.outcome !== 'APPROVE') {
      return this.createEmptyComponent('rating-bonus', result.explanation || 'Rating threshold not met');
    }

    // Find matched rule
    const matchedRule = allPayrollRules.find(r => r.name === result.explanation);
    if (!matchedRule) {
      return this.createEmptyComponent('rating-bonus', 'No rating rule matched');
    }

    // Calculate bonus based on strategy
    const amount = this.calculateRatingBonus(
      input.sessions.avgRating,
      input.config.rating.strategy,
      input.config.rating.params
    );

    return {
      type: 'rating-bonus',
      eligible: amount > 0,
      amount,
      reason: `Rating ${input.config.rating.strategy}: ${input.sessions.avgRating.toFixed(1)} stars → ${amount.toLocaleString('vi-VN')}đ`,
      strategy: input.config.rating.strategy,
      metadata: {
        matchedRules: [matchedRule.id],
        strategy: input.config.rating.strategy,
        avgRating: input.sessions.avgRating,
      },
    };
  }

  /**
   * Evaluate Commission component (with gate enforcement)
   * @private
   */
  private async evaluateCommission(
    knowledge: PayrollKnowledge,
    input: PayrollDecisionInput
  ): Promise<SalaryComponent> {
    // Check if Commission provider enabled
    if (!input.config?.commission?.enabled) {
      return this.createEmptyComponent('session-commission', 'Commission disabled');
    }

    // GATE ENFORCEMENT: Check minimum sessions (Issue #3 fix)
    const gateResult = this.evaluateCommissionGate(input);
    if (!gateResult.passed) {
      return this.createEmptyComponent('session-commission', gateResult.reason || 'Gate rejected');
    }

    // Evaluate via RuleReasoner
    const result = this.reasoner.evaluate(this.policies.commission, knowledge as Knowledge);

    if (result.outcome !== 'APPROVE') {
      return this.createEmptyComponent('session-commission', result.explanation || 'No commission applicable');
    }

    // Find matched rule
    const matchedRule = allPayrollRules.find(r => r.name === result.explanation);
    if (!matchedRule) {
      return this.createEmptyComponent('session-commission', 'No commission rule matched');
    }

    // Calculate commission based on strategy
    const amount = this.calculateCommission(
      input.sessions.count,
      input.sessions.totalRevenue,
      input.sessions.serviceTypes || {},
      input.config.commission.strategy,
      input.config.commission.params
    );

    return {
      type: 'session-commission',
      eligible: amount > 0,
      amount,
      reason: `Commission ${input.config.commission.strategy}: ${input.sessions.count} sessions → ${amount.toLocaleString('vi-VN')}đ`,
      strategy: input.config.commission.strategy,
      metadata: {
        matchedRules: [matchedRule.id],
        strategy: input.config.commission.strategy,
        sessions: input.sessions.count,
        revenue: input.sessions.totalRevenue,
      },
    };
  }

  /**
   * Evaluate commission gate (minSessions requirement)
   * @private
   */
  private evaluateCommissionGate(input: PayrollDecisionInput): GateEvaluationResult {
    const minSessions = numberParam(input.config?.commission?.params ?? {}, 'minSessions', 0);

    if (minSessions > 0 && input.sessions.count < minSessions) {
      return {
        passed: false,
        reason: `Minimum sessions not met: ${input.sessions.count}/${minSessions}`,
        metadata: {
          minSessions,
          actualSessions: input.sessions.count,
        },
      };
    }

    return { passed: true };
  }

  // ... (calculation methods continued in next message)

  /**
   * Calculate KPI bonus based on strategy
   * @private
   */
  private calculateKPIBonus(
    sessions: number,
    strategy: string,
    params: Record<string, unknown>
  ): number {
    switch (strategy) {
      case 'threshold': {
        const target = numberParam(params, 'target', 30);
        const bonus = numberParam(params, 'bonus', 1000000);
        return sessions >= target ? bonus : 0;
      }

      case 'linear': {
        const baseline = numberParam(params, 'baseline', 20);
        const bonusPerUnit = numberParam(params, 'bonusPerUnit', 50000);
        const maxBonus = numberParam(params, 'maxBonus', 2000000);
        
        if (sessions <= baseline) return 0;
        
        const units = sessions - baseline;
        let bonus = units * bonusPerUnit;
        if (maxBonus && bonus > maxBonus) bonus = maxBonus;
        
        return Math.round(bonus);
      }

      case 'tier': {
        const tiers = bonusTierParam(params, 'tiers', [
          { min: 0, max: 20, bonus: 0 },
          { min: 21, max: 30, bonus: 500000 },
          { min: 31, max: 999, bonus: 1500000 },
        ]);
        
        const matchedTier = tiers.find((t) => sessions >= t.min && sessions <= t.max);
        
        return matchedTier ? matchedTier.bonus : 0;
      }

      default:
        return 0;
    }
  }

  /**
   * Calculate attendance deduction based on strategy
   * @private
   */
  private calculateAttendanceDeduction(
    lateDays: number,
    absentDays: number,
    strategy: string,
    params: Record<string, unknown>
  ): number {
    const latePenalty = numberParam(params, 'latePenalty', 50000);
    const absentPenalty = numberParam(params, 'absentPenalty', 200000);

    switch (strategy) {
      case 'late_deduction':
        return -1 * lateDays * latePenalty;

      case 'absent_deduction':
        return -1 * absentDays * absentPenalty;

      case 'combined':
        return -1 * (lateDays * latePenalty + absentDays * absentPenalty);

      default:
        return 0;
    }
  }

  /**
   * Calculate rating bonus based on strategy
   * @private
   */
  private calculateRatingBonus(
    avgRating: number,
    strategy: string,
    params: Record<string, unknown>
  ): number {
    switch (strategy) {
      case 'threshold': {
        const minRating = numberParam(params, 'minRating', 4.5);
        const bonus = numberParam(params, 'bonus', 50000);
        return avgRating >= minRating ? bonus : 0;
      }

      case 'linear': {
        const baseline = numberParam(params, 'baseline', 4.0);
        const bonusPerPoint = numberParam(params, 'bonusPerPoint', 100000);
        const maxBonus = numberParam(params, 'maxBonus', 300000);
        
        if (avgRating <= baseline) return 0;
        
        const points = avgRating - baseline;
        let bonus = points * bonusPerPoint;
        if (maxBonus && bonus > maxBonus) bonus = maxBonus;
        
        return Math.round(bonus);
      }

      case 'tier': {
        const tiers = bonusTierParam(params, 'tiers', [
          { min: 0, max: 4.4, bonus: 0 },
          { min: 4.5, max: 4.7, bonus: 50000 },
          { min: 4.8, max: 5.0, bonus: 150000 },
        ]);
        
        const matchedTier = tiers.find((t) => avgRating >= t.min && avgRating <= t.max);
        
        return matchedTier ? matchedTier.bonus : 0;
      }

      default:
        return 0;
    }
  }

  /**
   * Calculate commission based on strategy
   * @private
   */
  private calculateCommission(
    sessions: number,
    revenue: number,
    serviceTypes: Record<string, number>,
    strategy: string,
    params: Record<string, unknown>
  ): number {
    switch (strategy) {
      case 'fixed': {
        const rate = numberParam(params, 'rate', 120000);
        return sessions * rate;
      }

      case 'tier': {
        const tiers = rateTierParam(params, 'tiers', [
          { min: 0, max: 10, rate: 100000 },
          { min: 11, max: 20, rate: 120000 },
          { min: 21, max: 999, rate: 150000 },
        ]);
        
        const matchedTier = tiers.find((t) => sessions >= t.min && sessions <= t.max);
        
        return matchedTier ? sessions * matchedTier.rate : 0;
      }

      case 'percentage': {
        const percentage = numberParam(params, 'percentage', 15);
        return Math.round((revenue * percentage) / 100);
      }

      case 'service': {
        const serviceRates = recordParam(params, 'serviceRates', {
          Massage: 150000,
          Facial: 100000,
          Manicure: 80000,
        });
        const defaultRate = numberParam(params, 'defaultRate', 120000);
        
        let total = 0;
        for (const [serviceType, count] of Object.entries(serviceTypes)) {
          const rate = serviceRates[serviceType] || defaultRate;
          total += count * rate;
        }
        
        return total;
      }

      default:
        return 0;
    }
  }

  /**
   * Enrich input into knowledge for rule evaluation
   * @private
   */
  private enrichKnowledge(input: PayrollDecisionInput): PayrollKnowledge {
    return {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      monthYear: input.monthYear,
      'sessions.count': input.sessions.count,
      'sessions.avgRating': input.sessions.avgRating,
      'sessions.totalRevenue': input.sessions.totalRevenue,
      'attendance.lateDays': input.attendance.lateDays,
      'attendance.absentDays': input.attendance.absentDays,
      'attendance.workingDays': input.attendance.workingDays,
      'employee.baseSalary': input.employee.baseSalary,
      'kpi.strategy': input.config?.kpi?.strategy,
      'kpi.enabled': input.config?.kpi?.enabled,
      'attendance.strategy': input.config?.attendance?.strategy,
      'attendance.enabled': input.config?.attendance?.enabled,
      'rating.strategy': input.config?.rating?.strategy,
      'rating.enabled': input.config?.rating?.enabled,
      'commission.strategy': input.config?.commission?.strategy,
      'commission.enabled': input.config?.commission?.enabled,
      'commission.minSessions': numberParam(input.config?.commission?.params ?? {}, 'minSessions', 0),
      ...input.metadata,
    };
  }

  /**
   * Create empty salary component
   * @private
   */
  private createEmptyComponent(
    type: SalaryComponent['type'],
    reason: string
  ): SalaryComponent {
    return {
      type,
      eligible: false,
      amount: 0,
      reason,
      metadata: {},
    };
  }

  private getMatchedRules(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((rule): rule is string => typeof rule === 'string') : [];
  }

  /**
   * Apply manual overrides
   * @private
   */
  private applyManualOverrides(
    input: PayrollDecisionInput,
    overrides: Record<string, number>,
    startTime: number
  ): PayrollDecisionOutput {
    const kpiBonus = this.createComponent(
      'kpi-bonus',
      overrides.kpiBonus || 0,
      'Manual override applied'
    );
    const attendanceDeduction = this.createComponent(
      'attendance-deduction',
      overrides.attendanceDeduction || 0,
      'Manual override applied'
    );
    const ratingBonus = this.createComponent(
      'rating-bonus',
      overrides.ratingBonus || 0,
      'Manual override applied'
    );
    const sessionCommission = this.createComponent(
      'session-commission',
      overrides.sessionCommission || 0,
      'Manual override applied'
    );

    const totalBonuses =
      Math.max(0, kpiBonus.amount) +
      Math.max(0, ratingBonus.amount) +
      Math.max(0, sessionCommission.amount);
    const totalDeductions = Math.abs(Math.min(0, attendanceDeduction.amount));
    const netAdjustment = totalBonuses - totalDeductions;

    const endTime = performance.now();
    const executionTime = Number((endTime - startTime).toFixed(2));

    return {
      eligible: true,
      totalBonuses,
      totalDeductions,
      netAdjustment,
      components: {
        kpiBonus,
        attendanceDeduction,
        ratingBonus,
        sessionCommission,
      },
      matchedRules: [],
      executionTime,
      provider: 'PayrollProvider',
      confidence: 1.0,
      reason: 'Manual overrides applied',
    };
  }

  /**
   * Create salary component with amount
   * @private
   */
  private createComponent(
    type: SalaryComponent['type'],
    amount: number,
    reason: string
  ): SalaryComponent {
    return {
      type,
      eligible: amount !== 0,
      amount,
      reason,
      metadata: { override: true },
    };
  }

  /**
   * Create policy from rules
   * @private
   */
  private createPolicy(id: string, name: string, rules: Rule[]): Policy {
    // RuleReasoner evaluates rules in ASCENDING priority order
    // Payroll rules already have correct priority order (200-350)
    // No need to invert like DiscountProvider
    return {
      id: `payroll-${id}-policy`,
      version: '1.0.0',
      name,
      description: `Evaluates ${id} salary component using rule-based logic`,
      rules: rules.map((rule) => ({
        id: rule.id,
        priority: rule.priority,
        conditions: this.convertConditionToReasoner(rule.condition),
        action: {
          outcome: 'APPROVE',
          reason: rule.name,
        },
      })),
    };
  }

  /**
   * Convert Platform Rule condition to RuleReasoner condition
   * @private
   */
  private convertConditionToReasoner(condition: RuleCondition): Condition {
    if (typeof condition === 'function') {
      throw new Error('Function-based payroll rule conditions cannot be converted to RuleReasoner conditions');
    }

    if (condition.type === 'simple') {
      return {
        type: 'comparison',
        field: condition.field,
        operator: this.mapOperator(condition.operator),
        value: condition.value,
      };
    }

    if (condition.type === 'all') {
      return {
        type: 'operator',
        operator: 'and',
        conditions: condition.conditions.map((c) =>
          this.convertConditionToReasoner(c)
        ),
      };
    }

    if (condition.type === 'any') {
      return {
        type: 'operator',
        operator: 'or',
        conditions: condition.conditions.map((c) =>
          this.convertConditionToReasoner(c)
        ),
      };
    }

    throw new Error(`Unsupported condition type: ${condition.type}`);
  }

  /**
   * Map Platform operator to RuleReasoner operator
   * @private
   */
  private mapOperator(operator: string): ReasonerComparisonOperator {
    const operatorMap: Record<string, ReasonerComparisonOperator> = {
      equals: '===',
      notEquals: '!==',
      greaterThan: '>',
      greaterThanOrEqual: '>=',
      lessThan: '<',
      lessThanOrEqual: '<=',
    };

    return operatorMap[operator] || '===';
  }
}
