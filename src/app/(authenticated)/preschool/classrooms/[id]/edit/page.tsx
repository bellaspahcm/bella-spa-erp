import { getClassroomAction } from '@/products/bella-preschool/actions/classroom-actions';
import { ClassroomForm } from '../../_components/ClassroomForm';

interface EditClassroomPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditClassroomPage({ params }: EditClassroomPageProps) {
  const { id } = await params;
  const result = await getClassroomAction(id);

  if (!result.success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{result.error || 'Failed to load classroom'}</p>
        </div>
      </div>
    );
  }

  const classroom = result.data!;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Classroom</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update classroom information
        </p>
      </div>
      <ClassroomForm mode="edit" classroom={classroom} />
    </div>
  );
}
