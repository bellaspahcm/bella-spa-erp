'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface CurrencyInputProps {
  /** Current value in VND (integer, e.g., 199500) */
  value: number;
  /** Callback when value changes (returns integer VND amount) */
  onChange: (value: number) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable input */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Show currency symbol */
  showCurrency?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Input name attribute */
  name?: string;
  /** Input ID attribute */
  id?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Error state styling */
  error?: boolean;
  /** Allow negative values */
  allowNegative?: boolean;
}

/**
 * CurrencyInput component for Vietnamese Dong (VND)
 * 
 * Features:
 * - Auto-formats with thousand separators (.)
 * - Integer-only (no decimals to avoid confusion)
 * - Shows "đ" suffix
 * - Handles paste, keyboard events
 * - Validates min/max bounds
 * 
 * @example
 * ```tsx
 * <CurrencyInput
 *   value={199500}
 *   onChange={(val) => setAmount(val)}
 *   placeholder="Nhập số tiền"
 * />
 * ```
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      placeholder = '0',
      disabled = false,
      className,
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      showCurrency = true,
      autoFocus = false,
      name,
      id,
      readOnly = false,
      error = false,
      allowNegative = false,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Merge external ref with internal ref
    useEffect(() => {
      if (ref && typeof ref === 'function') {
        ref(inputRef.current);
      } else if (ref && 'current' in ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = inputRef.current;
      }
    }, [ref]);

    // Format number to display string (e.g., 199500 → "199.500")
    const formatNumber = (num: number): string => {
      if (num === 0) return '';
      const absNum = Math.abs(num);
      const formatted = absNum.toLocaleString('vi-VN');
      return num < 0 ? `-${formatted}` : formatted;
    };

    // Parse display string to number (e.g., "199.500" → 199500)
    const parseNumber = (str: string): number => {
      if (!str || str === '-') return 0;
      // Remove all dots (thousand separators)
      const cleaned = str.replace(/\./g, '');
      const num = parseInt(cleaned, 10);
      return isNaN(num) ? 0 : num;
    };

    // Update display value when prop value changes
    useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatNumber(value));
      }
    }, [value, isFocused]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly || disabled) return;

      const input = e.target.value;

      // Allow empty input
      if (input === '') {
        setDisplayValue('');
        onChange(0);
        return;
      }

      // Allow single minus for negative input
      if (allowNegative && input === '-') {
        setDisplayValue('-');
        return;
      }

      // Remove all non-digit characters except minus
      let cleaned = input.replace(/[^\d-]/g, '');

      // Ensure only one minus at the start
      if (allowNegative && cleaned.includes('-')) {
        const isNegative = cleaned.startsWith('-');
        cleaned = cleaned.replace(/-/g, '');
        if (isNegative) cleaned = '-' + cleaned;
      } else {
        cleaned = cleaned.replace(/-/g, '');
      }

      // Parse to number
      const numValue = parseNumber(cleaned);

      // Apply min/max bounds
      let boundedValue = numValue;
      if (!allowNegative && boundedValue < 0) {
        boundedValue = 0;
      }
      if (boundedValue < min) {
        boundedValue = min;
      }
      if (boundedValue > max) {
        boundedValue = max;
      }

      // Update display with formatted value
      setDisplayValue(formatNumber(boundedValue));
      
      // Call onChange with bounded integer value
      onChange(boundedValue);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (readOnly || disabled) return;

      e.preventDefault();
      const pasted = e.clipboardData.getData('text');
      
      // Extract only digits and optional minus
      let cleaned = pasted.replace(/[^\d-]/g, '');
      
      if (allowNegative && cleaned.includes('-')) {
        const isNegative = cleaned.startsWith('-');
        cleaned = cleaned.replace(/-/g, '');
        if (isNegative) cleaned = '-' + cleaned;
      } else {
        cleaned = cleaned.replace(/-/g, '');
      }

      const numValue = parseNumber(cleaned);

      // Apply bounds
      let boundedValue = numValue;
      if (!allowNegative && boundedValue < 0) {
        boundedValue = 0;
      }
      if (boundedValue < min) {
        boundedValue = min;
      }
      if (boundedValue > max) {
        boundedValue = max;
      }

      setDisplayValue(formatNumber(boundedValue));
      onChange(boundedValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (readOnly || disabled) return;

      // Allow: backspace, delete, tab, escape, enter, home, end, arrows
      if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'Tab' ||
        e.key === 'Escape' ||
        e.key === 'Enter' ||
        e.key === 'Home' ||
        e.key === 'End' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        return;
      }

      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      if (e.ctrlKey || e.metaKey) {
        if (
          e.key === 'a' ||
          e.key === 'c' ||
          e.key === 'v' ||
          e.key === 'x'
        ) {
          return;
        }
      }

      // Allow minus only at start if negative allowed
      if (allowNegative && e.key === '-' && !displayValue) {
        return;
      }

      // Allow only digits
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
      // Re-format on blur to ensure clean display
      setDisplayValue(formatNumber(value));
    };

    // Handle arrow up/down for incrementing/decrementing
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (readOnly || disabled || !isFocused) return;
      
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1000 : -1000; // Increment/decrement by 1,000
      let newValue = value + delta;

      // Apply bounds
      if (!allowNegative && newValue < 0) {
        newValue = 0;
      }
      if (newValue < min) {
        newValue = min;
      }
      if (newValue > max) {
        newValue = max;
      }

      onChange(newValue);
    };

    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onWheel={handleWheel}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          name={name}
          id={id}
          className={cn(
            'w-full px-3.5 py-2 bg-white dark:bg-[#1C1B19] border rounded-xl text-xs font-mono font-bold text-right outline-none transition-all',
            error
              ? 'border-red-300 dark:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
              : 'border-slate-200/50 dark:border-[#3E3A35]/50 focus:ring-2 focus:ring-primary/10',
            disabled && 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-[#11100F]',
            readOnly && 'cursor-default bg-slate-50 dark:bg-[#11100F]',
            showCurrency && 'pr-8',
            className
          )}
          aria-label="Currency input"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
        {showCurrency && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60 pointer-events-none">
            đ
          </span>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
