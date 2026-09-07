import { getStudentAction } from '@/products/bella-preschool/actions/student-actions';
import { notFound } from 'next/navigation';
import { StudentForm } from '../../_components/StudentForm';

interface EditStudentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditStudentPage({
  params,
}: EditStudentPageProps) {
  const { id } = await params;
  const result = await getStudentAction(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Student</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update student information
        </p>
      </div>
      <StudentForm mode="edit" student={result.data} />
    </div>
  );
}
