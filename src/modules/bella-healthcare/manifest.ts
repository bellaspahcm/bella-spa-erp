import { VerticalManifest } from '../../platform/registry/vertical-registry';

export const healthcareManifest: VerticalManifest = {
  key: 'bella_healthcare',
  name: 'Bella Healthcare Platform',
  version: '1.0.0',
  themeKey: 'bella_healthcare',
  defaultRoute: '/dashboard/healthcare',
  enabledCapabilities: [
    'odontogram_ui',
    'soap_ai',
    'bhyt_connector',
    'care_journey',
    'clinical_rules'
  ],
  menus: [
    { id: 'dashboard', label: 'Dashboard điều hành', href: '/dashboard/healthcare', icon: 'LayoutDashboard' },
    { id: 'patients', label: 'Hồ sơ bệnh nhân (Parties)', href: '/dashboard/healthcare/patients', icon: 'Users' },
    { id: 'journeys', label: 'Hành trình điều trị (Journeys)', href: '/dashboard/healthcare/journeys', icon: 'Activity' },
    { id: 'encounters', label: 'Lượt khám bệnh (Encounters)', href: '/dashboard/healthcare/encounters', icon: 'ClipboardList' },
    { id: 'contracts', label: 'Kế hoạch & Hợp đồng', href: '/dashboard/healthcare/contracts', icon: 'FileContract' },
    { id: 'odontogram', label: 'Lược đồ răng (Odontogram)', href: '/dashboard/healthcare/odontogram', icon: 'Smile' }
  ],
  providers: {}
};
