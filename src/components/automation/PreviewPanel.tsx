'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Code } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { useState } from 'react';

interface PreviewPanelProps {
  conditions: string[]; // Natural language conditions: ["Khách VIP", "Đặt dịch vụ >2tr"]
  actions: string[]; // Natural language actions: ["Giảm 15%", "Gửi SMS"]
  exampleScenario?: {
    customer: string;
    service: string;
    originalPrice: number;
    discount: number;
    finalPrice: number;
    sms?: string;
  };
  jsonData?: object; // For "View JSON" feature (collapsed by default)
  className?: string;
}

/**
 * PreviewPanel - Sticky side panel with live automation preview
 * 
 * Used in: Customize Template screen (Step 2)
 * Design: docs/design/AUTOMATION_STUDIO_UX_DESIGN.md - Component 4
 * 
 * Features:
 * - Live updates (instant feedback)
 * - Real data examples (not abstract text)
 * - Copy to clipboard
 * - JSON viewer (collapsed, for tech users)
 * - Sticky positioning (always visible)
 */
export function PreviewPanel({
  conditions,
  actions,
  exampleScenario,
  jsonData,
  className
}: PreviewPanelProps) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const text = `
Khi:
${conditions.map(c => `• ${c}`).join('\n')}

Bella sẽ:
${actions.map(a => `• ${a}`).join('\n')}
${exampleScenario ? `\nVí dụ:\n${exampleScenario.customer} đặt ${exampleScenario.service} ${formatMoney(exampleScenario.originalPrice)} → Giảm ${formatMoney(exampleScenario.discount)} → Trả ${formatMoney(exampleScenario.finalPrice)}` : ''}
    `.trim();
    
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <motion.div
      className={cn(
        'flex flex-col gap-4 p-6',
        'w-full max-w-[360px]',
        'border border-rose-200 rounded-2xl',
        'bg-gradient-to-b from-rose-50 to-white',
        
        // Sticky positioning (Desktop)
        'sticky top-20',
        
        className
      )}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">✨</span>
        <h3 className="text-lg font-semibold text-gray-900">Bella sẽ:</h3>
      </div>
      
      {/* Conditions */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Khi:</h4>
        <AnimatePresence mode="popLayout">
          {conditions.length > 0 ? (
            <ul className="space-y-1">
              {conditions.map((condition, index) => (
                <motion.li
                  key={`${condition}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-gray-600 flex items-start gap-2"
                >
                  <span className="text-rose-500 mt-0.5">•</span>
                  <span>{condition}</span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 italic">(Chưa chọn điều kiện)</p>
          )}
        </AnimatePresence>
      </div>
      
      {/* Actions */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Bella sẽ:</h4>
        <AnimatePresence mode="popLayout">
          {actions.length > 0 ? (
            <ul className="space-y-1">
              {actions.map((action, index) => (
                <motion.li
                  key={`${action}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="text-sm text-gray-600 flex items-start gap-2"
                >
                  <span className="text-rose-500 mt-0.5">•</span>
                  <span>{action}</span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 italic">(Chưa chọn hành động)</p>
          )}
        </AnimatePresence>
      </div>
      
      {/* Example Scenario (Real Data!) */}
      {exampleScenario && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-white rounded-lg border border-rose-100"
        >
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <span>💡</span>
            <span>Ví dụ thực tế:</span>
          </h4>
          
          <div className="space-y-1 text-xs text-gray-600">
            <p>Khách: <strong>{exampleScenario.customer}</strong></p>
            <p>Dịch vụ: <strong>{exampleScenario.service}</strong></p>
            <p>Giá: <strong>{formatMoney(exampleScenario.originalPrice)}</strong></p>
            
            <div className="pt-2 mt-2 border-t border-gray-100 space-y-0.5">
              <p className="text-green-600">→ Giảm: <strong>-{formatMoney(exampleScenario.discount)}</strong></p>
              <p className="text-rose-600 text-sm font-semibold">→ Khách trả: <strong>{formatMoney(exampleScenario.finalPrice)}</strong></p>
            </div>
            
            {exampleScenario.sms && (
              <div className="pt-2 mt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">→ SMS gửi:</p>
                <p className="text-xs text-gray-700 italic">"{exampleScenario.sms}"</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
      
      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleCopy}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2',
            'text-xs font-medium text-gray-700',
            'bg-white border border-gray-200 rounded-lg',
            'hover:bg-gray-50',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-gray-300'
          )}
        >
          <Copy size={12} />
          <span>{copied ? '✓ Đã copy' : 'Copy'}</span>
        </button>
        
        {jsonData && (
          <button
            onClick={() => setShowJson(!showJson)}
            className={cn(
              'flex items-center justify-center gap-1.5 px-3 py-2',
              'text-xs font-medium text-gray-600',
              'bg-white border border-gray-200 rounded-lg',
              'hover:bg-gray-50',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-gray-300'
            )}
          >
            <Code size={12} />
            <span>JSON</span>
          </button>
        )}
      </div>
      
      {/* JSON Viewer (Collapsed by default, for tech users) */}
      <AnimatePresence>
        {showJson && jsonData && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-gray-900 rounded-lg text-xs text-green-400 overflow-auto max-h-[200px]"
          >
            {JSON.stringify(jsonData, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Helper function
function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}
