import { ClassroomForm } from '../_components/ClassroomForm';

export default function NewClassroomPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Create Classroom</h1>
        <p className="mt-1 text-sm text-gray-600">
          Add a new classroom group
        </p>
      </div>
      <ClassroomForm mode="create" />
    </div>
  );
}
