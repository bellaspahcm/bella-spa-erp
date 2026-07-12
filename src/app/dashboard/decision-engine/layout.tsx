/**
 * Decision Engine Dashboard Layout
 * 
 * Shared layout for all Decision Engine pages with navigation tabs.
 */

import DecisionEngineHeader from '@/components/decision-engine/DecisionEngineHeader';

export default function DecisionEngineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#11100F] transition-colors duration-300">
      {/* Navigation Tabs */}
      <DecisionEngineHeader />

      {/* Page Content */}
      <main className="animate-in fade-in duration-500">{children}</main>
    </div>
  );
}
