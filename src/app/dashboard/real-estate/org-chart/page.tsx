import { Metadata } from 'next';
import { OrgChartPage } from '@/modules/real_estate/components/OrgChartPage';

export const metadata: Metadata = {
  title: 'Sơ Đồ Tổ Chức — Bella Real Estate',
  description: 'Xem và quản lý cơ cấu tổ chức, chi nhánh, team và nhân sự của dự án bất động sản.',
};

export default function OrgChartRoute() {
  return <OrgChartPage />;
}
