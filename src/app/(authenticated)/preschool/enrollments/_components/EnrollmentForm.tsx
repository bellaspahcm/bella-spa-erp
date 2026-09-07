'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { enrollStudentAction } from '@/products/bella-preschool/actions/classroom-actions';

interface EnrollmentFormProps {
  mode: 'create';
  students: Array<{
    id: string;
    student_code: string;
    first_name: string;
    last_name: string;
  }>;
  classrooms: Array<{
    id: string;
    classroom_name: string;
    classroom_code: string | null;
    age_group: string | null;
  }>;
}

export function EnrollmentForm({ mode, students, classrooms }: EnrollmentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    classroom_id: '',
    enrollment_date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!formData.student_id || !formData.classroom_id) {
        setError('Student and classroom are required');
        setIsSubmitting(false);
        return;
      }

      const result = await enrollStudentAction({
        student_id: formData.student_id,
        classroom_id: formData.classroom_id,
        enrollment_date: formData.enrollment_date,
      });

      if (result.success) {
        router.push('/preschool/enrollments');
      } else {
        setError(result.error || 'An error occurred');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Student Selection */}
      <div>
        <Label htmlFor="student_id">Student *</Label>
        <select
          id="student_id"
          name="student_id"
          required
          value={formData.student_id}
          onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a student...</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.first_name} {student.last_name} ({student.student_code})
            </option>
          ))}
        </select>
        {students.length === 0 && (
          <p className="mt-1 text-sm text-gray-500">
            No available students. All active students are already enrolled.
          </p>
        )}
      </div>

      {/* Classroom Selection */}
      <div>
        <Label htmlFor="classroom_id">Classroom *</Label>
        <select
          id="classroom_id"
          name="classroom_id"
          required
          value={formData.classroom_id}
          onChange={(e) => setFormData({ ...formData, classroom_id: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a classroom...</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.classroom_name}
              {classroom.age_group && ` (${classroom.age_group})`}
            </option>
          ))}
        </select>
      </div>

      {/* Enrollment Date */}
      <div>
        <Label htmlFor="enrollment_date">Enrollment Date *</Label>
        <Input
          type="date"
          id="enrollment_date"
          name="enrollment_date"
          required
          value={formData.enrollment_date}
          onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link href="/preschool/enrollments">
          <Button type="button" variant="outline">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={isSubmitting || students.length === 0}>
          {isSubmitting ? 'Enrolling...' : 'Enroll Student'}
        </Button>
      </div>
    </form>
  );
}
