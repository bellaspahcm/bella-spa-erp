'use client';
/**
 * Real Estate Module Layout
 *
 * Dedicated layout wrapper for all /dashboard/real-estate/* routes.
 * Applies premium "luxury real estate" design tokens.
 *
 * ISOLATION GUARANTEE:
 *   - Scoped style selectors via [data-re-layout] attribute
 */
import React from 'react';
import './re-layout.css';

export default function RealEstateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-re-layout="true" className="re-layout-root flex-1 w-full min-h-full bg-slate-50 dark:bg-slate-950">
      {/* Main Content Area */}
      <main className="w-full px-6 py-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
