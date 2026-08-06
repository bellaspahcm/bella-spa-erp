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
};
