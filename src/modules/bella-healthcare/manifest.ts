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
    // Core Healthcare Operations
    { id: 'dashboard', label: 'Dashboard điều hành', href: '/dashboard/healthcare', icon: 'LayoutDashboard' },
    { id: 'patients', label: 'Hồ sơ bệnh nhân (Parties)', href: '/dashboard/healthcare/patients', icon: 'Users' },
    { id: 'journeys', label: 'Hành trình điều trị (Journeys)', href: '/dashboard/healthcare/journeys', icon: 'Activity' },
    { id: 'encounters', label: 'Lượt khám bệnh (Encounters)', href: '/dashboard/healthcare/encounters', icon: 'ClipboardList' },
    { id: 'contracts', label: 'Kế hoạch & Hợp đồng', href: '/dashboard/healthcare/contracts', icon: 'FileText' },
    { id: 'odontogram', label: 'Lược đồ răng (Odontogram)', href: '/dashboard/healthcare/odontogram', icon: 'Smile' },
    
    // Analytics & Intelligence
    { id: 'analytics', label: 'Trung tâm Phân tích', href: '/dashboard/analytics', icon: 'LineChart' },
    { id: 'executive', label: 'Bảng quản trị CEO', href: '/dashboard/executive', icon: 'BarChart3' },
    { id: 'operations', label: 'Hiệu suất Vận hành', href: '/dashboard/operations', icon: 'Activity' },
    
    // Finance & HR
    { id: 'salary', label: 'Bảng lương & Công', href: '/dashboard/salary', icon: 'Banknote' },
    { id: 'finance', label: 'Dòng Tiền & Thu Chi', href: '/dashboard/finance', icon: 'CircleDollarSign' },
    
    // System (Settings will be auto-added by sidebar)
    { id: 'guides', label: 'Hướng dẫn sử dụng', href: '/dashboard/guides', icon: 'HelpCircle' },
  ],
  providers: {}
};
