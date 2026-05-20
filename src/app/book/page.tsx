import type { Metadata } from 'next';
import BookingPageClient from './BookingPageClient';
import { getPackages } from '@/modules/booking/actions/lifecycle-actions';

export const metadata: Metadata = {
  title: 'Đặt Lịch Hẹn Trực Tuyến | Bella Spa Mẹ & Bé',
  description:
    'Đặt lịch chăm sóc mẹ bầu, mẹ sau sinh và bé yêu tại Bella Spa. Dịch vụ 5 sao, kỹ thuật viên chuyên nghiệp, không gian sang trọng — đặt lịch ngay hôm nay!',
};

export default async function BookPage() {
  const packages = await getPackages();

  return <BookingPageClient packages={packages} />;
}
