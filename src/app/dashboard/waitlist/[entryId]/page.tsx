'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { WaitlistDetailContent } from './components/WaitlistDetailContent';

interface WaitlistDetailPageProps {
  params: Promise<{
    entryId: string;
  }>;
}

export default function WaitlistDetailPage({ params }: WaitlistDetailPageProps) {
  const unwrappedParams = React.use(params);
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <WaitlistDetailContent entryId={unwrappedParams.entryId} />
    </Suspense>
  );
}
