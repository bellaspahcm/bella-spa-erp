/**
 * Spa Module Types - Barrel Export
 * 
 * Centralized exports for all spa-specific type definitions.
 * These types extend the core platform contracts with spa-specific fields and behavior.
 */

// Package types
export type {
  ServicePackage,
  ServicePackageInsert,
  ServicePackageUpdate,
  ServiceStatus,
  ServiceStatusFilter,
  ServiceModalMode,
  ServiceModuleKey,
  ServiceModuleFilter,
  ServiceKind,
  PackageMultiplierLike,
  SessionPackageLike,
  PackageMaterialInput,
  PackageMaterialRow,
  PackageMaterialInsert,
  MaterialRow,
  SessionMaterialLike,
  PackageActionInput,
  ServiceFormState,
  HqPackageTemplate,
  PackageRow,
  LandingCategoryKey,
} from './package';

// Booking types
export type {
  BookingRow,
  BookingInsert,
  BookingUpdate,
  BookingCompletionStatus,
  BookingCompletionSnapshot,
  BookingCompletionUpdate,
  BookingPaymentStateInput,
  BookingPaymentState,
  BookingResourceType,
  BookingResourceStatus,
  BookingResource,
  BookingResourceInput,
  BookingResourcePayload,
  BookingResourceRuleResult,
  BookingResourceFormState,
  BookingFinancialIntegritySnapshot,
  BookingInvoicePrintLog,
  BookingForPackageName,
  SessionBookingLike,
  BookingDBRow,
} from './booking';

export {
  BOOKING_RESOURCE_TYPES,
  BOOKING_RESOURCE_STATUSES,
} from './booking';

// Employee (KTV) types
export type {
  UserRow,
  KtvAttendanceLog,
  KtvAttendanceSummary,
  KtvSessionMatrixRecord,
  KtvSessionMatrix,
  KtvPerformanceViewModel,
  KtvLeaderboardRow,
  KtvOption,
  KtvUser,
  StaffRecord,
  KtvDBRow,
} from './employee';

// Session types
export type {
  SessionLogRow,
  SessionLogInsert,
  SessionLogUpdate,
  SessionLog,
  SessionBooking,
  ConflictSession,
  LeaveRequest,
  SessionRevenueRecognitionInput,
  SessionRevenueRecognition,
  SessionReviewDBRow,
  SessionLogDBRow,
  SessionMatrixRow,
  SessionLike,
  KtvSalaryConfirmationSession,
} from './session';

// Salary types
export type {
  SalaryRecordRow,
  SalaryRecordInsert,
  SalaryRecordUpdate,
  KtvSalaryRecord,
  SalaryConfigLike,
  TenantSalaryConfig,
  SalaryTotalInput,
  SalaryRecordFinancialLike,
  SalaryRecalculationLifecycleOverrides,
  SalaryDisplayComponentsInput,
  SalaryReconciliationStatus,
  SalaryReconciliationThresholds,
  SalaryReconciliationStateInput,
  SalaryReconciliationStatusInput,
  SalaryReconRow,
  SalaryReconSummary,
  SalaryReconciliationRow,
  KtvSalaryDetailRow,
  SalaryRecordDbAdmin,
  SalaryRecalculationOverrides,
  KtvSalaryConfirmation,
  SalaryExportSnapshot,
  SalaryRecordDBRow,
} from './salary';
