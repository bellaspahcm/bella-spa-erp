/**
 * Automation Studio - ActionRadioCard Component
 * 
 * A radio card for selecting automation actions.
 * Features:
 * - Radio card UI (not plain radio button)
 * - Configuration controls (slider, input, dropdown)
 * - Selected state styling
 * - Live value editing
 * 
 * @author Automation Studio Team
 * @date 2026-07-09
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { ActionConfig } from '@/lib/automation/templates';

interface ActionRadioCardProps {
  action: ActionConfig;
  isSelected: boolean;
  onSelect: () => void;
  onValueChange?: (value: string | number | boolean) => void;
}

export function ActionRadioCard({
  action,
  isSelected,
  onSelect,
  onValueChange,
}: ActionRadioCardProps) {
  const [localValue, setLocalValue] = useState(action.value);

  const handleValueChange = (newValue: string | number | boolean) => {
    setLocalValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden',
        isSelected
          ? 'border-green-500 bg-green-50 shadow-md shadow-green-500/20'
          : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-sm'
      )}
      onClick={onSelect}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Radio Button */}
          <div
            className={clsx(
              'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
              isSelected
                ? 'border-green-500 bg-green-500'
                : 'border-gray-300 bg-white'
            )}
          >
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-3 h-3 bg-white rounded-full"
              />
            )}
          </div>

          {/* Icon + Label */}
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{action.icon}</span>
              <h4 className="font-semibold text-gray-900">
                {action.label}
              </h4>
            </div>
            <p className="text-sm text-gray-600">
              {action.description}
            </p>

            {/* Configuration Controls (only show when selected) */}
            {isSelected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ delay: 0.1 }}
                className="mt-4 pt-4 border-t border-green-200"
                onClick={(e) => e.stopPropagation()}
              >
                {renderConfigControl(action, localValue, handleValueChange)}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Badge (Top Right) */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2"
        >
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4 text-white" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Config Control Renderers
// ============================================================================

function renderConfigControl(
  action: ActionConfig,
  value: string | number | boolean,
  onChange: (value: string | number | boolean) => void
) {
  const valueType = typeof action.value;

  // Number input (for discount %, bonus amount, etc.)
  if (valueType === 'number') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Giá trị
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            min={0}
          />
          <span className="text-sm text-gray-600 font-medium">
            {getUnitLabel(action.type)}
          </span>
        </div>
        {/* Slider for percentage actions */}
        {action.type === 'apply_discount' && (
          <input
            type="range"
            min={0}
            max={100}
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full mt-3 accent-green-500"
          />
        )}
      </div>
    );
  }

  // Text input (for SMS message, etc.)
  if (valueType === 'string') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Nội dung
        </label>
        <textarea
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          placeholder="Nhập nội dung..."
        />
        <p className="text-xs text-gray-500 mt-1">
          💡 Dùng {'{name}'}, {'{time}'}, {'{value}'} để chèn dữ liệu động
        </p>
      </div>
    );
  }

  // Boolean toggle (for enable/disable actions)
  if (valueType === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Kích hoạt
        </label>
        <button
          onClick={() => onChange(!value)}
          className={clsx(
            'relative w-12 h-6 rounded-full transition-colors',
            value ? 'bg-green-500' : 'bg-gray-300'
          )}
        >
          <motion.div
            animate={{ x: value ? 24 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
          />
        </button>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getUnitLabel(actionType: ActionConfig['type']): string {
  const units: Partial<Record<ActionConfig['type'], string>> = {
    apply_discount: '%',
    award_points: 'điểm',
    apply_bonus: 'VNĐ',
    apply_deduction: 'VNĐ',
    reorder_stock: 'sản phẩm',
  };
  return units[actionType] || '';
}
