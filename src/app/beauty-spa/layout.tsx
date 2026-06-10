import type { Metadata } from 'next';

// ─── Metadata (SEO riêng cho Beauty Spa) ─────────────────────────────────────
export const metadata: Metadata = {
  title: "L'Émeraude Luxury Spa | Trị Liệu Thượng Lưu & Làm Đẹp Cao Cấp",
  description:
    "Trải nghiệm liệu trình spa sang trọng bậc nhất tại TP.HCM. L'Émeraude mang đến nghệ thuật chăm sóc cơ thể tinh tế với thảo dược hữu cơ Thụy Sĩ và công nghệ tái tạo da thế hệ mới.",
  keywords: [
    "spa cao cấp TPHCM",
    "beauty spa sang trọng",
    "trị liệu da mặt",
    "massage thư giãn",
    "nâng cơ mặt",
    "chăm sóc cơ thể",
    "L'Émeraude Spa",
  ],
  openGraph: {
    title: "L'Émeraude Luxury Spa — Kiến Tạo Vẻ Đẹp Thượng Hạng",
    description:
      "Trải nghiệm thẩm mỹ spa 5 sao chuẩn y khoa Thụy Sĩ. Liệu trình cá nhân hóa, phòng Suite riêng tư, thảo dược hữu cơ độc quyền.",
    locale: 'vi_VN',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

// ─── Layout ───────────────────────────────────────────────────────────────────
// Đây là route group riêng, hoàn toàn không render Sidebar / Header của Bella ERP.
// Children là nội dung của src/app/beauty-spa/page.tsx
export default function BeautySpaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Không dùng <html> hay <body> lại — Next.js kế thừa từ root layout.
    // Chỉ cần wrap trong một container sạch.
    <div
      id="beauty-spa-root"
      style={{
        // Reset hoàn toàn khỏi các global style của Bella ERP dashboard
        isolation: 'isolate',
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  );
}
