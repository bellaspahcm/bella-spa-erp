import type { ProductManifest } from '@/core/plugins/manifest';

export const dentalProductManifest: ProductManifest = {
  id: 'bella-dental',
  name: 'Bella Dental Clinic',
  version: '1.0.0',
  apiVersion: 'v2',
  schemaVersion: 'v1.0',
  eventVersion: 'v1',
  minimumKernelVersion: '1.0.0',
  supportedHostVersion: '1.0.0',
  dependencies: ['resource_query', 'resource_command'],
  permissions: ['dental.view', 'dental.edit', 'dental.procedure'],
  featureFlags: {
    enable_odontogram_twin: true,
    enable_implant_planner: true,
  },
};
