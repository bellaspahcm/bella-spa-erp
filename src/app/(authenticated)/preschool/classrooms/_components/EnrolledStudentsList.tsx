'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface Student {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  status: string;
}

interface EnrolledStudentsListProps {
  students: Student[];
}

export function EnrolledStudentsList({ students }: EnrolledStudentsListProps) {
  if (students.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No students enrolled yet</p>
        <p className="text-sm mt-1">Click "Enroll Student" to add students to this classroom</p>
      </div>
    );
  }

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="space-y-2">
      {students.map((student) => (
        <Link
          key={student.id}
          href={`/preschool/students/${student.id}`}
          className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {student.first_name} {student.last_name}
              </p>
              <p className="text-sm text-gray-500">
                {student.student_code} • {calculateAge(student.date_of_birth)} years old
              </p>
            </div>
            <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
              {student.status}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}
