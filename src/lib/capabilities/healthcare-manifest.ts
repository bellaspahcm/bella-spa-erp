/**
 * BELLA HEALTHCARE PLATFORM — CAPABILITY & PRODUCT MANIFEST REGISTRY
 * 
 * Governance: ADR-005 Universal Domain Runtime & Semantic Versioning Manifests
 */

export interface CapabilityManifest {
  schemaVersion: string;
  capabilityVersion: string;
  apiVersion: string;
  migrationVersion: string;
  capability: string;
  status: 'draft' | 'experimental' | 'beta' | 'production' | 'deprecated' | 'archived';
  requires: string[];
  optional?: string[];
  featureFlags?: string[];
  workflow?: string;
  navigation: { label: string; path: string; icon?: string }[];
  permissions: string[];
  apiContracts: string[];
  events: string[];
  reports?: string[];
  aiAgents?: string[];
}

export interface ProductManifest {
  schemaVersion: string;
  productVersion: string;
  productId: string;
  productName: string;
  enabledCapabilities: string[];
  defaultTheme: string;
  defaultWorkflow: string;
}

/**
 * Clinical Capability Manifest
 */
export const CLINICAL_CAPABILITY_MANIFEST: CapabilityManifest = {
  schemaVersion: '1.0',
  capabilityVersion: '1.0.0',
  apiVersion: 'v1',
  migrationVersion: '1',
  capability: 'clinical',
  status: 'production',
  requires: ['patient', 'practitioner', 'facility', 'terminology'],
  optional: ['clinical_orders', 'laboratory', 'imaging', 'billing'],
  featureFlags: ['enable_soap_templates', 'enable_vitals_alerts'],
  workflow: 'medical_default_clinical',
  navigation: [
    { label: 'Đặt lịch & QR Check-in', path: '/dashboard/healthcare/appointments' },
    { label: 'Màn hình TV Hàng đợi AI', path: '/dashboard/healthcare/queue/tv' },
    { label: 'Lịch trực Bác sĩ', path: '/dashboard/healthcare/schedules' },
    { label: 'Hàng đợi đón tiếp', path: '/dashboard/healthcare/queue' },
    { label: 'Lượt khám (EMR)', path: '/dashboard/healthcare/encounters' },
    { label: 'Bệnh nhân', path: '/dashboard/healthcare/patients' },
  ],
  permissions: [
    'clinical.encounter.create',
    'clinical.encounter.read',
    'clinical.encounter.update',
    'clinical.vitals.record',
  ],
  apiContracts: [
    'POST /api/v1/healthcare/encounters',
    'GET /api/v1/healthcare/encounters/:id',
    'POST /api/v1/healthcare/encounters/:id/vitals',
  ],
  events: ['EncounterStarted.v1', 'EncounterCompleted.v1'],
  reports: ['daily_encounter_summary'],
  aiAgents: ['ai_clinical_assistant'],
};

/**
 * Laboratory Capability Manifest
 */
export const LABORATORY_CAPABILITY_MANIFEST: CapabilityManifest = {
  schemaVersion: '1.0',
  capabilityVersion: '1.0.0',
  apiVersion: 'v1',
  migrationVersion: '1',
  capability: 'laboratory',
  status: 'production',
  requires: ['clinical', 'clinical_orders', 'patient', 'encounter'],
  optional: ['billing', 'insurance'],
  featureFlags: ['auto_flag_panic_values', 'barcode_tube_tracking'],
  workflow: 'medical_default_lab',
  navigation: [
    { label: 'Phiếu xét nghiệm', path: '/dashboard/healthcare/lab-orders' },
  ],
  permissions: [
    'lab.order.create',
    'lab.order.read',
    'lab.result.verify',
  ],
  apiContracts: [
    'GET /api/v1/healthcare/lab-orders',
    'POST /api/v1/healthcare/lab-orders/:id/verify',
  ],
  events: ['LabResultVerified.v1'],
  reports: ['lab_daily_summary', 'lab_qc_report'],
  aiAgents: ['ai_lab_panic_detector'],
};

/**
 * Bella Medical Clinic Product Manifest (Enablement Set)
 */
export const BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST: ProductManifest = {
  schemaVersion: '1.0',
  productVersion: '1.0.0',
  productId: 'medical_clinic',
  productName: 'Bella Medical Clinic (Phòng khám đa khoa)',
  enabledCapabilities: [
    'clinical',
    'clinical_orders',
    'laboratory',
    'imaging',
    'pharmacy',
    'billing',
    'insurance',
    'workflow_queue',
  ],
  defaultTheme: 'teal_clinical',
  defaultWorkflow: 'medical_clinic_standard_journey',
};
