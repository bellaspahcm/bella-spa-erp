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

// ─────────────────────────────────────────────────────────────────────────────
// Healthcare Adapter Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class HealthcareFinanceAdapter implements IndustryFinanceAdapter<Record<string, unknown>, HealthcareFinanceVM> {
  map(dto: Record<string, unknown>): HealthcareFinanceVM {
    return {
      monthYear: dto.month || dto.month_year || '',
      treatmentRevenue: dto.totalRevenue || dto.total_revenue || 0,
      clinicOperatingExpense: dto.operatingExpense || dto.total_operating_expenses || 0,
      doctorSalaryExpense: dto.salaryExpense || dto.total_ktv_salaries || 0,
      clinicNetProfit: dto.netProfit || dto.net_profit || 0,
      profitMarginPercent: dto.netMarginPct || dto.profit_margin_pct || 0,
    };
  }

  mapTransaction(dto: Record<string, unknown>): HealthcareTransactionVM {
    // Translate payment method and status labels if needed
    const methodLabels: Record<string, string> = {
      bank_transfer: 'Chuyển khoản',
      cash: 'Tiền mặt',
      credit_card: 'Thẻ tín dụng',
    };

    return {
      id: dto.id,
      type: dto.type,
      amount: dto.amount,
      paymentMethod: methodLabels[dto.paymentMethod] || dto.paymentMethod || 'Khác',
      timestamp: dto.timestamp || dto.occurredAt || dto.receivedDate || '',
      description: dto.description || dto.notes || 'Không có mô tả',
      status: dto.status === 'confirmed' || dto.status === 'approved' || dto.status === 'paid' ? 'Đã xác nhận' : 'Chờ xử lý',
    };
  }
}

export class HealthcarePayrollAdapter implements IndustryPayrollAdapter<Record<string, unknown>, HealthcarePayrollVM> {
  map(dto: Record<string, unknown>): HealthcarePayrollVM {
    // Determine healthcareRole based on database role, name prefix or email pattern
    let healthcareRole: 'doctor' | 'nurse' | 'assistant' = 'assistant';
    const fullName = dto.full_name || '';
    const email = dto.email || '';

    if (dto.role === 'ktv_lead' || fullName.includes('BS.') || email.includes('doctor')) {
      healthcareRole = 'doctor';
    } else if (fullName.includes('Điều dưỡng') || email.includes('nurse')) {
      healthcareRole = 'nurse';
    } else if (fullName.includes('Trợ lý') || fullName.includes('phụ tá') || fullName.includes('Vy')) {
      healthcareRole = 'assistant';
    }

    // Generate descriptive position tier label based on resolved role and tier level
    let positionTierLabel = 'Thành viên';
    const tier = dto.positionTier || dto.position_tier || 'junior';

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
      employeeId: dto.id || dto.ktv_id || '',
      employeeName: fullName || 'Nhân viên y tế',
      role: healthcareRole,
      positionTier: positionTierLabel,
      hireDate: dto.hire_date || '',
      baseSalary: dto.base_salary || 0,
      procedureBonus: dto.service_percentage_bonus || dto.session_bonus || 0,
      totalSalary: dto.total_salary || 0,
      status: dto.status || 'draft',
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
