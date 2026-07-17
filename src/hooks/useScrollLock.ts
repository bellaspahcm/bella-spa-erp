import { useEffect } from 'react';

let lockCount = 0;

/**
 * Custom hook to lock body scroll when a modal or dialog is open.
 * Supports modal stacking by using a global lock counter.
 */
export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    lockCount++;
    // Lock background scroll
    document.body.style.overflow = 'hidden';

    return () => {
      lockCount--;
      if (lockCount <= 0) {
        // Unlock background scroll
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);
}
