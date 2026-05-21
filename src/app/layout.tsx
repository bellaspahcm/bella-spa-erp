import type { Metadata } from "next";
import { Corinthia, Playfair_Display } from 'next/font/google';
import "./globals.css";

const corinthia = Corinthia({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-handwriting',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-serif',
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: "Bella Spa - Chăm Sóc Mẹ Và Bé | Chăm Sóc Trọn Yêu Thương",
  description: "Dịch vụ chăm sóc sức khỏe và sắc đẹp chuẩn y khoa cho mẹ bầu, mẹ sau sinh và bé yêu. Trải nghiệm dịch vụ 5 sao nâng niu từng khoảnh khắc.",
};

import { Toaster } from "sonner";
import OfflineIndicator from "@/components/common/offline-indicator";
import { cookies } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "light";

  return (
    <html lang="vi" className={`h-full antialiased ${theme === "dark" ? "dark" : ""} ${corinthia.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <OfflineIndicator />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
