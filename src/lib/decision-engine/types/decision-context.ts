/**
 * Universal Decision Context
 * 
 * This context structure is reusable across ALL decision providers:
 * - Payroll (salary calculations)
 * - Booking (availability, pricing, discounts)
 * - Workflow (approval routing, escalations)
 * - AI (recommendations, predictions)
 * - BI (analytics, reporting)
 * 
 * Design Philosophy:
 * - Core fields are always present (tenant, user, timestamp)
 * - Domain-specific data is attached dynamically (employee, attendance, sessions, etc.)
 * - Overrides allow A/B testing and admin adjustments
 */

/**
 * Core Decision Context
 * 
 * All decision providers receive this context.
 * Domain-specific providers extend this with additional fields.
 */
export interface DecisionContext {
  /** Tenant identifier for multi-tenancy isolation */
  tenantId: string;

  /** User/Employee/Customer ID (context-dependent) */
  userId: string;

  /** Timestamp when decision is being evaluated (ISO 8601) */
  timestamp: string;

  /** Optional session/request ID for tracing */
  sessionId?: string;

  /** Optional metadata for extensibility */
  metadata?: Record<string, any>;

  /** Manual overrides for A/B testing or admin adjustments */
  overrides?: Record<string, any>;
}

/**
 * Employee Data (Payroll Context)
 */
export interface EmployeeData {
  id: string;
  fullName: string | null;
  
  /** Base monthly salary */
  baseSalary: number | null;
  
  /** Position tier (for position-based bonuses/multipliers) */
  positionTier?: 'junior' | 'senior' | 'lead' | 'manager';
  
  /** Employment type */
  contractType?: 'full-time' | 'part-time' | 'contract' | 'intern';
  
  /** Hire date (for seniority calculations) */
  hireDate: string | null;
  
  /** Resignation date (for pro-rata cap) */
  resignationDate: string | null;
  
  /** Probation end date */
  probationEndDate?: string | null;
  
  /** Current employment status */
  status?: 'active' | 'probation' | 'resigned' | 'terminated';
}

/**
 * Attendance Data (Payroll Context)
 */
export interface AttendanceData {
  /** Total working days in the period */
  totalDays: number;
  
  /** Days present (on-time) */
  presentDays: number;
  
  /** Days late */
  lateDays: number;
  
  /** Days absent (unexcused) */
  absentDays: number;
  
  /** Half-days worked */
  halfDays: number;
  
  /** Approved leave days (not penalized) */
  approvedLeaveDays?: number;
  
  /** Raw attendance logs (for detailed penalty calculations) */
  logs?: Array<{
    date: string;
    status: 'present' | 'late' | 'absent' | 'half_day' | 'leave';
  }>;
}

/**
 * Session Data (Payroll Context for KTV/Service Staff)
 */
export interface SessionData {
  /** Total completed sessions in period */
  count: number;
  
  /** Weighted session count (package multipliers applied) */
  weightedCount?: number;
  
  /** Average rating across all sessions */
  avgRating: number | null;
  
  /** Rating distribution */
  ratingBreakdown?: {
    fiveStars: number;
    fourHalfStars: number;
    fourStars: number;
    belowFour: number;
  };
  
  /** Raw session logs (for commission calculations) */
  logs?: Array<{
    id: string;
    packageName: string | null;
    rating: number | null;
    commission: number | null;
  }>;
}

/**
 * Sales Data (Payroll Context for Commission Calculations)
 */
export interface SalesData {
  /** Total service sales in period */
  serviceSales: number;
  
  /** Number of service items completed */
  serviceCount: number;
  
  /** Total product sales in period */
  productSales: number;
  
  /** Number of products sold */
  productCount: number;
  
  /** Total bookings revenue */
  bookingsRevenue?: number;
  
  /** Raw sales logs (for detailed commission) */
  serviceLogs?: Array<{
    id: string;
    serviceName: string;
    price: number;
    commission: number | null;
  }>;
  
  productLogs?: Array<{
    id: string;
    productName: string;
    quantity: number;
    totalPrice: number;
    commission: number | null;
  }>;
}

/**
 * KPI Data (Payroll Context for Bonus Calculations)
 */
export interface KpiData {
  /** Target sessions/sales for the period */
  target: number;
  
