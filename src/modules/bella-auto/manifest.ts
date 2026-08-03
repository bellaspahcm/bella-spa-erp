import { VerticalManifest } from '../../platform/registry/vertical-registry';

export const bellaAutoManifest: VerticalManifest = {
  key: 'bella_auto',
  name: 'Bella Automotive Platform',
  version: '1.0.0',
  themeKey: 'bella_auto',
  defaultRoute: '/dashboard/bella-auto',
  enabledCapabilities: [
    'vehicle_center',
    'journey_center',
    'experience_center',
    'workflow_center',
    'audit',
    'organization_center'
  ],
  menus: [
    { id: 'dashboard', label: 'Dashboard điều hành', href: '/dashboard/bella-auto', icon: 'LayoutDashboard' },
    { id: 'vehicles', label: 'Quản lý kho xe', href: '/dashboard/bella-auto/vehicles', icon: 'Car' },
    { id: 'journey', label: 'Hành trình khách hàng', href: '/dashboard/bella-auto/journey', icon: 'GitCommit' },
    { id: 'experience', label: 'Experience Center', href: '/dashboard/bella-auto/experience', icon: 'Smile' },
    { id: 'leads', label: 'Quản lý Leads', href: '/dashboard/bella-auto/leads', icon: 'Target' },
    { id: 'sales', label: 'Quy trình bán hàng', href: '/dashboard/bella-auto/sales', icon: 'CircleDollarSign' },
    { id: 'workshop', label: 'Dịch vụ & Xưởng', href: '/dashboard/bella-auto/workshop', icon: 'Wrench' }
  ],
  providers: {}
};
