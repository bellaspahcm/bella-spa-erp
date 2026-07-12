'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { WaitlistContent } from './components/WaitlistContent';

export default function WaitlistPage() {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <WaitlistContent />
    </Suspense>
  );
}
