'use client';

import { motion } from 'framer-motion';
import { Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  id: string;
  emoji: string;
  title: string;
  description: string;
  usageCount: number; // Social proof: "248 spa đang dùng"
  timeSaved?: string; // "Tiết kiệm 3h/tuần"
  onViewDetails?: () => void;
  onUse: () => void;
  className?: string;
}

/**
 * TemplateCard - Display automation template in gallery
 * 
 * Used in: Template Gallery (Homepage - PRIMARY FLOW)
 * Design: docs/design/AUTOMATION_STUDIO_UX_DESIGN.md - Component 8
 * 
 * Features:
 * - Social proof (usage count)
 * - Value proposition (time saved)
 * - Hover animation
 * - Emoji for visual identity
 * - Two CTAs: View Details (optional) + Use (primary)
 */
export function TemplateCard({
  id,
  emoji,
  title,
  description,
  usageCount,
  timeSaved,
  onViewDetails,
  onUse,
  className
}: TemplateCardProps) {
  return (
    <motion.div
      className={cn(
        'relative flex flex-col gap-3 p-5',
        'w-full min-h-[200px]',
        'border border-gray-200 rounded-xl',
        'bg-white transition-all duration-200',
        
        // Hover state
        'hover:border-rose-300',
        'hover:shadow-[0_6px_12px_rgba(244,63,94,0.12)]',
        'hover:-translate-y-1',
        
        className
      )}
      whileHover={{ scale: 1.01 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Emoji Icon (Large) */}
      <div className="text-4xl" role="img" aria-label={title}>
        {emoji}
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
        {title}
      </h3>
      
      {/* Description */}
      <p className="text-sm text-gray-600 line-clamp-2 flex-grow">
        {description}
      </p>
      
      {/* Social Proof & Value Props */}
      <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
        {/* Usage Count (Social Proof) */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Users size={14} className="text-rose-400" />
          <span>
            <strong className="text-rose-600 font-medium">{usageCount}</strong> spa đang dùng
          </span>
        </div>
        
        {/* Time Saved (Value Prop) */}
        {timeSaved && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={14} className="text-green-400" />
            <span>{timeSaved}</span>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2 pt-3">
        {onViewDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            className={cn(
              'px-3 py-1.5 text-sm font-medium',
              'text-gray-700 bg-gray-100',
              'rounded-lg',
              'hover:bg-gray-200',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-gray-300'
            )}
          >
            Xem chi tiết
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
          className={cn(
            'flex-1 px-4 py-1.5 text-sm font-semibold',
            'text-white bg-rose-500',
            'rounded-lg',
            'hover:bg-rose-600',
            'active:scale-98',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2'
          )}
        >
          Dùng
        </button>
      </div>
    </motion.div>
  );
}
