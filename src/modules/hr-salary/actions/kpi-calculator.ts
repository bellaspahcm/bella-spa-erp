export interface SalaryConfig {
  bonus_5_star: number;
  bonus_4_5_star: number;
  bonus_4_star: number;
  kpi_target_sessions: number;
  kpi_bonus_amount: number;
}

export function calculateSalaryDetails(
  sessionsCount: number,
  avgRating: number,
  salaryConfig: SalaryConfig,
  rawBaseSalary: number,
  deductions: number = 0,
  advances: number = 0,
  sessionBonus: number = 0,
  existingKpiBonus?: number
) {
  // Rating bonus calculation
  let bonusPerSession = 0;
  if (avgRating === 5.0) bonusPerSession = salaryConfig.bonus_5_star;
  else if (avgRating >= 4.5) bonusPerSession = salaryConfig.bonus_4_5_star;
  else if (avgRating >= 4.0) bonusPerSession = salaryConfig.bonus_4_star;
  
  const ratingBonus = sessionsCount * bonusPerSession;

  // KPI bonus calculation
  let kpiBonus = existingKpiBonus !== undefined 
    ? existingKpiBonus 
    : (sessionsCount >= salaryConfig.kpi_target_sessions ? salaryConfig.kpi_bonus_amount : 0);

  // Total calculation
  let totalSalary = rawBaseSalary + sessionBonus + ratingBonus + kpiBonus - deductions - advances;
  
  if (totalSalary < 0) totalSalary = 0;

  return {
    bonusPerSession,
    ratingBonus,
    kpiBonus,
    totalSalary
  };
}
