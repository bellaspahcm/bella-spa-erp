import { listStudentsAction } from '@/products/bella-preschool/actions/student-actions';
import { listClassroomsAction } from '@/products/bella-preschool/actions/classroom-actions';
import { EnrollmentForm } from '../_components/EnrollmentForm';

export default async function NewEnrollmentPage() {
  const [studentsResult, classroomsResult] = await Promise.all([
    listStudentsAction(),
    listClassroomsAction(),
  ]);

  if (!studentsResult.success || !classroomsResult.success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {studentsResult.error || classroomsResult.error || 'Failed to load data'}
          </p>
        </div>
      </div>
    );
  }

  const students = studentsResult.data || [];
  const classrooms = classroomsResult.data || [];

  // Filter active students without current enrollment
  const availableStudents = students.filter(
    (s) => s.status === 'active' && !s.current_classroom
  );

  // Filter active classrooms
  const activeClassrooms = classrooms.filter((c) => c.is_active);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Enroll Student</h1>
        <p className="mt-1 text-sm text-gray-600">
          Assign a student to a classroom
        </p>
      </div>
      <EnrollmentForm
        mode="create"
        students={availableStudents}
        classrooms={activeClassrooms}
      />
    </div>
  );
}
