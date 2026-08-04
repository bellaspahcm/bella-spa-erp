/**
 * SafeResponsiveContainer - Wrapper around Recharts ResponsiveContainer
 * 
 * Purpose: Prevents "width(-1) and height(-1)" warnings by ensuring parent
 * containers have computed dimensions before rendering charts.
 * 
 * How it works:
 * 1. Delays rendering by 50ms to allow parent layout to compute
 * 2. Returns placeholder div until mounted
 * 3. Then renders actual ResponsiveContainer with stable dimensions
 * 
 * Usage:
 *   Replace: import { ResponsiveContainer } from 'recharts';
 *   With:    import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
 * 
 * @author Bella ERP Team
 * @date 2026-08-04
 */

import { useState, useEffect } from 'react';
import { ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

export function SafeResponsiveContainer({ 
  children, 
  ...props 
}: React.ComponentProps<typeof RechartsResponsiveContainer>) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Delay rendering to ensure parent containers have computed dimensions
    // This prevents Recharts from rendering with -1 width/height
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Show placeholder until mounted to prevent -1 dimension warnings
  if (!mounted) {
    return (
      <div 
        style={{ 
          width: props.width || '100%', 
          height: props.height || '100%',
          minWidth: 100,
          minHeight: 100,
        }} 
      />
    );
  }
  
  return (
    <RechartsResponsiveContainer {...props}>
      {children}
    </RechartsResponsiveContainer>
  );
}

// Export with original name for drop-in replacement
export { SafeResponsiveContainer as ResponsiveContainer };

// Export default for convenience
export default SafeResponsiveContainer;
