'use client';

/**
 * Beauty Spa themed Select component
 * Based on PremiumSelect but with Beauty Spa color scheme (green/teal)
 */

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

interface BeautySpaSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export const BeautySpaSelect: React.FC<BeautySpaSelectProps> = ({
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
          "w-full min-w-0 max-w-full overflow-hidden flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all duration-200",
          "bg-white hover:bg-slate-50",
          isOpen 
            ? "border-emerald-300 ring-2 ring-emerald-100" 
            : "border-slate-200 hover:border-emerald-200",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedOption?.icon && (
            <div className="text-emerald-600 shrink-0">
              {selectedOption.icon}
            </div>
          )}
          <span className={cn(
            "text-sm truncate",
            selectedOption ? "text-slate-800 font-medium" : "text-slate-400"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0",
          isOpen && "rotate-180 text-emerald-500"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-1 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <div className="max-h-60 overflow-y-auto">
              {options.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400 text-center">
                  Không có tùy chọn nào
                </div>
              ) : hasGroups ? (
                Object.entries(groupedOptions).map(([group, groupOptions]) => (
                  <div key={group} className="mb-1 last:mb-0">
                    {group && (
                      <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50 sticky top-0">
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
                          "w-full flex items-center justify-between px-4 py-2 text-left text-sm transition-colors",
                          value === option.value
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {option.icon && (
                            <div className={cn(
                              "transition-colors shrink-0",
                              value === option.value ? "text-emerald-600" : "text-slate-400"
                            )}>
                              {option.icon}
                            </div>
                          )}
                          <span className="truncate">{option.label}</span>
                        </div>
                        {value === option.value && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
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
                      "w-full flex items-center justify-between px-4 py-2 text-left text-sm transition-colors",
                      value === option.value
                        ? "bg-emerald-50 text-emerald-700 font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {option.icon && (
                        <div className={cn(
                          "transition-colors shrink-0",
                          value === option.value ? "text-emerald-600" : "text-slate-400"
                        )}>
                          {option.icon}
                        </div>
                      )}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
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
