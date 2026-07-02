import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// STAT CARD - Statistics card với icon và accent color
// ============================================================================
interface IntelligenceStatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: string;
  className?: string;
}

export function IntelligenceStatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "bg-rose-50 text-primary",
  className
}: IntelligenceStatCardProps) {
  return (
    <div className={cn("rounded-[2rem] border border-rose-100 bg-white p-6 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          {hint && (
            <p className="mt-2 text-xs font-bold text-slate-500">
              {hint}
            </p>
          )}
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", accent)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STATS GRID - Grid container cho stat cards
// ============================================================================
interface IntelligenceStatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function IntelligenceStatsGrid({ 
  children, 
  columns = 4,
  className 
}: IntelligenceStatsGridProps) {
  const gridClasses = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 xl:grid-cols-4"
  };

  return (
    <div className={cn("mb-8 grid gap-4", gridClasses[columns], className)}>
      {children}
    </div>
  );
}
