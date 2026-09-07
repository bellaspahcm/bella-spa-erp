'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Enrollment {
  id: string;
  enrollment_date: string;
  end_date: string | null;
  status: 'active' | 'transferred' | 'completed' | 'withdrawn';
  student?: {
    id: string;
    student_code: string;
    first_name: string;
    last_name: string;
    status: string;
  };
  classroom?: {
    id: string;
    classroom_name: string;
    classroom_code: string | null;
    age_group: string | null;
  };
}

interface EnrollmentListProps {
  enrollments: Enrollment[];
}

export function EnrollmentList({ enrollments }: EnrollmentListProps) {
  if (enrollments.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-500">No enrollments found</p>
        <p className="text-sm text-gray-400 mt-1">Start by enrolling a student in a classroom</p>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'transferred':
        return 'outline';
      case 'withdrawn':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-3">
      {enrollments.map((enrollment) => (
        <Link key={enrollment.id} href={`/preschool/enrollments/${enrollment.id}`}>
          <Card className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {enrollment.student?.first_name} {enrollment.student?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{enrollment.student?.student_code}</p>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {enrollment.classroom?.classroom_name}
                    </p>
                    {enrollment.classroom?.age_group && (
                      <p className="text-sm text-gray-500">{enrollment.classroom.age_group}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-900">
                    {new Date(enrollment.enrollment_date).toLocaleDateString()}
                  </p>
                  {enrollment.end_date && (
                    <p className="text-xs text-gray-500">
                      Ended: {new Date(enrollment.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge variant={getStatusColor(enrollment.status)}>{enrollment.status}</Badge>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
