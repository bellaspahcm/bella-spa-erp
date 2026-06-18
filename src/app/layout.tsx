import type { Metadata } from "next";
import { Corinthia, Inter, Playfair_Display, Geist } from 'next/font/google';
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

import { Toaster } from "sonner";
import OfflineIndicator from "@/components/common/offline-indicator";
import PwaRegister from "@/components/common/PwaRegister";
import { TenantContextProvider } from "@/core/providers/TenantContextProvider";
import { cookies } from "next/headers";
import TenantContextWrapper from "@/components/providers/TenantContextWrapper";

// Register module adapters on app startup
import { registerSpaModule } from "@/modules/spa/register";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


registerSpaModule();

const tenantThemeBootstrapScript = `
(() => {
  try {
    const path = window.location.pathname || "";
    const isAppShell =
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/ktv" ||
      path.startsWith("/ktv/");

    if (!isAppShell) return;

    const root = document.documentElement;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const setThemeColor = (color) => {
      if (themeMeta) themeMeta.setAttribute("content", color);
    };
    const setRootVars = (vars) => {
      Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    };

    root.dataset.tenantModule = "pending";
    setRootVars({
      "--primary": "#334155",
      "--primary-hover": "#1e293b",
      "--accent": "#94a3b8",
      "--background": "#f8fafc",
      "--foreground": "#0F172A",
      "--border": "#e2e8f0",
      "--input": "#e2e8f0",
      "--ring": "#64748b",
    });
    setThemeColor("#f8fafc");
  } catch {
    const path = window.location.pathname || "";
    if (
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/ktv" ||
      path.startsWith("/ktv/")
    ) {
      document.documentElement.dataset.tenantModule = "pending";
    }
  }
})();
`;

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
        <script dangerouslySetInnerHTML={{ __html: tenantThemeBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Only wrap authenticated pages with TenantContextProvider */}
        {/* Auth pages (login, signup, etc.) should not be wrapped */}
        <TenantContextWrapper>
          {children}
        </TenantContextWrapper>
        <PwaRegister />
        <OfflineIndicator />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
