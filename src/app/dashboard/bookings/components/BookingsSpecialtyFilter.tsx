'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type KtvSpecialty = 'all' | 'combo' | 'baby' | 'pregnancy' | 'lactation';

type SpecialtyOption = {
  id: KtvSpecialty;
  label: string;
  icon: ReactNode;
};

type BookingsSpecialtyFilterProps = {
  value: KtvSpecialty;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onValueChange: (value: KtvSpecialty) => void;
};

const specialties: SpecialtyOption[] = [
  { id: 'all', label: 'Tất cả KTV', icon: <Users className="w-4 h-4" /> },
  { id: 'combo', label: 'Combo Mẹ Bé', icon: <Briefcase className="w-4 h-4 text-rose-400" /> },
  { id: 'baby', label: 'Tắm Bé', icon: <Briefcase className="w-4 h-4 text-purple-400" /> },
  { id: 'pregnancy', label: 'Massage Bầu', icon: <Briefcase className="w-4 h-4 text-indigo-400" /> },
  { id: 'lactation', label: 'Thông tia sữa/Kích sữa', icon: <Briefcase className="w-4 h-4 text-emerald-400" /> },
];

function scrollTimelineBody(left: number) {
  const body = document.getElementById('timeline-body');
  if (body) body.scrollBy({ left, behavior: 'smooth' });
}

export function BookingsSpecialtyFilter({
  value,
  isOpen,
  onOpenChange,
  onValueChange,
}: BookingsSpecialtyFilterProps) {
  const currentSpec = specialties.find((specialty) => specialty.id === value) || specialties[0];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none">
      <div className="block sm:hidden w-full relative">
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all duration-300 bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md active:scale-[0.98] outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            {currentSpec.icon}
            <span className="text-xs font-black uppercase tracking-wider truncate">
              {currentSpec.label}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0',
              isOpen && 'rotate-180 text-primary',
            )}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden py-2"
              >
                {specialties.map((specialty) => {
                  const isActive = value === specialty.id;

                  return (
                    <button
                      key={specialty.id}
                      type="button"
                      onClick={() => {
                        onValueChange(specialty.id);
                        onOpenChange(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-5 py-3 text-left transition-colors',
                        isActive
                          ? 'bg-rose-50/50 text-[#BE185D] font-black'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      {specialty.icon}
                      <span className="text-xs font-bold uppercase tracking-wider truncate">
                        {specialty.label}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="hidden sm:flex items-center gap-2 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 w-full sm:w-auto overflow-x-auto no-scrollbar flex-nowrap py-1">
        {specialties.map((specialty) => {
          const isActive = value === specialty.id;

          return (
            <button
              key={specialty.id}
              type="button"
              onClick={() => onValueChange(specialty.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {specialty.icon}
              <span>{specialty.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollTimelineBody(-240)}
          className="p-2.5 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollTimelineBody(240)}
          className="p-2.5 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-slate-500 hover:text-slate-800"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
