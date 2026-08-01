/**
 * Real Estate AI Skills — Platform AI Orchestrator Registration
 *
 * Registers three domain-specific AI skills for the Real Estate vertical:
 *   - RealEstateCustomerSkill: customer intent analysis, segmentation, churn risk
 *   - RealEstateCalculatorSkill: affordability, installment, LTV calculation
 *   - RealEstateExecutiveSkill: portfolio KPI, deviation alerts, strategic recommendations
 *
 * ISOLATION: These skills are ONLY loadable when manifest.enabledCapabilities includes 'real_estate_ai'.
 * Legacy tenants (beauty_spa, babycare) are unaffected.
 */

export interface AISkillContext {
  tenantId: string;
  userId: string;
  locale?: string;
}

export interface AISkillInput {
  intent: string;
  data?: Record<string, unknown>;
}

export interface AISkillOutput {
  skill: string;
  summary: string;
  result: Record<string, unknown>;
  recommendations?: string[];
}

// ─── Skill 1: Customer Intelligence ─────────────────────────────────────────

export const RealEstateCustomerSkill = {
  name: 'RealEstateCustomerSkill',
  description: 'Phân tích hành vi khách hàng đầu tư BĐS: phân khúc, mức độ quan tâm, rủi ro churn, gợi ý tiếp cận.',
  version: '1.0.0',

  canHandle(intent: string): boolean {
    const lower = intent.toLowerCase();
    return (
      lower.includes('khách hàng') ||
      lower.includes('lead') ||
      lower.includes('phân khúc') ||
      lower.includes('churn') ||
      lower.includes('tiếp cận') ||
      lower.includes('investor') ||
      lower.includes('buyer profile') ||
      lower.includes('customer segment')
    );
  },

  async run(ctx: AISkillContext, input: AISkillInput): Promise<AISkillOutput> {
    const { data } = input;

    // Compute derived signals from lead data payload
    const leads = (data?.leads as Array<{ status: string; last_activity_days?: number }>) ?? [];
    const coldLeads = leads.filter(l => (l.last_activity_days ?? 0) > 14 && !['closed_won', 'closed_lost'].includes(l.status));
    const hotLeads = leads.filter(l => ['site_visit', 'negotiation'].includes(l.status));
    const churnRisk = leads.filter(l => (l.last_activity_days ?? 0) > 30 && l.status !== 'closed_won');

    const recommendations: string[] = [
      `Có ${hotLeads.length} lead đang trong giai đoạn nóng (tham quan/đàm phán) — ưu tiên follow-up trong 24h.`,
      coldLeads.length > 0 ? `${coldLeads.length} lead nguội (14+ ngày chưa liên hệ) — cần kích hoạt lại qua chiến dịch nurture email/Zalo ZNS.` : 'Tất cả lead đang được chăm sóc tốt.',
      churnRisk.length > 0 ? `⚠ ${churnRisk.length} lead có rủi ro churn cao (30+ ngày không hoạt động) — cần phân công lại cho sale phụ trách.` : 'Không có rủi ro churn đáng kể.',
    ];

    return {
      skill: 'RealEstateCustomerSkill',
      summary: `Phân tích ${leads.length} leads: ${hotLeads.length} nóng, ${coldLeads.length} nguội, ${churnRisk.length} rủi ro churn.`,
      result: {
        total_leads: leads.length,
        hot_leads: hotLeads.length,
        cold_leads: coldLeads.length,
        churn_risk: churnRisk.length,
        context: ctx.tenantId,
      },
      recommendations,
    };
  }
};

// ─── Skill 2: Financial Calculator ──────────────────────────────────────────

export const RealEstateCalculatorSkill = {
  name: 'RealEstateCalculatorSkill',
  description: 'Tính toán khả năng tài chính: trả góp, tiến độ thanh toán, hỗ trợ lãi suất, LTV, affordability.',
  version: '1.0.0',

  canHandle(intent: string): boolean {
    const lower = intent.toLowerCase();
    return (
      lower.includes('tính toán') ||
      lower.includes('trả góp') ||
      lower.includes('tiến độ') ||
      lower.includes('thanh toán') ||
      lower.includes('lãi suất') ||
      lower.includes('ltv') ||
      lower.includes('affordability') ||
      lower.includes('installment') ||
      lower.includes('mortgage')
    );
  },

  calculateMonthlyPayment(params: {
    principal: number;
    annualRatePct: number;
    termMonths: number;
  }): number {
    const { principal, annualRatePct, termMonths } = params;
    if (annualRatePct === 0) return principal / termMonths;
    const r = annualRatePct / 100 / 12;
    return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
  },

  async run(_ctx: AISkillContext, input: AISkillInput): Promise<AISkillOutput> {
    const d = input.data ?? {};
    const unitPrice = Number(d.unit_price ?? 3_500_000_000);
    const depositRatePct = Number(d.deposit_rate_pct ?? 30);
    const loanRatePct = Number(d.loan_rate_pct ?? 8.5);
    const termYears = Number(d.term_years ?? 20);

    const depositAmount = unitPrice * (depositRatePct / 100);
    const loanAmount = unitPrice - depositAmount;
    const monthlyPayment = this.calculateMonthlyPayment({
      principal: loanAmount,
      annualRatePct: loanRatePct,
      termMonths: termYears * 12,
    });
    const ltv = Math.round((loanAmount / unitPrice) * 100);
    const totalInterest = monthlyPayment * termYears * 12 - loanAmount;

    const recommendations = [
      `Với vốn vay ${(loanAmount / 1e9).toFixed(2)} tỷ VNĐ (${100 - depositRatePct}% giá trị), khoản trả góp hàng tháng ≈ ${(monthlyPayment / 1e6).toFixed(1)} triệu VNĐ/tháng (lãi ${loanRatePct}%/năm, ${termYears} năm).`,
      `LTV ${ltv}% — ${ltv <= 70 ? '✅ Trong hạn mức ngân hàng thông thường (<= 70%).' : '⚠ Vượt hạn mức LTV tiêu chuẩn, ngân hàng có thể yêu cầu bảo lãnh thêm.'}`,
      `Tổng lãi phát sinh trong ${termYears} năm: ${(totalInterest / 1e9).toFixed(2)} tỷ VNĐ — khuyến nghị thanh toán sớm để giảm lãi.`,
    ];

    return {
      skill: 'RealEstateCalculatorSkill',
      summary: `Tính toán tài chính cho căn hộ ${(unitPrice / 1e9).toFixed(2)} tỷ: góp ${(monthlyPayment / 1e6).toFixed(1)}tr/tháng trong ${termYears} năm.`,
      result: {
        unit_price_vnd: unitPrice,
        deposit_amount_vnd: depositAmount,
        loan_amount_vnd: loanAmount,
        monthly_payment_vnd: Math.round(monthlyPayment),
        total_interest_vnd: Math.round(totalInterest),
        ltv_pct: ltv,
        term_months: termYears * 12,
      },
      recommendations,
    };
  }
};

