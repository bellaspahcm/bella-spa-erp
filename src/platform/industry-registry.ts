/**
 * Canonical Multi-Industry Pack Registry Framework
 * Phase C.5 – Multi-Industry Pack Registry
 *
 * Governance: Constitution #3 (Strict Types), #4 (Capability-First Enforcement)
 */

export interface IndustryPackManifest {
  packCode: string;
  packName: string;
  description: string;
  version: string;
  maturityLevel: 1 | 2 | 3 | 4 | 5;
  enabledCapabilities: string[];
  countryPacks: string[]; // e.g. ['VN', 'SG', 'MY', 'JP']
  complianceStandards: string[]; // e.g. ['BHYT_130', 'HIPAA', 'GDPR', 'PDPA']
  dependencies?: string[];
  isFrozen: boolean;
  frozenReason?: string;
}

export const INDUSTRY_PACK_REGISTRY: Record<string, IndustryPackManifest> = {
  bella_healthcare: {
    packCode: 'bella_healthcare',
    packName: 'Bella Healthcare Platform',
    description: 'Phân hệ y khoa tích hợp: HIS, LIS/RIS PACS, BHYT XML 130 và TT133 Financial Reconciler.',
    version: '3.0.0',
    maturityLevel: 4,
    enabledCapabilities: [
      'medical_clinic',
      'dental',
      'pharmacy',
      'hospital_inpatient',
      'bed_engine',
      'smart_queue',
      'break_glass_security',
      'ancillary_integration',
      'bhyt_connector',
    ],
    countryPacks: ['VN'],
    complianceStandards: ['HIPAA', 'BHYT_130', 'ISO27001'],
    isFrozen: false,
  },
  beauty_spa: {
    packCode: 'beauty_spa',
    packName: 'Bella Beauty Spa',
    description: 'Phân hệ spa làm đẹp, đặt lịch, hoa hồng kỹ thuật viên và hạch toán tự động.',
    version: '2.5.0',
    maturityLevel: 4,
    enabledCapabilities: [
      'booking',
      'session_management',
      'ktv_management',
      'commission_engine',
      'salary_engine',
      'inventory',
    ],
    countryPacks: ['VN', 'SG'],
    complianceStandards: ['GDPR'],
    isFrozen: true,
    frozenReason: 'Frozen production vertical: zero structural changes allowed.',
  },
  babycare: {
    packCode: 'babycare',
    packName: 'Bella Babycare',
    description: 'Phân hệ chăm sóc mẹ và bé sơ sinh: Gói liệu trình phức hợp và dinh dưỡng.',
    version: '1.8.0',
    maturityLevel: 3,
    enabledCapabilities: [
      'package_management',
      'session_tracking',
      'ktv_management',
      'nutrition_tracking',
    ],
    countryPacks: ['VN'],
    complianceStandards: ['GDPR'],
    isFrozen: true,
    frozenReason: 'Frozen production vertical: zero structural changes allowed.',
  },
  bella_auto: {
    packCode: 'bella_auto',
    packName: 'Bella Auto',
    description: 'Phân hệ dịch vụ showroom, gara và quản lý phụ tùng xe ô tô.',
    version: '1.0.0',
    maturityLevel: 2,
    enabledCapabilities: [
      'vehicle_inventory',
      'service_orders',
      'customer_crm',
      'parts_management',
    ],
    countryPacks: ['VN'],
    complianceStandards: [],
    isFrozen: false,
  },
  real_estate: {
    packCode: 'real_estate',
    packName: 'Bella Real Estate',
    description: 'Phân hệ quản lý dự án bất động sản, bảng hàng và đặt cọc thông minh.',
    version: '1.0.0',
    maturityLevel: 2,
    enabledCapabilities: [
      'project_management',
      'unit_inventory',
      'buyer_crm',
      'legal_docs',
    ],
    countryPacks: ['VN', 'SG'],
    complianceStandards: [],
    isFrozen: false,
  },
};
