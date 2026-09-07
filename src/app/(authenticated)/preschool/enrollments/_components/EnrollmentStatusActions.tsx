'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { updateEnrollmentStatusAction } from '@/products/bella-preschool/actions/enrollment-actions';

interface EnrollmentStatusActionsProps {
  enrollmentId: string;
}

export function EnrollmentStatusActions({ enrollmentId }: EnrollmentStatusActionsProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (
    status: 'completed' | 'withdrawn',
    confirmMessage: string
  ) => {
    if (!confirm(confirmMessage)) return;

    setError(null);
    setIsProcessing(true);

    try {
      const result = await updateEnrollmentStatusAction(enrollmentId, status);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'An error occurred');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={isProcessing}
          onClick={() =>
            handleStatusChange(
              'completed',
              'Mark this enrollment as completed? This will end the enrollment period.'
            )
          }
        >
          Mark as Completed
        </Button>
        <Button
          variant="destructive"
          disabled={isProcessing}
          onClick={() =>
            handleStatusChange(
              'withdrawn',
              'Withdraw this enrollment? This action indicates the student left the program.'
            )
          }
        >
          Withdraw Enrollment
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        These actions will set an end date and change the enrollment status. Use transfer for
        moving to another classroom.
      </p>
    </div>
  );
}
