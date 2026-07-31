import { VerticalManifest } from '../../platform/registry/vertical-registry';
import { RealEstateOrganizationTreeProvider, RealEstateOrganizationMetricProvider } from './providers';

export const realEstateManifest: VerticalManifest = {
  key: 'real_estate',
  name: 'Real Estate Enterprise Platform',
  version: '1.0.0',
  themeKey: 'real_estate',
  defaultRoute: '/dashboard/real-estate',
  enabledCapabilities: ['inbox', 'assignment', 'workflow', 'layout', 'audit', 'organization_center'],
  menus: [
    { id: 'dashboard', label: 'Tổng Quan Dự Án', href: '/dashboard/real-estate', icon: 'Building2' },
    { id: 'projects', label: 'Dự Án BĐS', href: '/dashboard/real-estate/projects', icon: 'FolderKanban' },
    { id: 'apartments', label: 'Bảng Hàng Căn Hộ', href: '/dashboard/real-estate/apartments', icon: 'Grid' },
    { id: 'contracts', label: 'Hợp Đồng & Đặt Cọc', href: '/dashboard/real-estate/contracts', icon: 'FileText' },
    { id: 'customers', label: 'Khách Hàng Đầu Tư', href: '/dashboard/real-estate/customers', icon: 'Users' },
    { id: 'organization', label: 'Sơ đồ tổ chức', href: '/dashboard/organization', icon: 'Users' },
  ],
  providers: {
    organization: {
      tree: (ctx) => new RealEstateOrganizationTreeProvider(ctx),
      metric: (ctx) => new RealEstateOrganizationMetricProvider(ctx),
    }
  }
};
