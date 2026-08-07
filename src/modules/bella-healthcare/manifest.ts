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
    'clinical_rules',
    'hospital_inpatient',
    'bed_engine',
    'smart_queue',
    'break_glass_security',
    'ancillary_integration',
    'bhyt_connector'
  ],
  menus: [
    // Core Healthcare Operations
    { id: 'dashboard', label: 'Dashboard điều hành', href: '/dashboard/healthcare', icon: 'LayoutDashboard' },
    { id: 'appointments', label: 'Đặt Lịch & QR Check-in', href: '/dashboard/healthcare/appointments', icon: 'Calendar' },
    { id: 'queue_tv', label: 'Màn Hình TV Hàng Đợi AI', href: '/dashboard/healthcare/queue/tv', icon: 'Tv' },
    { id: 'hospital_beds', label: 'Sơ đồ Buồng Giường Nội Trú', href: '/dashboard/hospital/beds', icon: 'Bed' },
    { id: 'hospital_admissions', label: 'Bệnh Án Nội Trú', href: '/dashboard/hospital/admissions', icon: 'Hospital' },
    { id: 'hospital_nursing_vitals', label: 'Theo Dõi Sinh Hiệu Điều Dưỡng', href: '/dashboard/hospital/nursing-vitals', icon: 'Activity' },
    { id: 'hospital_mar', label: 'Phiếu Thực Hiện Y Lệnh (MAR)', href: '/dashboard/hospital/mar', icon: 'Tablets' },
    { id: 'hospital_ancillary', label: 'Cận Lâm Sàng (LIS/RIS)', href: '/dashboard/hospital/ancillary', icon: 'ClipboardList' },
    { id: 'hospital_bhyt', label: 'Cổng Giám Định BHYT XML 130', href: '/dashboard/hospital/bhyt', icon: 'FileText' },
    { id: 'schedules', label: 'Lịch Trực Bác sĩ', href: '/dashboard/healthcare/schedules', icon: 'Stethoscope' },
    { id: 'patients', label: 'Hồ sơ bệnh nhân (MPI)', href: '/dashboard/healthcare/patients', icon: 'Users' },
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
