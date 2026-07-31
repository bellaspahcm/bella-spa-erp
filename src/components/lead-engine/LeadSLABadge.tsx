'use client';

import React from 'react';
import { ManagedLead, LeadSLAEngine, SLAStatusDisplay } from '@/platform/lead-engine';

interface LeadSLABadgeProps {
  lead: ManagedLead;
  slaEngine: LeadSLAEngine;
}

export function LeadSLABadge({ lead, slaEngine }: LeadSLABadgeProps) {
  const slaStatus: SLAStatusDisplay = slaEngine.evaluateSLAStatus(lead);

  const badgeColorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-bold',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColorClasses[slaStatus.badgeColor]}`}>
        {slaStatus.label}
      </span>
      {lead.rotationCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          🔄 Vòng {lead.rotationCount}
        </span>
      )}
    </div>
  );
}
