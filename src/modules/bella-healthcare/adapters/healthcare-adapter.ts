import type { IndustryFinanceAdapter, IndustryPayrollAdapter, IndustryAccountingAdapter } from '@/core/adapters/industry-adapter';

// ─────────────────────────────────────────────────────────────────────────────
// Types & ViewModels for Healthcare Workspace
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthcareFinanceVM {
  monthYear: string;
  treatmentRevenue: number;
  clinicOperatingExpense: number;
  doctorSalaryExpense: number;
  clinicNetProfit: number;
  profitMarginPercent: number;
}

export interface HealthcareTransactionVM {
  id: string;
  type: 'revenue' | 'expense';
  amount: number;
  paymentMethod: string;
  timestamp: string;
  description: string;
  status: string;
}

export interface HealthcarePayrollVM {
  employeeId: string;
  employeeName: string;
  role: 'doctor' | 'nurse' | 'assistant';
  positionTier: string;
  hireDate: string;
  baseSalary: number;
  procedureBonus: number;
  totalSalary: number;
  status: string;
}

export interface HealthcareAccountingVM {
  id: string;
  eventName: string;
  timestamp: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  referenceType: string;
  referenceId: string;
}

const getString = (dto: Record<string, unknown>, key: string, fallback: string): string => {
  const value = dto[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const getNumber = (dto: Record<string, unknown>, key: string, fallback: number): number => {
  const value = dto[key];
  return typeof value === 'number' ? value : fallback;
};

const firstString = (dto: Record<string, unknown>, keys: string[], fallback: string): string => {
  for (const key of keys) {
    const value = dto[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return fallback;
};

const firstNumber = (dto: Record<string, unknown>, keys: string[], fallback: number): number => {
  for (const key of keys) {
    const value = dto[key];
    if (typeof value === 'number') {
      return value;
    }
  }

  return fallback;
};

const requireString = (dto: Record<string, unknown>, key: string): string => {
  const value = dto[key];
  if (typeof value !== 'string') {
    throw new Error(`Healthcare adapter expected ${key} to be a string`);
  }

  return value;
};

const requireNumber = (dto: Record<string, unknown>, key: string): number => {
  const value = dto[key];
  if (typeof value !== 'number') {
    throw new Error(`Healthcare adapter expected ${key} to be a number`);
  }

  return value;
};

const getTransactionType = (dto: Record<string, unknown>): 'revenue' | 'expense' => {
  const value = dto.type;
  if (value !== 'revenue' && value !== 'expense') {
    throw new Error('Healthcare adapter expected transaction type to be revenue or expense');
  }

  return value;
};

// ─────────────────────────────────────────────────────────────────────────────
// Healthcare Adapter Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class HealthcareFinanceAdapter implements IndustryFinanceAdapter<Record<string, unknown>, HealthcareFinanceVM> {
  map(dto: Record<string, unknown>): HealthcareFinanceVM {
    return {
      monthYear: firstString(dto, ['month', 'month_year'], ''),
      treatmentRevenue: firstNumber(dto, ['totalRevenue', 'total_revenue'], 0),
      clinicOperatingExpense: firstNumber(dto, ['operatingExpense', 'total_operating_expenses'], 0),
      doctorSalaryExpense: firstNumber(dto, ['salaryExpense', 'total_ktv_salaries'], 0),
      clinicNetProfit: firstNumber(dto, ['netProfit', 'net_profit'], 0),
      profitMarginPercent: firstNumber(dto, ['netMarginPct', 'profit_margin_pct'], 0),
    };
  }

  mapTransaction(dto: Record<string, unknown>): HealthcareTransactionVM {
    // Translate payment method and status labels if needed
    const methodLabels: Record<string, string> = {
      bank_transfer: 'Chuyển khoản',
      cash: 'Tiền mặt',
      credit_card: 'Thẻ tín dụng',
    };

    const paymentMethod = getString(dto, 'paymentMethod', '');

    return {
      id: requireString(dto, 'id'),
      type: getTransactionType(dto),
      amount: requireNumber(dto, 'amount'),
      paymentMethod: methodLabels[paymentMethod] || paymentMethod || 'Khác',
      timestamp: firstString(dto, ['timestamp', 'occurredAt', 'receivedDate'], ''),
      description: firstString(dto, ['description', 'notes'], 'Không có mô tả'),
      status: dto.status === 'confirmed' || dto.status === 'approved' || dto.status === 'paid' ? 'Đã xác nhận' : 'Chờ xử lý',
    };
  }
}

export class HealthcarePayrollAdapter implements IndustryPayrollAdapter<Record<string, unknown>, HealthcarePayrollVM> {
  map(dto: Record<string, unknown>): HealthcarePayrollVM {
    // Determine healthcareRole based on database role, name prefix or email pattern
    let healthcareRole: 'doctor' | 'nurse' | 'assistant' = 'assistant';
    const fullName = getString(dto, 'full_name', '');
    const email = getString(dto, 'email', '');

    if (dto.role === 'ktv_lead' || fullName.includes('BS.') || email.includes('doctor')) {
      healthcareRole = 'doctor';
    } else if (fullName.includes('Điều dưỡng') || email.includes('nurse')) {
      healthcareRole = 'nurse';
    } else if (fullName.includes('Trợ lý') || fullName.includes('phụ tá') || fullName.includes('Vy')) {
      healthcareRole = 'assistant';
    }

    // Generate descriptive position tier label based on resolved role and tier level
    let positionTierLabel = 'Thành viên';
    const tier = firstString(dto, ['positionTier', 'position_tier'], 'junior');

    if (healthcareRole === 'doctor') {
      if (tier === 'lead') positionTierLabel = 'Bác sĩ Trưởng khoa';
      else if (tier === 'senior') positionTierLabel = 'Bác sĩ Chuyên gia';
      else positionTierLabel = 'Bác sĩ Điều trị';
    } else if (healthcareRole === 'nurse') {
      if (tier === 'lead') positionTierLabel = 'Điều dưỡng Trưởng';
      else if (tier === 'senior') positionTierLabel = 'Điều dưỡng Chính';
      else positionTierLabel = 'Điều dưỡng viên';
    } else {
      if (tier === 'lead') positionTierLabel = 'Trợ lý Trưởng';
      else if (tier === 'senior') positionTierLabel = 'Trợ lý chính';
      else positionTierLabel = 'Trợ lý phụ tá';
    }

    return {
      employeeId: firstString(dto, ['id', 'ktv_id'], ''),
      employeeName: fullName || 'Nhân viên y tế',
      role: healthcareRole,
      positionTier: positionTierLabel,
      hireDate: getString(dto, 'hire_date', ''),
      baseSalary: getNumber(dto, 'base_salary', 0),
      procedureBonus: firstNumber(dto, ['service_percentage_bonus', 'session_bonus'], 0),
      totalSalary: getNumber(dto, 'total_salary', 0),
      status: getString(dto, 'status', 'draft'),
    };
  }
}

export class HealthcareAccountingAdapter implements IndustryAccountingAdapter<Record<string, unknown>, HealthcareAccountingVM> {
  map(dto: Record<string, unknown>): HealthcareAccountingVM {
    // Map Platform accounting outbox events to standard healthcare events
    const eventNameMap: Record<string, string> = {
      SESSION_DONE: 'Encounter.Completed.v1',
      PACKAGE_SALE: 'Invoice.Issued.v1',
      SESSION_COMPLETED: 'Encounter.Completed.v1',
      REVENUE_CONFIRMED: 'Payment.Received.v1',
    };

    return {
      id: dto.id,
      eventName: eventNameMap[dto.event_type] || dto.event_type || 'Unknown.Event.v1',
      timestamp: dto.created_at || dto.occurred_at || '',
      description: dto.payload?.description || dto.description || 'Đồng bộ bút toán y khoa',
      status: dto.status || 'pending',
      referenceType: dto.reference_type || '',
      referenceId: dto.reference_id || '',
    };
  }
}
