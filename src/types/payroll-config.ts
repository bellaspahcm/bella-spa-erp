/**
 * Payroll Configuration Types
 * 
 * Type definitions for the configuration-driven payroll system.
 * Each provider (Commission, KPI, Attendance...) has a config with:
 * - enabled: boolean (bật/tắt provider)
 * - strategy: string (cách tính: fixed, tier, percentage...)
 * - config: object (tham số cho strategy)
 * 
 * @see supabase/migrations/20260622_create_tenant_payroll_config.sql
 */

// =====================================================
// BASE TYPES
// =====================================================

/**
 * Provider keys
 * Add new providers here as they are implemented
 */
export type ProviderKey =
  | 'commission'        // Hoa hồng
  | 'kpi'               // Thưởng KPI
  | 'attendance'        // Chấm công (phạt đi muộn, vắng)
  | 'rating'            // Thưởng đánh giá
  | 'bonus'             // Thưởng đột xuất
  | 'deduction'         // Các khoản trừ
  | 'insurance'         // BHXH, BHYT
  | 'tax'               // Thuế TNCN
  | 'advance'           // Tạm ứng
  | 'position'          // Phụ cấp chức vụ
  | 'seniority'         // Phụ cấp thâm niên
  | 'shift'             // Phụ cấp ca (đêm, cuối tuần)
  | 'overtime';         // Tăng ca

/**
 * Change types for audit history
 */
export type ConfigChangeType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'enable' 
  | 'disable';

// =====================================================
// DATABASE TYPES (matches SQL schema)
// =====================================================

/**
 * tenant_payroll_config table
 */
export interface TenantPayrollConfig {
  id: string;
  tenant_id: string;
  provider_key: ProviderKey;
  enabled: boolean;
  strategy: string | null;
  config: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  notes: string | null;
}

/**
 * tenant_payroll_config_history table
 */
