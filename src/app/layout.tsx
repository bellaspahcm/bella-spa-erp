import type { Metadata } from "next";
import { Corinthia } from 'next/font/google';
import "./globals.css";

const corinthia = Corinthia({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-handwriting',
});

export const metadata: Metadata = {
  title: "Bella Spa ERP",
  description: "Advanced ERP System for Bella Spa",
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${corinthia.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
