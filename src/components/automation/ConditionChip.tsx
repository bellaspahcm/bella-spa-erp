/**
 * Automation Studio - ConditionChip Component
 * 
 * A checkbox card for selecting automation conditions.
 * Features:
 * - Checkbox card UI (not plain checkbox)
 * - Expandable details (collapsed by default)
 * - Selected state styling
 * - Hover animations
 * 
 * @author Automation Studio Team
 * @date 2026-07-09
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { ConditionConfig } from '@/lib/automation/templates';

interface ConditionChipProps {
  condition: ConditionConfig;
  isSelected: boolean;
  onToggle: () => void;
  isExpandedByDefault?: boolean;
}

export function ConditionChip({
  condition,
  isSelected,
  onToggle,
  isExpandedByDefault = false,
}: ConditionChipProps) {
  const [isExpanded, setIsExpanded] = useState(isExpandedByDefault);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden',
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/20'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
      )}
      onClick={onToggle}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div
            className={clsx(
              'flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
              isSelected
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-300 bg-white'
            )}
          >
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </div>

          {/* Icon + Label */}
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{condition.icon}</span>
              <h4 className="font-semibold text-gray-900">
                {condition.label}
              </h4>
            </div>
            <p className="text-sm text-gray-600">
              {condition.description}
            </p>
          </div>

          {/* Expand Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronDown
              className={clsx(
                'w-4 h-4 text-gray-500 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </button>
        </div>
      </div>

      {/* Expandable Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-200 bg-gray-50 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Operator */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Điều kiện
                </label>
                <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                  {getOperatorLabel(condition.operator)}
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Giá trị
                </label>
                <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-900">
                  {String(condition.value)}
                </div>
              </div>

              {/* Type Badge */}
              <div className="pt-2 border-t border-gray-200">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  {condition.type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Badge (Top Right) */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2"
        >
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4 text-white" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getOperatorLabel(operator: ConditionConfig['operator']): string {
  const labels: Record<ConditionConfig['operator'], string> = {
    equals: 'Bằng',
    greater_than: 'Lớn hơn',
    less_than: 'Nhỏ hơn',
    in_range: 'Trong khoảng',
    is_true: 'Đúng',
  };
  return labels[operator] || operator;
}
