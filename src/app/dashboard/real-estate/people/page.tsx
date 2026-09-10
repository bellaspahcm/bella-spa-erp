import { Metadata } from 'next';
import { PeopleDirectoryPage } from '@/modules/real_estate/components/PeopleDirectoryPage';

export const metadata: Metadata = {
  title: 'Quản lý nhân sự — Bella Real Estate',
  description: 'Quản lý nhân sự: Sales, Môi giới, Đại lý, Đối tác của hệ thống bất động sản Bella Land.',
};

export default function PeopleDirectoryRoute() {
  return <PeopleDirectoryPage />;
}
