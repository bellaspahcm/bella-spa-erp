import { calculateSalaryDetails, SalaryConfig } from '../modules/hr-salary/actions/kpi-calculator';

const defaultConfig: SalaryConfig = {
  bonus_5_star: 50000,
  bonus_4_5_star: 30000,
  bonus_4_star: 10000,
  kpi_target_sessions: 30,
  kpi_bonus_amount: 1000000,
};

describe('calculateSalaryDetails — Rating Bonus', () => {
  it('5-star rating gives max bonus (50,000đ) per session', () => {
    const result = calculateSalaryDetails(10, 5.0, defaultConfig, 6000000, 0, 0, 0);
    expect(result.bonusPerSession).toBe(50000);
    expect(result.ratingBonus).toBe(500000); // 10 sessions × 50,000
  });

  it('4.5-star rating gives mid bonus (30,000đ) per session', () => {
    const result = calculateSalaryDetails(10, 4.5, defaultConfig, 6000000, 0, 0, 0);
    expect(result.bonusPerSession).toBe(30000);
    expect(result.ratingBonus).toBe(300000);
  });

  it('4.0-star rating gives low bonus (10,000đ) per session', () => {
    const result = calculateSalaryDetails(10, 4.0, defaultConfig, 6000000, 0, 0, 0);
    expect(result.bonusPerSession).toBe(10000);
    expect(result.ratingBonus).toBe(100000);
  });

  it('Below 4-star rating gives 0 bonus per session', () => {
    const result = calculateSalaryDetails(10, 3.5, defaultConfig, 6000000, 0, 0, 0);
    expect(result.bonusPerSession).toBe(0);
    expect(result.ratingBonus).toBe(0);
  });

  it('Null rating (chưa có review hoặc chấm công nào trong tháng) gives 0 bonus', () => {
    const result = calculateSalaryDetails(10, null, defaultConfig, 6000000, 0, 0, 0);
    expect(result.bonusPerSession).toBe(0);
    expect(result.ratingBonus).toBe(0);
  });
});

describe('calculateSalaryDetails — KPI Bonus', () => {
  it('KTV đạt đúng target (30 ca) nhận KPI bonus', () => {
    const result = calculateSalaryDetails(30, 5.0, defaultConfig, 6000000);
    expect(result.kpiBonus).toBe(1000000);
  });

  it('KTV dưới target (29 ca) không nhận KPI bonus', () => {
    const result = calculateSalaryDetails(29, 5.0, defaultConfig, 6000000);
    expect(result.kpiBonus).toBe(0);
  });

  it('KPI bonus được override bởi existingKpiBonus', () => {
    const result = calculateSalaryDetails(5, 5.0, defaultConfig, 6000000, 0, 0, 0, 500000);
    expect(result.kpiBonus).toBe(500000);
  });
});

describe('calculateSalaryDetails — Total Salary', () => {
  it('Tổng lương tính đúng: base + session + rating + kpi - deductions - advances', () => {
    const result = calculateSalaryDetails(
      35,       // sessionsCount — đủ KPI
      5.0,      // avgRating — max
      defaultConfig,
      6000000,  // rawBaseSalary
      200000,   // deductions
      300000,   // advances
      2000000,  // sessionBonus
    );
    // expected = 6,000,000 + 2,000,000 + (35*50,000) + 1,000,000 - 200,000 - 300,000
    //          = 6,000,000 + 2,000,000 + 1,750,000 + 1,000,000 - 500,000
    //          = 10,250,000
    expect(result.totalSalary).toBe(10250000);
  });

  it('Tổng lương không âm — luôn >= 0', () => {
    const result = calculateSalaryDetails(0, 5.0, defaultConfig, 6000000, 10000000, 0, 0);
    expect(result.totalSalary).toBeGreaterThanOrEqual(0);
  });

  it('Violations deduction giảm lương đúng', () => {
    const result = calculateSalaryDetails(0, 5.0, defaultConfig, 6000000, 500000, 0, 0);
    expect(result.totalSalary).toBe(5500000);
  });
});
