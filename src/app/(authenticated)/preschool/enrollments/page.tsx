import { listEnrollmentsAction } from '@/products/bella-preschool/actions/enrollment-actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { EnrollmentList } from './_components/EnrollmentList';

export default async function EnrollmentsPage() {
  const result = await listEnrollmentsAction();

  if (!result.success) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{result.error || 'Failed to load enrollments'}</p>
        </div>
      </div>
    );
  }

  const enrollments = result.data || [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Enrollments</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage student classroom enrollments
          </p>
        </div>
        <Link href="/preschool/enrollments/new">
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            Enroll Student
          </Button>
        </Link>
      </div>

      {/* Enrollments List */}
      <EnrollmentList enrollments={enrollments} />
    </div>
  );
}
