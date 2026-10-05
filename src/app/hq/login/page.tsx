import { redirect } from 'next/navigation';
import { checkHqAuth } from '@/services/hq-actions';
import HqLoginClient from './hq-login-client';

export const metadata = {
  title: 'HQ Portal - Đăng nhập Tổng bộ',
  description: 'Đăng nhập khu vực quản trị Tổng bộ Quản trị Cấp cao.',
};

export default async function HqLoginPage() {
  const auth = await checkHqAuth();

  if (auth.authorized) {
    redirect('/hq');
  }

  return <HqLoginClient />;
}
