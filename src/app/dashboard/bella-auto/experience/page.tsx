import { Suspense } from 'react';
import { ExperienceDashboard } from '@/components/bella-auto/experience/ExperienceDashboard';

export const metadata = {
  title: 'Experience Center - Bella Auto',
  description: 'Customer Experience Analytics & AI Insights',
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );
}

export default function ExperienceCenterPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Experience Center</h1>
          <p className="text-muted-foreground mt-1">
            Phân tích trải nghiệm khách hàng & AI Insights
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <ExperienceDashboard />
      </Suspense>
    </div>
  );
}
