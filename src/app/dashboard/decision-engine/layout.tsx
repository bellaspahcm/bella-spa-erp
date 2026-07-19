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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#11100F] transition-colors duration-300">
      {/* Navigation Tabs */}
      <DecisionEngineHeader />

      {/* Page Content */}
      <main className="flex-1 flex flex-col animate-in fade-in duration-500">{children}</main>
    </div>
  );
}
