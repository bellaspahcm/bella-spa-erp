import type { Metadata } from "next";
import { Corinthia, Inter, Playfair_Display } from 'next/font/google';
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
};

import { Toaster } from "sonner";
import OfflineIndicator from "@/components/common/offline-indicator";
import PwaRegister from "@/components/common/PwaRegister";
import { cookies } from "next/headers";

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
      "--primary": "#9D174D",
      "--primary-hover": "#831843",
      "--accent": "#BE185D",
      "--background": "#FDF2F5",
      "--foreground": "#0F172A",
      "--border": "#FCE4EC",
      "--input": "#FCE4EC",
      "--ring": "#9D174D",
    });
    setThemeColor("#FF85A2");

    const raw = window.sessionStorage.getItem("bella.runtime.brand.v1");
    if (!raw) return;

    const brand = JSON.parse(raw);
    if (!brand || (brand.moduleKey !== "babycare" && brand.moduleKey !== "beauty_spa")) return;

    root.dataset.tenantModule = brand.moduleKey;
    if (typeof brand.buttonStyle === "string") root.dataset.tenantBrandButton = brand.buttonStyle;
    if (typeof brand.menuStyle === "string") root.dataset.tenantBrandMenu = brand.menuStyle;
    if (typeof brand.radiusStyle === "string") root.dataset.tenantBrandRadius = brand.radiusStyle;

    if (brand.moduleKey === "beauty_spa") {
      const primary = typeof brand.primaryColor === "string" ? brand.primaryColor : "#074e44";
      const hover = typeof brand.primaryHoverColor === "string" ? brand.primaryHoverColor : "#0a6357";
      const accent = typeof brand.accentColor === "string" ? brand.accentColor : "#c8a97a";
      setRootVars({
        "--primary": primary,
        "--primary-hover": hover,
        "--accent": accent,
        "--background": "#f8f6f2",
        "--foreground": "#0b2240",
        "--border": "rgba(200, 169, 122, 0.24)",
        "--input": "rgba(200, 169, 122, 0.22)",
        "--ring": primary,
      });
      setThemeColor(primary);
      return;
    }

    setRootVars({
      "--primary": "#9D174D",
      "--primary-hover": "#831843",
      "--accent": "#BE185D",
      "--background": "#FDF2F5",
      "--foreground": "#0F172A",
      "--border": "#FCE4EC",
      "--input": "#FCE4EC",
      "--ring": "#9D174D",
    });
    setThemeColor("#FF85A2");
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
    <html lang="vi" className={`h-full antialiased ${theme === "dark" ? "dark" : ""} ${corinthia.variable} ${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bella ERP" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="theme-color" content="#FF85A2" />
        <script dangerouslySetInnerHTML={{ __html: tenantThemeBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <PwaRegister />
        <OfflineIndicator />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