  /** Actual achievement */
  actual: number;
  
  /** Achievement percentage (actual / target) */
  achievementRate: number;
  
  /** Bonus amount from kpi_records table (if already calculated) */
  bonusAmount?: number;
}

/**
 * Manual Adjustments (Payroll Context)
 */
export interface ManualAdjustment {
  id: string;
  type: 'bonus' | 'deduction';
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Payroll Decision Context
 * 
 * Extends DecisionContext with payroll-specific data.
 * Used by all payroll providers (Base Salary, Commission, Bonus, etc.)
 */
export interface PayrollDecisionContext extends DecisionContext {
  /** Month/Year being calculated (YYYY-MM-01 format) */
  monthYear: string;
  
  /** Employee information */
  employee: EmployeeData;
  
  /** Attendance data (for penalties and pro-rata) */
  attendance?: AttendanceData;
  
  /** Session data (for commission and rating bonus) */
  sessions?: SessionData;
  
  /** Sales data (for commission calculations) */
  sales?: SalesData;
  
  /** KPI data (for KPI bonus) */
  kpi?: KpiData;
  
  /** Manual adjustments (bonuses/deductions) */
  manualAdjustments?: ManualAdjustment[];
  
  /** Tenant salary configuration (thresholds, rates) */
  tenantConfig?: {
    kpiTargetSessions?: number;
    kpiBonusAmount?: number;
    penaltyLatePerDay?: number;
    penaltyAbsentPerDay?: number;
    bonus5Star?: number;
    bonus45Star?: number;
    bonus4Star?: number;
    minBaseSalary?: number;
    maxBaseSalary?: number;
    [key: string]: unknown;
  };
}

/**
 * Booking Decision Context (Example - Future Use)
 * 
 * Shows how DecisionContext can be extended for other domains.
 */
export interface BookingDecisionContext extends DecisionContext {
  /** Customer information */
  customer: {
    id: string;
    status: 'new' | 'active' | 'loyal' | 'vip';
    totalSpending: number;
    completedBookingsCount: number;
    paymentStatus?: string;
    noShowCount?: number;
    membershipTier?: string;
    totalBookings?: number;
    cancelledBookings?: number;
  };
  
  /** Booking details */
  booking?: {
    serviceCount: number;
    totalAmount: number;
    bookingDate: string;
  };

  /** Request details */
  request: {
    preferredDate: string;
    preferredTime?: string;
    preferredStaff?: string;
  };

  /** Availability data */
  availability: {
    slots: Array<{
      date: string;
      time: string;
      staffId: string;
      resourceId: string;
      available: boolean;
    }>;
  };

  /** Rules configuration */
  rules: {
    requiresDeposit?: boolean;
    advanceBookingDays: Record<string, number>;
    [key: string]: unknown;
  };
}

/**
 * Context Builder Utilities
 */

/**
 * Create a minimal DecisionContext
 */
export function createDecisionContext(
  tenantId: string,
  userId: string,
  options?: {
    timestamp?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    overrides?: Record<string, any>;
  }
): DecisionContext {
  return {
    tenantId,
    userId,
    timestamp: options?.timestamp || new Date().toISOString(),
    sessionId: options?.sessionId,
    metadata: options?.metadata,
    overrides: options?.overrides,
  };
}

/**
 * Create a PayrollDecisionContext from employee and period data
 */
export function createPayrollContext(
  tenantId: string,
  employee: EmployeeData,
  monthYear: string,
  options?: {
    attendance?: AttendanceData;
    sessions?: SessionData;
    sales?: SalesData;
    kpi?: KpiData;
    manualAdjustments?: ManualAdjustment[];
    tenantConfig?: PayrollDecisionContext['tenantConfig'];
    metadata?: Record<string, any>;
    overrides?: Record<string, any>;
  }
): PayrollDecisionContext {
  return {
    ...createDecisionContext(tenantId, employee.id, {
      metadata: options?.metadata,
      overrides: options?.overrides,
    }),
    monthYear,
    employee,
    attendance: options?.attendance,
    sessions: options?.sessions,
    sales: options?.sales,
    kpi: options?.kpi,
    manualAdjustments: options?.manualAdjustments,
    tenantConfig: options?.tenantConfig,
  };
}
