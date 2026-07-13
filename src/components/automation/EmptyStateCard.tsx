'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  icon: string; // Emoji
  label: string;
  onClick: () => void;
}

interface EmptyStateCardProps {
  icon: LucideIcon | string; // Lucide icon or emoji
  headline: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  quickActions?: QuickAction[];
  className?: string;
}

/**
 * EmptyStateCard - Show personality in empty states
 * 
 * Used in: Empty automation list, no search results, etc.
 * Design: docs/design/AUTOMATION_STUDIO_UX_DESIGN.md - Component 13
 * 
 * Features:
 * - Warm, friendly language (not "No data")
 * - Actionable CTAs
 * - Quick action chips
 * - Gradient background
 * - Centered layout
 * 
 * Examples:
 * - Empty automation list: "✨ Bắt đầu tự động hóa với Bella"
 * - No search results: "Không tìm thấy automation"
 */
export function EmptyStateCard({
  icon,
  headline,
  description,
  primaryAction,
  secondaryAction,
  quickActions,
  className
}: EmptyStateCardProps) {
  const IconComponent = typeof icon === 'string' ? null : icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center gap-6',
        'w-full min-h-[400px] p-12',
        'rounded-2xl',
        'bg-gradient-to-br from-rose-50 via-white to-white',
        className
      )}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="flex items-center justify-center w-20 h-20 rounded-full bg-rose-100"
      >
        {IconComponent ? (
          <IconComponent size={48} className="text-rose-500" />
        ) : (
          <span className="text-5xl" role="img" aria-label={headline}>
            {typeof icon === 'string' ? icon : ''}
          </span>
        )}
      </motion.div>
      
      {/* Headline */}
      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-2xl font-bold text-gray-900">
          {headline}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          {description}
        </p>
      </div>
      
      {/* Primary & Secondary Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex gap-3">
          {primaryAction && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={primaryAction.onClick}
              className={cn(
                'px-6 py-3 text-sm font-semibold',
                'text-white bg-rose-500',
                'rounded-xl',
                'hover:bg-rose-600',
                'shadow-lg shadow-rose-500/30',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2'
              )}
            >
              {primaryAction.label}
            </motion.button>
          )}
          
          {secondaryAction && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={secondaryAction.onClick}
              className={cn(
                'px-6 py-3 text-sm font-semibold',
                'text-gray-700 bg-white',
                'border border-gray-300 rounded-xl',
                'hover:bg-gray-50',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2'
              )}
            >
              {secondaryAction.label}
            </motion.button>
          )}
        </div>
      )}
      
      {/* Quick Actions (Chips) */}
      {quickActions && quickActions.length > 0 && (
        <div className="flex flex-col items-center gap-3 pt-4">
          <p className="text-xs text-gray-500 font-medium">Hoặc bắt đầu nhanh với:</p>
          
          <div className="flex flex-wrap gap-2 justify-center">
            {quickActions.map((action, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className={cn(
                  'flex items-center gap-2 px-4 py-2',
                  'text-sm font-medium text-gray-700',
                  'bg-white border border-gray-200 rounded-full',
                  'hover:border-rose-300 hover:bg-rose-50',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-rose-300'
                )}
              >
                <span className="text-lg" role="img">
                  {action.icon}
                </span>
                <span>{action.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
