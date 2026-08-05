'use client';
/**
 * Healthcare Module Layout
 *
 * Dedicated layout wrapper for all /dashboard/healthcare/* routes.
 * Applies premium "Healthcare OS" design tokens.
 *
 * ISOLATION GUARANTEE:
 *   - Scoped style selectors via [data-hc-layout] attribute
 */
import React, { useEffect } from 'react';
import { bootstrapHealthcareKernel } from '@/modules/bella-healthcare/kernel/bootstrap';
import './hc-layout.css';

export default function HealthcareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Dynamically bootstrap healthcare capabilities and providers upon navigation
    bootstrapHealthcareKernel();
  }, []);
  return (
    <div data-hc-layout="true" className="hc-layout-root flex-1 w-full min-h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
