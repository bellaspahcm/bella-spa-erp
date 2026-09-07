import { listStudentsAction } from '@/products/bella-preschool/actions/student-actions';
import { StudentList } from './_components/StudentList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';

export default async function StudentsPage() {
  const result = await listStudentsAction();

  if (!result.success) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load students: {result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage student profiles, guardians, and enrollment
          </p>
        </div>
        <Button asChild>
          <Link href="/preschool/students/new">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Student
          </Link>
        </Button>
      </div>

      <StudentList students={result.data || []} />
    </div>
  );
}
