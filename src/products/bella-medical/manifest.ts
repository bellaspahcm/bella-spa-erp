import type { ProductManifest } from '@/core/plugins/manifest';

export const medicalProductManifest: ProductManifest = {
  id: 'bella-medical',
  name: 'Bella Medical Clinic',
  version: '1.0.0',
  apiVersion: 'v2',
  schemaVersion: 'v1.0',
  eventVersion: 'v1',
  minimumKernelVersion: '1.0.0',
  supportedHostVersion: '1.0.0',
  dependencies: ['resource_query', 'resource_command'],
  permissions: ['medical.view', 'medical.edit', 'medical.prescribe'],
  featureFlags: {
    enable_icd10_search: true,
    enable_telemedicine: false,
  },
  capabilities: ['medical_resource_query', 'medical_resource_command'],
  workflows: ['outpatient_consultation_flow', 'prescription_safety_check_flow'],
  clinicalPolicies: ['mandatory_cds_ddi_allergy_check'],
  integrations: ['bhyt_insurance_sync', 'lris_diagnostic_sync'],
};
