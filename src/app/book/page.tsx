import type { Metadata } from 'next';
import BookingPageClient from './BookingPageClient';
import { getPublicBabycareBookingPackages } from '@/core/services/order';

export const metadata: Metadata = {
  title: 'Đặt Lịch Hẹn Trực Tuyến | Bella Spa Mẹ & Bé',
  description:
    'Đặt lịch chăm sóc mẹ bầu, mẹ sau sinh và bé yêu tại Bella Spa. Dịch vụ 5 sao, kỹ thuật viên chuyên nghiệp, không gian sang trọng — đặt lịch ngay hôm nay!',
};

export default async function BookPage() {
  const { packages, error: packageLoadError } = await getPublicBabycareBookingPackages();

  return <BookingPageClient packages={packages} packageLoadError={packageLoadError} />;
}
