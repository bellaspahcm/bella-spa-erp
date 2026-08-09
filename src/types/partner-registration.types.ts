/**
 * Partner Registration System - TypeScript Types
 * 
 * Generated from: supabase/migrations/20260802112935_partner_registration_system.sql
 * Version: 1.0
 * Date: 2026-08-02
 */

// ============================================================================
// ENUMS
// ============================================================================

export type PartnerApplicationStatus =
  | 'draft'
  | 'pending_verification'
  | 'need_more_info'
  | 'approved'
  | 'rejected'
  | 'provisioned'
  | 'activated';

export type PartnerApplicantType =
  | 'individual_broker'
  | 'agency'
  | 'company';

export type PartnerApplicationLogAction =
  | 'created'
  | 'submitted'
  | 'email_verified'
  | 'document_uploaded'
  | 'info_requested'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'provisioned'
  | 'activated'
  | 'status_changed'
  | 'comment_added';

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export interface PartnerApplicationDocument {
  type: 'cccd_front' | 'cccd_back' | 'business_license' | 'tax_certificate' | 'company_registration' | 'other';
  url: string;
  uploaded_at: string; // ISO 8601 timestamp
  file_name?: string;
  file_size?: number;
}

// ============================================================================
// DATABASE TABLES
// ============================================================================

export interface PartnerApplication {
  // Primary Key
  id: string;
  
  // Type Classification
  registration_type: string; // 'partner' (default)
  applicant_type: PartnerApplicantType;
  
  // Applicant Information
  full_name: string;
  email: string;
  phone: string;
  
  // Organization Info (for agency/company)
  company_name: string | null;
  tax_code: string | null;
  business_license: string | null;
  
  // Address
  address: string | null;
  city: string | null;
  district: string | null;
  ward: string | null;
  
  // Documents
  documents: PartnerApplicationDocument[];
  
  // Email Verification
  email_verified_at: string | null;
  email_verification_token: string | null;
  email_verification_token_expires_at: string | null;
  
  // Phone Verification
  phone_verified_at: string | null;
  phone_verification_token: string | null;
  
  // Status & Lifecycle
  status: PartnerApplicationStatus;
  
  // Submission
  submitted_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  
  // Admin Review
  approved_at: string | null;
  approved_by: string | null;
  approval_notes: string | null;
  
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  rejection_category: string | null;
  
  // Info Request
  info_request_message: string | null;
  info_request_fields: string[] | null;
  info_requested_at: string | null;
  info_requested_by: string | null;
  
  // Provisioning Result
  organization_id: string | null;
  tenant_id: string | null;
  identity_id: string | null;
  
  // Activation
  activation_token: string | null;
  activation_token_expires_at: string | null;
  activated_at: string | null;
  
  // AI Review
  ai_review_id: string | null;
  ai_fraud_score: number | null; // 0.00-1.00
  ai_risk_score: number | null;
  ai_recommendation: string | null;
  
  // Extensibility
  metadata: Record<string, unknown>;
  
  // Audit
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface PartnerApplicationLog {
  // Primary Key
  id: string;
  
  // Foreign Key
  application_id: string;
  
  // Action
  action: PartnerApplicationLogAction;
  action_description: string | null;
  
  // Performer
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  
  // Details
  old_status: PartnerApplicationStatus | null;
  new_status: PartnerApplicationStatus | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  
  // Metadata
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  
  // Timestamp
  created_at: string;
}

// ============================================================================
// INSERT TYPES (for creating new records)
// ============================================================================

// Simplified insert type - only required + common optional fields
export interface PartnerApplicationInsert {
  // Required
  full_name: string;
  email: string;
  phone: string;
  applicant_type: PartnerApplicantType;
  
  // Optional - Organization info
  company_name?: string;
  tax_code?: string;
  business_license?: string;
  
  // Optional - Address
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  
  // Optional - System fields
  registration_type?: string;
  status?: PartnerApplicationStatus;
  documents?: unknown; // JSONB
  metadata?: unknown; // JSONB
  ip_address?: string;
  user_agent?: string;
}

// Update type - all fields optional except what shouldn't be changed
export interface PartnerApplicationUpdate {
  // Applicant info
  full_name?: string;
  email?: string;
  phone?: string;
  applicant_type?: PartnerApplicantType;
  
  // Organization
  company_name?: string;
  tax_code?: string;
  business_license?: string;
  
  // Address
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  
  // Documents
  documents?: unknown; // JSONB
  
  // Email verification
  email_verified_at?: string;
  email_verification_token?: string;
  email_verification_token_expires_at?: string;
  
  // Status
  status?: PartnerApplicationStatus;
  
