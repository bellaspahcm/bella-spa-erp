'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  value: string;
  label: string;
  group?: string;
  icon?: React.ReactNode;
}

interface PremiumSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export const PremiumSelect: React.FC<PremiumSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Chọn một tùy chọn...",
  label,
  className,
  buttonClassName,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  const groupedOptions = options.reduce((acc, option) => {
    const group = option.group || '';
    if (!acc[group]) acc[group] = [];
    acc[group].push(option);
    return acc;
  }, {} as Record<string, Option[]>);
  const hasGroups = Object.keys(groupedOptions).some(key => key !== '');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative w-full min-w-0 max-w-full space-y-1.5", className)} ref={containerRef}>
      {label && (
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || cn(
          "w-full min-w-0 max-w-full overflow-hidden flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all duration-300",
          "bg-white shadow-sm hover:shadow-md active:scale-[0.98]",
          isOpen 
            ? "border-rose-300 ring-4 ring-rose-50 ring-offset-0 shadow-rose-100/50 dark:shadow-none" 
            : "border-slate-100 hover:border-rose-200",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50 grayscale-[0.5]"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selectedOption?.icon && (
            <div className="text-rose-500 shrink-0">
              {selectedOption.icon}
            </div>
          )}
          <span className={cn(
            "text-sm font-semibold truncate",
            selectedOption ? "text-slate-800" : "text-slate-400"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0",
          isOpen && "rotate-180 text-rose-400"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-50 mt-2 w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/95 backdrop-blur-sm py-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:border-[#3E3A35]/70 dark:bg-[#1C1B19] dark:shadow-none"
          >
            <div className="max-h-[18rem] overflow-y-auto overscroll-contain custom-scrollbar">
              {options.length === 0 ? (
                <div className="px-5 py-4 text-sm text-slate-400 text-center italic">
                  Không có tùy chọn nào
                </div>
              ) : hasGroups ? (
                Object.entries(groupedOptions).map(([group, groupOptions]) => (
                  <div key={group} className="mb-1 last:mb-0">
                    {group && (
                      <div className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 border-y border-slate-100">
                        {group}
                      </div>
                    )}
                    {groupOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onChange(option.value);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-5 py-3 text-left text-sm transition-colors",
                          value === option.value
                            ? "bg-rose-50 text-rose-800 font-bold dark:bg-[#5D1C34]/30 dark:text-[#EFE9E1]"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-[#CDBCAB] dark:hover:bg-[#11100F] dark:hover:text-[#EFE9E1]"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {option.icon && (
                            <div className={cn(
                              "transition-colors shrink-0",
                              value === option.value ? "text-rose-500" : "text-slate-400"
                            )}>
                              {option.icon}
                            </div>
                          )}
                          <span className="truncate">{option.label}</span>
                        </div>
                        {value === option.value && (
                          <Check className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                ))
              ) : (
                options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-5 py-3 text-left text-sm transition-colors",
                      value === option.value
                        ? "bg-rose-50 text-rose-800 font-bold dark:bg-[#5D1C34]/30 dark:text-[#EFE9E1]"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-[#CDBCAB] dark:hover:bg-[#11100F] dark:hover:text-[#EFE9E1]"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {option.icon && (
                        <div className={cn(
                          "transition-colors shrink-0",
                          value === option.value ? "text-rose-500" : "text-slate-400"
                        )}>
                          {option.icon}
                        </div>
                      )}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
