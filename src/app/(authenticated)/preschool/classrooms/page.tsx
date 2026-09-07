import { listClassroomsAction } from '@/products/bella-preschool/actions/classroom-actions';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { ClassroomList } from './_components/ClassroomList';

export default async function ClassroomsPage() {
  const result = await listClassroomsAction();

  if (!result.success) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{result.error || 'Failed to load classrooms'}</p>
        </div>
      </div>
    );
  }

  const classrooms = result.data || [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Classrooms</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage classroom groups and enrollments
          </p>
        </div>
        <Link href="/preschool/classrooms/new">
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Classroom
          </Button>
        </Link>
      </div>

      <ClassroomList classrooms={classrooms} />
    </div>
  );
}
