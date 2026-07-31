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
  title: {
    default: "Bella EIP — Enterprise Platform",
    template: "%s | Bella EIP",
  },
  description: "Nền tảng Quản trị Doanh nghiệp Đa ngành Bella EIP",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bella EIP",
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
import { registerRealEstateModule } from "@/modules/real_estate/register";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


registerSpaModule();
registerRealEstateModule();

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
        <Script id="prevent-zoom" strategy="afterInteractive">
          {`
            document.addEventListener('gesturestart', function(e) {
              e.preventDefault();
            }, { passive: false });
            document.addEventListener('gesturechange', function(e) {
              e.preventDefault();
            }, { passive: false });
            document.addEventListener('gestureend', function(e) {
              e.preventDefault();
            }, { passive: false });
            
            // Also prevent double tap to zoom
            let lastTouchEnd = 0;
            document.addEventListener('touchend', function(e) {
              const now = new Date().getTime();
              if (now - lastTouchEnd <= 300) {
                e.preventDefault();
              }
              lastTouchEnd = now;
            }, { passive: false });
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col select-none touch-manipulation" suppressHydrationWarning>
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
