/**
 * @module capabilities/hr/index
 *
 * HR Capability public barrel.
 * Consumers import from '@/capabilities/hr' — never from internal sub-paths.
 *
 * @layer Capability (Layer 2)
 */

export type {
  EmploymentType,
  EmploymentStatus,
  WorkSchedule,
  ContractType,
  ContractStatus,
  HRDepartment,
  HREmployeeProfile,
  HREmployeeProfileView,
  ContractAllowances,
  HRContract,
  HREmployeeSummaryRow,
  HRQueryService,
} from './contracts';

export { SupabaseHRQueryService } from './SupabaseHRQueryService';
