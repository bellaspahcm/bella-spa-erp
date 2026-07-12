'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface IntentCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
}

/**
 * IntentCard - Large clickable card for intent selection
 * 
 * Used in: Create automation from scratch flow (Step 1)
 * Design: docs/design/AUTOMATION_STUDIO_UX_DESIGN.md - Component 1
 * 
 * Features:
 * - Hover animation (lift + shadow)
 * - Icon scale on hover
 * - Selected state (border + background)
 * - Responsive sizing
 */
export function IntentCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  isSelected = false,
  className
}: IntentCardProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        // Base styles
        'relative flex flex-col items-center gap-3 p-6',
        'w-full min-h-[180px]',
        'border-2 rounded-xl',
        'bg-white transition-all duration-200',
        
        // Default state
        'border-rose-200',
        
        // Hover state
        'hover:shadow-[0_8px_16px_rgba(244,63,94,0.15)]',
        'hover:-translate-y-1',
        
        // Selected state
        isSelected && 'border-rose-500 bg-rose-50',
        
        // Focus state (keyboard navigation)
        'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2',
        
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      role="button"
      aria-label={`${title} - ${subtitle}`}
    >
      {/* Icon with hover scale animation */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      >
        <Icon 
          size={64} 
          className={cn(
            'text-rose-500',
            isSelected && 'text-rose-600'
          )}
          aria-hidden="true"
        />
      </motion.div>
      
      {/* Title */}
      <h3 className={cn(
        'text-lg font-semibold text-gray-900',
        isSelected && 'text-rose-600'
      )}>
        {title}
      </h3>
      
      {/* Subtitle */}
      <p className="text-sm text-gray-600 text-center line-clamp-2">
        {subtitle}
      </p>
    </motion.button>
  );
}
