'use client';
/**
 * Bella Auto Module Layout
 * Scopes styling and layout isolation for Automotive vertical.
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
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
