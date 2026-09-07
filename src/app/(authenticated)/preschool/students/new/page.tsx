import { StudentForm } from '../_components/StudentForm';

export default function NewStudentPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Add New Student</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a new student profile. You can add guardians after creating the student.
        </p>
      </div>
      <StudentForm mode="create" />
    </div>
  );
}
