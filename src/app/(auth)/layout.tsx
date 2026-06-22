import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đăng nhập - Bella Spa ERP',
  description: 'Hệ thống quản lý chăm sóc mẹ & bé',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div 
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #fdf2f8, #fff)',
      }}
    >
      {children}
    </div>
  );
}
