export interface AgentProfile {
  readonly agentId: string;
  readonly role: 'junior' | 'senior' | 'director';
  readonly seniorityMonths: number;
}

export interface SaleContext {
  readonly contractPrice: number;
  readonly leadCreatedDate: Date;
  readonly contractSignedDate: Date;
}

export class CommissionCalculator {
  /**
   * Calculate agent sales commission details
   */
  public calculateCommission(agent: AgentProfile, sale: SaleContext): {
    readonly baseCommission: number;
    readonly seniorityBonus: number;
    readonly speedBonus: number;
    readonly totalCommission: number;
  } {
    // 1. Base rate
    let commissionRate = 0.01; // 1% default

    if (agent.role === 'senior') {
      commissionRate = 0.015; // 1.5% for seniors
    } else if (agent.role === 'director') {
      commissionRate = 0.02; // 2% for directors
    }

    const baseCommission = sale.contractPrice * commissionRate;

    // 2. Seniority bonus: 1,000,000 VND for every 12 months on the job
    const years = Math.floor(agent.seniorityMonths / 12);
    const seniorityBonus = years * 1000000;

    // 3. Speed bonus: 10,000,000 VND flat if closed within 7 days
    const diffTime = Math.abs(sale.contractSignedDate.getTime() - sale.leadCreatedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const speedBonus = diffDays <= 7 ? 10000000 : 0;

    const totalCommission = baseCommission + seniorityBonus + speedBonus;

    return {
      baseCommission,
      seniorityBonus,
      speedBonus,
      totalCommission,
    };
  }
}