// ─── Skill 3: Executive Portfolio AI ─────────────────────────────────────────

export const RealEstateExecutiveSkill = {
  name: 'RealEstateExecutiveSkill',
  description: 'Tổng hợp KPI danh mục dự án, cảnh báo lệch kế hoạch, gợi ý chiến lược cho Ban Giám Đốc BĐS.',
  version: '1.0.0',

  canHandle(intent: string): boolean {
    const lower = intent.toLowerCase();
    return (
      lower.includes('tổng quan') ||
      lower.includes('kpi') ||
      lower.includes('danh mục') ||
      lower.includes('portfolio') ||
      lower.includes('chiến lược') ||
      lower.includes('executive') ||
      lower.includes('bất động sản') ||
      lower.includes('dự án')
    );
  },

  async run(_ctx: AISkillContext, input: AISkillInput): Promise<AISkillOutput> {
    const snapshot = input.data as {
      projects_count?: number;
      total_products?: number;
      available_count?: number;
      deposited_count?: number;
      signed_count?: number;
      total_portfolio_value_billions?: string;
      sold_portfolio_value_billions?: string;
    } | undefined;

    const totalProducts = snapshot?.total_products ?? 0;
    const availableCount = snapshot?.available_count ?? 0;
    const soldValue = parseFloat(snapshot?.sold_portfolio_value_billions ?? '0');
    const totalValue = parseFloat(snapshot?.total_portfolio_value_billions ?? '0');
    const absorptionRate = totalProducts > 0 ? Math.round(((totalProducts - availableCount) / totalProducts) * 100) : 0;
    const revenueVelocityPct = totalValue > 0 ? Math.round((soldValue / totalValue) * 100) : 0;

    const recommendations: string[] = [
      `Tỷ lệ hấp thụ bảng hàng đạt ${absorptionRate}% — ${absorptionRate >= 70 ? '✅ Vượt ngưỡng tốt (>70%). Cân nhắc mở bán block mới.' : absorptionRate >= 40 ? '⚠ Ở mức trung bình (40-70%). Tăng cường hoạt động marketing.' : '❌ Thấp (<40%). Cần xem xét lại chiến lược định giá và bán hàng.'}`,
      `Tỷ lệ giao dịch doanh thu trên tổng danh mục: ${revenueVelocityPct}% — ${revenueVelocityPct >= 60 ? 'Rất tích cực.' : 'Cần đẩy nhanh chốt hợp đồng.'}`,
      `Quản lý ${snapshot?.projects_count ?? 0} dự án với ${totalProducts} sản phẩm tổng — duy trì đà bán hàng và kiểm soát tiến độ pháp lý tại từng dự án.`,
    ];

    return {
      skill: 'RealEstateExecutiveSkill',
      summary: `Portfolio ${snapshot?.projects_count ?? 0} dự án: hấp thụ ${absorptionRate}%, đã giao dịch ${revenueVelocityPct}% giá trị danh mục.`,
      result: {
        projects_count: snapshot?.projects_count ?? 0,
        total_products: totalProducts,
        available_count: availableCount,
        absorption_rate_pct: absorptionRate,
        revenue_velocity_pct: revenueVelocityPct,
        sold_value_billions: soldValue,
        total_value_billions: totalValue,
      },
      recommendations,
    };
  }
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const REAL_ESTATE_AI_SKILLS = [
  RealEstateCustomerSkill,
  RealEstateCalculatorSkill,
  RealEstateExecutiveSkill,
] as const;

export type RealEstateSkillName =
  | 'RealEstateCustomerSkill'
  | 'RealEstateCalculatorSkill'
  | 'RealEstateExecutiveSkill';

/**
 * Route an intent to the most appropriate Real Estate skill.
 * Returns null if no skill can handle the intent.
 */
export function routeRealEstateSkill(intent: string) {
  for (const skill of REAL_ESTATE_AI_SKILLS) {
    if (skill.canHandle(intent)) return skill;
  }
  return null;
}
