'use client';
/**
 * Bella Auto Module Layout
 *
 * Dedicated layout wrapper for all /dashboard/bella-auto/* routes.
 * Applies "Ocean Clean" automotive theme (cyan/teal professional).
 *
 * ISOLATION GUARANTEE:
 *   - Scoped style selectors via [data-auto-layout] attribute
 *   - Zero impact on Bella Spa / Baby Care / Real Estate modules
 */
import React from 'react';
import './auto-layout.css';

export default function BellaAutoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-auto-layout="true" className="auto-layout-root flex-1 w-full min-h-full bg-slate-50 dark:bg-slate-950">
      {/* Main Content Area */}
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
