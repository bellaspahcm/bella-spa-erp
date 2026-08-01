import { Metadata } from 'next';
import { PeopleDirectoryPage } from '@/modules/real_estate/components/PeopleDirectoryPage';

export const metadata: Metadata = {
  title: 'Danh Mục Nhân Sự — Bella Real Estate',
  description: 'Quản lý danh mục nhân sự: Sale, Môi giới, Đại lý, Đối tác của hệ thống bất động sản.',
};

export default function PeopleDirectoryRoute() {
  return <PeopleDirectoryPage />;
}
