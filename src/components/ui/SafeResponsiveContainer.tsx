/**
 * SafeResponsiveContainer - Wrapper around Recharts ResponsiveContainer
 *
 * Purpose: Prevents "width(-1) and height(-1)" warnings by ensuring parent
 * containers have computed dimensions before rendering charts.
 *
 * How it works:
 * 1. Uses ResizeObserver to detect when container has real dimensions
 * 2. Only renders ResponsiveContainer after container width > 0
 * 3. Falls back to minWidth/minHeight guarantees
 *
 * Usage:
 *   Replace: import { ResponsiveContainer } from 'recharts';
 *   With:    import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
 *
 * @author Bella ERP Team
 * @date 2026-08-05
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

export function SafeResponsiveContainer({
  children,
  width = '100%',
  height = '100%',
  minWidth = 0,
  minHeight,
  ...props
}: React.ComponentProps<typeof RechartsResponsiveContainer>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      if (!Array.isArray(entries) || !entries.length) return;
      
      const entry = entries[0];
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      
      // Only set dimensions if they are valid positive values
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    });

    observer.observe(el);
    
    // Initial check
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      setDimensions({ width: el.offsetWidth, height: el.offsetHeight });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: typeof width === 'number' ? width : '100%',
        height: typeof height === 'number' ? height : '100%',
        minWidth: typeof minWidth === 'number' ? Math.max(minWidth, 0) : 0,
        minHeight: typeof minHeight === 'number' ? Math.max(minHeight, 0) : undefined,
        position: 'relative',
      }}
    >
      {dimensions && (
        <RechartsResponsiveContainer
          width={dimensions.width}
          height={dimensions.height}
          minWidth={typeof minWidth === 'number' ? Math.max(minWidth, 0) : 0}
          minHeight={typeof minHeight === 'number' ? Math.max(minHeight, 0) : undefined}
          {...props}
        >
          {children}
        </RechartsResponsiveContainer>
      )}
    </div>
  );
}

// Export with original name for drop-in replacement
export { SafeResponsiveContainer as ResponsiveContainer };

// Export default for convenience
export default SafeResponsiveContainer;
