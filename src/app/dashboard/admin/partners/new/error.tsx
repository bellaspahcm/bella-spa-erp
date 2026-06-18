'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Partner Create Page Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Something went wrong!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Failed to load partner creation page
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-left">
          <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
            {error.message}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={reset}
            className="flex-1"
          >
            Try again
          </Button>
          <Button
            onClick={() => window.location.href = '/dashboard/admin/partners'}
            variant="outline"
            className="flex-1"
          >
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
