import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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
    <>
      {/* Pastel gradient background - purple/cyan/pink */}
      <style>{`
        html, body {
          background: linear-gradient(135deg, 
            #e0e7ff 0%,      /* Indigo-100 */
            #ddd6fe 25%,     /* Violet-200 */
            #fae8ff 50%,     /* Fuchsia-100 */
            #cffafe 75%,     /* Cyan-100 */
            #e0e7ff 100%     /* Back to indigo */
          ) !important;
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
