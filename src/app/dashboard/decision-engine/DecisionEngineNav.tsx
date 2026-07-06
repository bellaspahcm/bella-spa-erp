/**
 * Decision Engine Navigation Component
 * Client component for navigation tabs with active state
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DecisionEngineNav() {
  const pathname = usePathname();

  const tabs = [
    {
      name: 'Audit Trail',
      href: '/dashboard/decision-engine/audit',
      description: 'Decision audit log',
    },
    {
      name: 'Observability',
      href: '/dashboard/decision-engine/observability',
      description: 'Metrics & performance',
      disabled: true, // Sprint 2
    },
    {
      name: 'Policies',
      href: '/dashboard/decision-engine/policies',
      description: 'Policy registry',
      disabled: true, // Sprint 3
    },
    {
      name: 'Coverage',
      href: '/dashboard/decision-engine/coverage',
      description: 'Rule coverage',
      disabled: true, // Sprint 3
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <nav className="flex space-x-8" aria-label="Decision Engine Navigation">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            const isDisabled = tab.disabled;

            return (
              <Link
                key={tab.name}
                href={isDisabled ? '#' : tab.href}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    isActive
                      ? 'border-primary text-primary font-semibold'
                      : isDisabled
                      ? 'border-transparent text-gray-400 cursor-not-allowed'
                      : 'border-transparent text-gray-500 hover:text-gray-750 hover:border-gray-300'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={isDisabled}
                title={isDisabled ? 'Coming soon' : tab.description}
                onClick={(e) => {
                  if (isDisabled) e.preventDefault();
                }}
              >
                {tab.name}
                {isDisabled && (
                  <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
