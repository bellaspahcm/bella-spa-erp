import type { IndustryFinanceAdapter, IndustryPayrollAdapter, IndustryAccountingAdapter } from '@/core/adapters/industry-adapter';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function firstString(dto: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = dto[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return fallback;
}

function firstNumber(dto: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = dto[key];
    if (typeof value === 'number') return value;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Healthcare Adapter Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class HealthcareFinanceAdapter implements IndustryFinanceAdapter<Record<string, unknown>, HealthcareFinanceVM> {
  map(dto: Record<string, unknown>): HealthcareFinanceVM {
    return {
      monthYear: firstString(dto, ['month', 'month_year']),
      treatmentRevenue: firstNumber(dto, ['totalRevenue', 'total_revenue']),
      clinicOperatingExpense: firstNumber(dto, ['operatingExpense', 'total_operating_expenses']),
      doctorSalaryExpense: firstNumber(dto, ['salaryExpense', 'total_ktv_salaries']),
      clinicNetProfit: firstNumber(dto, ['netProfit', 'net_profit']),
      profitMarginPercent: firstNumber(dto, ['netMarginPct', 'profit_margin_pct']),
    };
  }

  mapTransaction(dto: Record<string, unknown>): HealthcareTransactionVM {
    // Translate payment method and status labels if needed
    const methodLabels: Record<string, string> = {
      bank_transfer: 'Chuyển khoản',
      cash: 'Tiền mặt',
      credit_card: 'Thẻ tín dụng',
    };

    const paymentMethod = firstString(dto, ['paymentMethod', 'payment_method'], 'Khác');
    const transactionType = dto.type === 'revenue' || dto.type === 'expense' ? dto.type : 'expense';

    return {
      id: asString(dto.id),
      type: transactionType,
      amount: asNumber(dto.amount),
      paymentMethod: methodLabels[paymentMethod] || paymentMethod,
      timestamp: firstString(dto, ['timestamp', 'occurredAt', 'receivedDate']),
      description: firstString(dto, ['description', 'notes'], 'Không có mô tả'),
      status: dto.status === 'confirmed' || dto.status === 'approved' || dto.status === 'paid' ? 'Đã xác nhận' : 'Chờ xử lý',
    };
  }
}

export class HealthcarePayrollAdapter implements IndustryPayrollAdapter<Record<string, unknown>, HealthcarePayrollVM> {
  map(dto: Record<string, unknown>): HealthcarePayrollVM {
    // Determine healthcareRole based on database role, name prefix or email pattern
    let healthcareRole: 'doctor' | 'nurse' | 'assistant' = 'assistant';
    const fullName = asString(dto.full_name);
    const email = asString(dto.email);

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
      employeeId: firstString(dto, ['id', 'ktv_id']),
      employeeName: fullName || 'Nhân viên y tế',
      role: healthcareRole,
      positionTier: positionTierLabel,
      hireDate: asString(dto.hire_date),
      baseSalary: asNumber(dto.base_salary),
      procedureBonus: firstNumber(dto, ['service_percentage_bonus', 'session_bonus']),
      totalSalary: asNumber(dto.total_salary),
      status: asString(dto.status, 'draft'),
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

    const eventType = asString(dto.event_type, 'Unknown.Event.v1');
    const payload = asRecord(dto.payload);
    const status = dto.status === 'completed' || dto.status === 'failed' ? dto.status : 'pending';

    return {
      id: asString(dto.id),
      eventName: eventNameMap[eventType] || eventType,
      timestamp: firstString(dto, ['created_at', 'occurred_at']),
      description: asString(payload.description, firstString(dto, ['description'], 'Đồng bộ bút toán y khoa')),
      status,
      referenceType: asString(dto.reference_type),
      referenceId: asString(dto.reference_id),
    };
  }
}
