import type { Metadata, Viewport } from "next";
import { Corinthia, Inter, Playfair_Display, Geist } from 'next/font/google';
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

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

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: "Bella Spa - Chăm Sóc Mẹ Và Bé | Chăm Sóc Trọn Yêu Thương",
  description: "Dịch vụ chăm sóc sức khỏe và sắc đẹp chuẩn y khoa cho mẹ bầu, mẹ sau sinh và bé yêu. Trải nghiệm dịch vụ 5 sao nâng niu từng khoảnh khắc.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bella ERP",
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

import Script from "next/script";

import { Toaster } from "sonner";
import OfflineIndicator from "@/components/common/offline-indicator";
import PwaRegister from "@/components/common/PwaRegister";
import { TenantContextProvider } from "@/core/providers/TenantContextProvider";
import { cookies } from "next/headers";
import TenantContextWrapper from "@/components/providers/TenantContextWrapper";
import { QueryClientProvider } from "@/components/providers/QueryClientProvider";

// Register module adapters on app startup
import { registerSpaModule } from "@/modules/spa/register";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


registerSpaModule();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "light";

  return (
    <html lang="vi" className={cn("h-full", "antialiased", theme === "dark" ? "dark" : "", corinthia.variable, playfair.variable, inter.variable, "font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f8fafc" />
        <Script
          id="tenant-theme-bootstrap"
          strategy="beforeInteractive"
          src="/theme-bootstrap.js"
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Only wrap authenticated pages with TenantContextProvider */}
        {/* Auth pages (login, signup, etc.) should not be wrapped */}
        <QueryClientProvider>
          <TenantContextWrapper>
            {children}
          </TenantContextWrapper>
        </QueryClientProvider>
        <PwaRegister />
        <OfflineIndicator />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
