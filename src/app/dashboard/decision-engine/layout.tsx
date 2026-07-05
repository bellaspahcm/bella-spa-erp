/**
 * Decision Engine Dashboard Layout
 * 
 * Shared layout for all Decision Engine pages with navigation tabs.
 */

import DecisionEngineNav from './DecisionEngineNav';

export default function DecisionEngineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <DecisionEngineNav />

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
