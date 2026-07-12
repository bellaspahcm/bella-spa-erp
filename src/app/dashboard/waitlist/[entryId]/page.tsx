'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { WaitlistDetailContent } from './components/WaitlistDetailContent';

interface WaitlistDetailPageProps {
  params: {
    entryId: string;
  };
}

export default function WaitlistDetailPage({ params }: WaitlistDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <WaitlistDetailContent entryId={params.entryId} />
    </Suspense>
  );
}
