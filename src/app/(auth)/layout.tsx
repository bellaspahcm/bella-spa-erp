import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đăng nhập - Bella Multi-Service ERP',
  description: 'Hệ thống quản trị dịch vụ ALL in ONE',
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
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.18) 0%, transparent 55%), ' +
          'radial-gradient(ellipse at 80% 15%, rgba(139,92,246,0.14) 0%, transparent 55%), ' +
          'radial-gradient(ellipse at 60% 85%, rgba(6,182,212,0.10) 0%, transparent 50%), ' +
          'linear-gradient(135deg, #060b14 0%, #0d1529 55%, #0a0e1a 100%)',
      }}
    >
      {/* Subtle grid overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
}
