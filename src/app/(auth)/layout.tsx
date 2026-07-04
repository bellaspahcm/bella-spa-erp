import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Khóa zoom trên mobile
  userScalable: false, // Không cho phép zoom
};

export const metadata: Metadata = {
  title: 'Đăng nhập - Bella Multi-Service ERP',
  description: 'Hệ thống quản trị dịch vụ ALL in ONE',
};

const BG_LIGHT =
  'radial-gradient(ellipse at 20% 50%, rgba(236, 72, 153, 0.06) 0%, transparent 55%), ' +
  'radial-gradient(ellipse at 80% 15%, rgba(219, 39, 119, 0.05) 0%, transparent 55%), ' +
  'radial-gradient(ellipse at 60% 85%, rgba(244, 114, 182, 0.04) 0%, transparent 50%), ' +
  'linear-gradient(135deg, #fefcfb 0%, #fdf2f8 55%, #fef3f2 100%)';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Seamless full-page background: light gradient cho tất cả businesses */}
      <style>{`
        html, body {
          background-color: #fefcfb !important;
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(236, 72, 153, 0.06) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 15%, rgba(219, 39, 119, 0.05) 0%, transparent 55%),
            radial-gradient(ellipse at 60% 85%, rgba(244, 114, 182, 0.04) 0%, transparent 50%),
            linear-gradient(rgba(236, 72, 153, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(236, 72, 153, 0.03) 1px, transparent 1px),
            linear-gradient(135deg, #fefcfb 0%, #fdf2f8 55%, #fef3f2 100%) !important;
          background-size: 100% 100%, 100% 100%, 100% 100%, 48px 48px, 48px 48px, 100% 100% !important;
          background-attachment: fixed !important;
          min-height: 100%;
          margin: 0;
          padding: 0;
        }
      `}</style>

      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: 'transparent',
        }}
      >
        {children}
      </div>
    </>
  );
}
