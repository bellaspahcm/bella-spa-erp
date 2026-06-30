'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SalaryComponentCardProps {
  title: string;
  amount: number;
  icon?: React.ReactNode;
  variant?: 'income' | 'deduction' | 'neutral';
  tooltip?: string;
  badge?: string;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export function SalaryComponentCard({
  title,
  amount,
  icon,
  variant = 'neutral',
  tooltip,
  badge,
  children,
  defaultExpanded = false,
  className = '',
}: SalaryComponentCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const variantStyles = {
    income: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
    deduction: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    neutral: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  };

  const amountStyles = {
    income: 'text-emerald-700 dark:text-emerald-300',
    deduction: 'text-red-700 dark:text-red-300',
    neutral: 'text-gray-900 dark:text-gray-100',
  };

  const formatAmount = (value: number) => {
    const prefix = variant === 'income' ? '+' : variant === 'deduction' ? '-' : '';
    return `${prefix}${Math.abs(value).toLocaleString('vi-VN')} đ`;
  };

  return (
    <div className={cn('rounded-lg border overflow-hidden transition-all', variantStyles[variant], className)}>
      {/* Header - Always visible */}
      <button
        onClick={() => children && setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-4 transition-colors',
          children ? 'hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer' : 'cursor-default'
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          {icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center">
              {icon}
            </div>
          )}

          {/* Title & Badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              {badge && (
                <span className="px-2 py-0.5 text-xs font-medium bg-white/60 dark:bg-black/30 text-gray-700 dark:text-gray-300 rounded-full">
                  {badge}
                </span>
              )}
              {tooltip && (
                <div className="group relative inline-flex z-10">
                  <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[9999] hidden group-hover:block pointer-events-none min-w-max">
                    <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 max-w-xs whitespace-normal shadow-2xl border border-gray-700">
                      {tooltip}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 border-r border-b border-gray-700" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn('text-lg font-black', amountStyles[variant])}>
              {formatAmount(amount)}
            </span>
            {children && (
              <div className="text-gray-400">
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {children && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-black/5 dark:border-white/5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