export interface TenantPayrollConfigHistory {
  id: string;
  config_id: string | null;
  tenant_id: string;
  provider_key: ProviderKey;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
  change_type: ConfigChangeType;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

// =====================================================
// PROVIDER-SPECIFIC CONFIG TYPES
// =====================================================

// ----- Commission Provider -----

export type CommissionStrategy = 
  | 'fixed'             // Cố định: 120k/session
  | 'tier'              // Bậc thang: 0-10→100k, 11-20→120k, 21+→150k
  | 'percentage'        // % doanh thu: 5%
  | 'revenue'           // % doanh thu theo tổng
  | 'service'           // Khác nhau theo dịch vụ
  | 'category'          // Khác nhau theo loại khách (VIP, regular)
  | 'product_sales'     // % hoa hồng bán sản phẩm
  | 'total_revenue';    // % tổng doanh thu (dịch vụ + sản phẩm)

export interface CommissionFixedConfig {
  rate: number;                 // Hoa hồng/session (VD: 120000)
  minSessions?: number;         // Tối thiểu sessions (default: 0)
}

export interface CommissionTierConfig {
  tiers: Array<{
    min: number;                // Sessions từ (VD: 0)
    max: number;                // Sessions đến (VD: 10)
    rate: number;               // Hoa hồng (VD: 100000)
  }>;
}

export interface CommissionPercentageConfig {
  percentage: number;           // % doanh thu (VD: 5 = 5%)
  minRevenue?: number;          // Doanh thu tối thiểu (default: 0)
}

export interface CommissionRevenueConfig {
  percentage: number;           // % tổng doanh thu
  thresholds?: Array<{          // Bậc thang theo doanh thu
    minRevenue: number;
    maxRevenue: number;
    percentage: number;
  }>;
}

export interface CommissionServiceConfig {
  rates: Record<string, number>; // { "massage": 150000, "facial": 100000 }
}

export interface CommissionCategoryConfig {
  rates: Record<string, number>; // { "vip": 150000, "regular": 120000 }
}

export type CommissionConfig =
  | CommissionFixedConfig
  | CommissionTierConfig
  | CommissionPercentageConfig
  | CommissionRevenueConfig
  | CommissionServiceConfig
  | CommissionCategoryConfig;

// ----- KPI Provider -----

export type KPIStrategy = 
  | 'threshold'         // Đạt target → thưởng (30 ca → 1M)
  | 'linear'            // Mỗi ca thêm +33k
  | 'tier';             // Bậc thang: 25-29→500k, 30+→1M

export interface KPIThresholdConfig {
  target: number;               // Target sessions (VD: 30)
  bonus: number;                // Thưởng khi đạt (VD: 1000000)
}

export interface KPILinearConfig {
  bonusPerSession: number;      // Thưởng/session (VD: 33000)
  minSessions?: number;         // Sessions tối thiểu (default: 0)
}

export interface KPITierConfig {
  tiers: Array<{
    min: number;
    max: number;
    bonus: number;
  }>;
}

export type KPIConfig =
  | KPIThresholdConfig
  | KPILinearConfig
  | KPITierConfig;

// ----- Attendance Provider -----

export type AttendanceStrategy = 
  | 'late_deduction'    // Phạt đi muộn
  | 'absent_deduction'  // Phạt vắng
  | 'leave_deduction';  // Trừ nghỉ phép

export interface AttendanceDeductionConfig {
  latePenalty: number;          // Phạt đi muộn (VD: 50000)
  absentPenalty: number;        // Phạt vắng (VD: 200000)
  lateGracePeriod: number;      // Ân hạn (phút) (VD: 15)
  maxLatePerMonth?: number;     // Số lần đi muộn tối đa (default: không giới hạn)
}

export type AttendanceConfig = AttendanceDeductionConfig;

// ----- Rating Provider -----

export type RatingStrategy = 
  | 'threshold'         // ≥4.5 sao → thưởng
  | 'linear'            // Mỗi 0.1 sao → +50k
  | 'tier';             // Bậc thang theo sao

export interface RatingThresholdConfig {
  minRating: number;            // Tối thiểu rating (VD: 4.5)
  bonus: number;                // Thưởng khi đạt (VD: 500000)
}

export interface RatingLinearConfig {
  bonusPerPoint: number;        // Thưởng/0.1 sao (VD: 50000)
  baseRating?: number;          // Rating cơ sở (default: 0)
}

export interface RatingTierConfig {
  tiers: Array<{
    minRating: number;
    maxRating: number;
    bonus: number;
  }>;
}

export type RatingConfig =
  | RatingThresholdConfig
  | RatingLinearConfig
  | RatingTierConfig;

// =====================================================
// PROVIDER CONFIG WRAPPER
// =====================================================

/**
 * Generic provider config structure
 * Used in API responses and UI
 */
export interface ProviderConfig<T = Record<string, unknown>> {
  enabled: boolean;
  strategy: string | null;
  config: T;
}

/**
 * Full config for a tenant
 * Key = provider_key, Value = ProviderConfig
 */
export interface TenantPayrollConfigMap {
  commission?: ProviderConfig<CommissionConfig>;
  kpi?: ProviderConfig<KPIConfig>;
  attendance?: ProviderConfig<AttendanceConfig>;
  rating?: ProviderConfig<RatingConfig>;
  // ... more providers as implemented
}

// =====================================================
// REQUEST/RESPONSE TYPES FOR API
// =====================================================

/**
 * Request body for updating provider config
 */
export interface UpdateProviderConfigRequest {
  enabled?: boolean;
  strategy?: string;
  config?: Record<string, unknown>;
  notes?: string;
}

/**
 * Response from config API
 */
export interface GetProviderConfigResponse {
  success: boolean;
  data?: ProviderConfig;
  error?: string;
}

/**
 * Response from config history API
 */
export interface GetConfigHistoryResponse {
  success: boolean;
  data?: TenantPayrollConfigHistory[];
  error?: string;
}

// =====================================================
// DEFAULT CONFIGS
// =====================================================

/**
 * Default configs when tenant hasn't configured yet
 * These are sensible defaults for a typical spa
 */
export const DEFAULT_CONFIGS: Partial<TenantPayrollConfigMap> = {
  commission: {
    enabled: true,
    strategy: 'fixed',
    config: {
      rate: 120000,
      minSessions: 0
    } as CommissionFixedConfig
  },
  kpi: {
    enabled: false,  // Off by default
    strategy: null,
    config: {} as KPIConfig
  },
  attendance: {
    enabled: true,
    strategy: 'late_deduction',
    config: {
      latePenalty: 50000,
      absentPenalty: 200000,
      lateGracePeriod: 15
    } as AttendanceDeductionConfig
  },
  rating: {
    enabled: false,  // Off by default
    strategy: null,
    config: {} as RatingConfig
  }
};

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Type guard for Commission Fixed Config
 */
export function isCommissionFixedConfig(config: unknown): config is CommissionFixedConfig {
  return typeof config === 'object' && 
         config !== null &&
         'rate' in config &&
         typeof (config as Record<string, unknown>).rate === 'number';
}

/**
 * Type guard for Commission Tier Config
 */
export function isCommissionTierConfig(config: unknown): config is CommissionTierConfig {
  return typeof config === 'object' && 
         config !== null &&
         'tiers' in config &&
         Array.isArray((config as Record<string, unknown>).tiers) &&
         (config as { tiers: unknown[] }).tiers.length > 0;
}

/**
 * Type guard for KPI Threshold Config
 */
export function isKPIThresholdConfig(config: unknown): config is KPIThresholdConfig {
  return typeof config === 'object' && 
         config !== null &&
         'target' in config &&
         'bonus' in config &&
         typeof (config as Record<string, unknown>).target === 'number' &&
         typeof (config as Record<string, unknown>).bonus === 'number';
}

// =====================================================
// VALIDATION SCHEMAS (for runtime validation)
// =====================================================

/**
 * JSON Schema for Commission Fixed Config
 * Use with Zod or Yup for validation
 */
export const COMMISSION_FIXED_SCHEMA = {
  type: 'object',
  required: ['rate'],
  properties: {
    rate: {
      type: 'number',
      minimum: 0,
      maximum: 1000000,
      description: 'Commission rate per session (VND)'
    },
    minSessions: {
      type: 'number',
      minimum: 0,
      default: 0,
      description: 'Minimum sessions required'
    }
  }
};

/**
 * JSON Schema for Commission Tier Config
 */
export const COMMISSION_TIER_SCHEMA = {
  type: 'object',
  required: ['tiers'],
  properties: {
    tiers: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['min', 'max', 'rate'],
        properties: {
          min: { type: 'number', minimum: 0 },
          max: { type: 'number', minimum: 0 },
          rate: { type: 'number', minimum: 0 }
        }
      }
    }
  }
};

// ... add more schemas for other configs as needed
