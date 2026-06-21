/**
 * CurrencyInput Component Demo & Documentation
 * 
 * This file serves as both documentation and testing playground for CurrencyInput.
 * You can create a demo page at /dashboard/demo-currency-input to test this component.
 */

'use client';

import { useState } from 'react';
import { CurrencyInput } from './CurrencyInput';

export function CurrencyInputDemo() {
  const [basicValue, setBasicValue] = useState(0);
  const [debitValue, setDebitValue] = useState(199500);
  const [creditValue, setCreditValue] = useState(0);
  const [largeValue, setLargeValue] = useState(1500000000); // 1.5 billion
  const [minMaxValue, setMinMaxValue] = useState(50000);
  const [negativeValue, setNegativeValue] = useState(0);
  const [disabledValue] = useState(1000000);
  const [readOnlyValue] = useState(500000);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#11100F] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50">
          <h1 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1] mb-2">
            CurrencyInput Component Demo
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CDBCAB]/80">
            A professional Vietnamese Dong (VND) input component with auto-formatting and validation.
          </p>
        </div>

        {/* Basic Example */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-2">
              1. Basic Usage
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#CDBCAB]/80 mb-4">
              Standard currency input with auto-formatting. Try typing "199500" - it will display as "199.500đ"
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#CDBCAB] mb-2">
                Amount Input
              </label>
              <CurrencyInput 
                value={basicValue}
                onChange={setBasicValue}
                placeholder="Nhập số tiền"
              />
            </div>
            <div className="flex items-end">
              <div className="text-sm">
                <span className="text-xs font-bold text-slate-500 dark:text-[#CDBCAB]/60">Raw Value:</span>
                <div className="font-mono font-bold text-lg text-primary">
                  {basicValue.toLocaleString('vi-VN')} VND
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#11100F] rounded-xl p-4 text-xs font-mono">
            <div className="text-slate-600 dark:text-[#CDBCAB]/60">Usage:</div>
            <pre className="mt-2 text-slate-800 dark:text-[#EFE9E1]">{`<CurrencyInput 
  value={amount}
  onChange={(val) => setAmount(val)}
  placeholder="Nhập số tiền"
/>`}</pre>
          </div>
        </div>

        {/* Accounting Entry Example */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-2">
              2. Accounting Entry (Debit/Credit)
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#CDBCAB]/80 mb-4">
              Styled for accounting contexts with color-coded debit (green) and credit (red).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                Phát sinh Nợ (Debit)
              </label>
              <CurrencyInput 
                value={debitValue}
                onChange={(val) => {
                  setDebitValue(val);
                  if (val > 0) setCreditValue(0);
                }}
                placeholder="0"
                className="text-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 mb-2">
                Phát sinh Có (Credit)
              </label>
              <CurrencyInput 
                value={creditValue}
                onChange={(val) => {
                  setCreditValue(val);
                  if (val > 0) setDebitValue(0);
                }}
                placeholder="0"
                className="text-rose-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#11100F] rounded-xl">
            <div className="text-xs font-bold text-slate-600 dark:text-[#CDBCAB]/80">
              Balance Check:
            </div>
            <div className={`text-sm font-black ${debitValue === creditValue && debitValue > 0 ? 'text-emerald-600' : 'text-yellow-600'}`}>
              {debitValue === creditValue && debitValue > 0 ? '✓ Balanced' : '⚠ Not Balanced'}
            </div>
          </div>
        </div>

        {/* Large Numbers */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-2">
              3. Large Numbers Handling
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#CDBCAB]/80 mb-4">
              Handles large amounts like revenue, salary funds with proper formatting.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#CDBCAB] mb-2">
              Revenue / Salary Fund
            </label>
            <CurrencyInput 
              value={largeValue}
              onChange={setLargeValue}
              placeholder="Nhập số tiền lớn"
            />
            <div className="mt-2 text-xs text-slate-500 dark:text-[#CDBCAB]/60">
              Display: {largeValue.toLocaleString('vi-VN')}đ
            </div>
          </div>
        </div>

        {/* Min/Max Validation */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-2">
              4. Min/Max Validation
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#CDBCAB]/80 mb-4">
              Enforce minimum and maximum value constraints (min: 10,000 / max: 1,000,000).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#CDBCAB] mb-2">
              Amount (10K - 1M)
            </label>
            <CurrencyInput 
              value={minMaxValue}
              onChange={setMinMaxValue}
              min={10000}
              max={1000000}
              placeholder="10.000 - 1.000.000"
            />
            <div className="mt-2 text-xs text-slate-500 dark:text-[#CDBCAB]/60">
              Try entering values outside range - they will be clamped.
            </div>
          </div>
        </div>

        {/* Negative Values */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-2">
              5. Negative Values Support
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#CDBCAB]/80 mb-4">
              Allow negative amounts for adjustments, corrections, or refunds.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#CDBCAB] mb-2">
              Adjustment Amount (can be negative)
            </label>
            <CurrencyInput 
              value={negativeValue}
              onChange={setNegativeValue}
              allowNegative={true}
              placeholder="Nhập số tiền (có thể âm)"
            />
            <div className="mt-2 text-xs text-slate-500 dark:text-[#CDBCAB]/60">
              Type "-" to enter negative amount.
            </div>
          </div>
        </div>

        {/* Disabled & Read-only */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-2">
              6. Disabled & Read-only States
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#CDBCAB]/80 mb-4">
              Show values without allowing editing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#CDBCAB] mb-2">
                Disabled Input
              </label>
              <CurrencyInput 
                value={disabledValue}
                onChange={() => {}}
                disabled={true}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#CDBCAB] mb-2">
                Read-only Input
              </label>
              <CurrencyInput 
                value={readOnlyValue}
                onChange={() => {}}
                readOnly={true}
              />
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="bg-gradient-to-r from-primary/5 to-pink-100/50 dark:from-primary/10 dark:to-pink-900/20 rounded-3xl p-8 border border-primary/20">
          <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-4">
            ✨ Key Features
          </h2>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-[#CDBCAB]">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Auto-formatting:</strong> Automatically adds thousand separators (.) as you type</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Integer-only:</strong> No decimals to avoid confusion (e.g., 199.5 vs 199,500)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Smart paste:</strong> Automatically extracts numbers from pasted text</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Keyboard-only:</strong> Prevents non-numeric input, supports navigation keys</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Min/Max validation:</strong> Enforces bounds automatically</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Negative support:</strong> Optional negative values for adjustments</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Accessible:</strong> ARIA attributes for screen readers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <span><strong>Dark mode:</strong> Fully styled for both light and dark themes</span>
            </li>
          </ul>
        </div>

        {/* Usage Guide */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-[#3E3A35]/50">
          <h2 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] mb-4">
            📖 Usage Guide
          </h2>
          <div className="space-y-4 text-sm text-slate-700 dark:text-[#CDBCAB]">
            <div>
              <h3 className="font-bold mb-2">Import:</h3>
              <pre className="bg-slate-50 dark:bg-[#11100F] p-4 rounded-xl overflow-x-auto text-xs">
{`import { CurrencyInput } from '@/components/ui/CurrencyInput';`}
              </pre>
            </div>

            <div>
              <h3 className="font-bold mb-2">Props:</h3>
              <div className="bg-slate-50 dark:bg-[#11100F] p-4 rounded-xl space-y-2 text-xs">
                <div><code className="text-primary">value</code>: number - Current value in VND (integer)</div>
                <div><code className="text-primary">onChange</code>: (value: number) =&gt; void - Callback when value changes</div>
                <div><code className="text-primary">placeholder?</code>: string - Placeholder text</div>
                <div><code className="text-primary">disabled?</code>: boolean - Disable input</div>
                <div><code className="text-primary">readOnly?</code>: boolean - Read-only mode</div>
                <div><code className="text-primary">min?</code>: number - Minimum allowed value</div>
                <div><code className="text-primary">max?</code>: number - Maximum allowed value</div>
                <div><code className="text-primary">allowNegative?</code>: boolean - Allow negative values</div>
                <div><code className="text-primary">showCurrency?</code>: boolean - Show "đ" suffix (default: true)</div>
                <div><code className="text-primary">error?</code>: boolean - Error state styling</div>
                <div><code className="text-primary">className?</code>: string - Additional CSS classes</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