  // Admin fields
  approved_at?: string;
  approved_by?: string;
  approval_notes?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string;
  rejection_category?: string;
  info_request_message?: string;
  info_request_fields?: unknown; // JSONB
  
  // Metadata
  metadata?: unknown; // JSONB
  updated_by?: string;
}

// ============================================================================
// FORM TYPES (for UI)
// ============================================================================

export interface PartnerRegistrationFormStep1 {
  full_name: string;
  email: string;
  phone: string;
  applicant_type: PartnerApplicantType;
}

export interface PartnerRegistrationFormStep2 {
  company_name?: string;
  tax_code?: string;
  business_license?: string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
}

export interface PartnerRegistrationFormStep3 {
  documents: File[];
}

export interface PartnerRegistrationFormComplete
  extends PartnerRegistrationFormStep1,
    PartnerRegistrationFormStep2 {
  documents: PartnerApplicationDocument[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface PartnerRegistrationResponse {
  success: boolean;
  application?: PartnerApplication;
  error?: string;
}

export interface EmailVerificationResponse {
  success: boolean;
  application_id?: string;
  status?: PartnerApplicationStatus;
  error?: string;
}

export interface DocumentUploadResponse {
  success: boolean;
  document?: PartnerApplicationDocument;
  error?: string;
}

export interface ApplicationStatsResponse {
  total: number;
  draft: number;
  pending_verification: number;
  need_more_info: number;
  approved: number;
  rejected: number;
  provisioned: number;
  activated: number;
  avg_approval_time_hours: number | null;
  pending_review_count: number;
}

// ============================================================================
// ADMIN ACTION TYPES
// ============================================================================

export interface ApproveApplicationRequest {
  application_id: string;
  notes?: string;
}

export interface RejectApplicationRequest {
  application_id: string;
  reason: string;
  rejection_category: 'invalid_docs' | 'duplicate' | 'policy_violation' | 'other';
}

export interface RequestMoreInfoRequest {
  application_id: string;
  message: string;
  fields: string[];
}

export interface AdminActionResponse {
  success: boolean;
  application?: PartnerApplication;
  error?: string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface PartnerApplicationFilters {
  status?: PartnerApplicationStatus[];
  applicant_type?: PartnerApplicantType[];
  submitted_from?: string;
  submitted_to?: string;
  search?: string; // Search by name, email, company
}

export interface PartnerApplicationSort {
  field: keyof PartnerApplication;
  direction: 'asc' | 'desc';
}

export interface PartnerApplicationListParams {
  filters?: PartnerApplicationFilters;
  sort?: PartnerApplicationSort;
  page?: number;
  limit?: number;
}

export interface PartnerApplicationListResponse {
  applications: PartnerApplication[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export const isValidEmail = (email: string): boolean => {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  return /^\+?[0-9]{10,15}$/.test(phone);
};

export const isApplicantTypeOrganization = (type: PartnerApplicantType): boolean => {
  return type === 'agency' || type === 'company';
};

export const canEditApplication = (status: PartnerApplicationStatus): boolean => {
  return status === 'draft' || status === 'need_more_info';
};

export const isApplicationPending = (status: PartnerApplicationStatus): boolean => {
  return status === 'pending_verification' || status === 'need_more_info';
};

export const isApplicationFinal = (status: PartnerApplicationStatus): boolean => {
  return status === 'approved' || status === 'rejected' || status === 'activated';
};

// ============================================================================
// STATUS HELPERS
// ============================================================================

export const getStatusLabel = (status: PartnerApplicationStatus): string => {
  const labels: Record<PartnerApplicationStatus, string> = {
    draft: 'Nháp',
    pending_verification: 'Chờ xác minh',
    need_more_info: 'Cần bổ sung',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    provisioned: 'Đã cấp quyền',
    activated: 'Đã kích hoạt',
  };
  return labels[status];
};

export const getStatusColor = (
  status: PartnerApplicationStatus
): 'gray' | 'yellow' | 'blue' | 'green' | 'red' => {
  const colors: Record<PartnerApplicationStatus, 'gray' | 'yellow' | 'blue' | 'green' | 'red'> = {
    draft: 'gray',
    pending_verification: 'yellow',
    need_more_info: 'yellow',
    approved: 'green',
    rejected: 'red',
    provisioned: 'blue',
    activated: 'green',
  };
  return colors[status];
};

export const getApplicantTypeLabel = (type: PartnerApplicantType): string => {
  const labels: Record<PartnerApplicantType, string> = {
    individual_broker: 'Môi giới cá nhân',
    agency: 'Sàn giao dịch',
    company: 'Công ty',
  };
  return labels[type];
};
