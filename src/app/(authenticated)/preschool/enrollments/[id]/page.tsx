import { getEnrollmentAction } from '@/products/bella-preschool/actions/enrollment-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeftIcon, UserIcon, DoorOpenIcon } from 'lucide-react';
import { EnrollmentStatusActions } from '../_components/EnrollmentStatusActions';

interface EnrollmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EnrollmentDetailPage({ params }: EnrollmentDetailPageProps) {
  const { id } = await params;
  const result = await getEnrollmentAction(id);

  if (!result.success) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{result.error || 'Failed to load enrollment'}</p>
        </div>
      </div>
    );
  }

  const enrollment = result.data!;

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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/preschool/enrollments">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Enrollment Details</h1>
          </div>
        </div>
        <Badge variant={getStatusColor(enrollment.status)}>{enrollment.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserIcon className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Student</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase">Name</p>
              <Link
                href={`/preschool/students/${enrollment.student?.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {enrollment.student?.first_name} {enrollment.student?.last_name}
              </Link>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Student Code</p>
              <p className="text-sm text-gray-900">{enrollment.student?.student_code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Date of Birth</p>
              <p className="text-sm text-gray-900">
                {enrollment.student?.date_of_birth
                  ? new Date(enrollment.student.date_of_birth).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Status</p>
              <Badge variant="outline">{enrollment.student?.status}</Badge>
            </div>
          </div>
        </Card>

        {/* Classroom Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <DoorOpenIcon className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Classroom</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase">Classroom Name</p>
              <Link
                href={`/preschool/classrooms/${enrollment.classroom?.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {enrollment.classroom?.classroom_name}
              </Link>
            </div>
            {enrollment.classroom?.classroom_code && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Classroom Code</p>
                <p className="text-sm text-gray-900">{enrollment.classroom.classroom_code}</p>
              </div>
            )}
            {enrollment.classroom?.age_group && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Age Group</p>
                <p className="text-sm text-gray-900">{enrollment.classroom.age_group}</p>
              </div>
            )}
            {enrollment.classroom?.room_location && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Location</p>
                <p className="text-sm text-gray-900">{enrollment.classroom.room_location}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Enrollment Details */}
        <Card className="p-6 md:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Enrollment Period</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Enrollment Date</p>
              <p className="text-sm text-gray-900">
                {new Date(enrollment.enrollment_date).toLocaleDateString()}
              </p>
            </div>
            {enrollment.end_date && (
              <div>
                <p className="text-xs text-gray-500 uppercase">End Date</p>
                <p className="text-sm text-gray-900">
                  {new Date(enrollment.end_date).toLocaleDateString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 uppercase">Status</p>
              <Badge variant={getStatusColor(enrollment.status)}>{enrollment.status}</Badge>
            </div>
          </div>
        </Card>

        {/* Status Actions */}
        {enrollment.status === 'active' && (
          <Card className="p-6 md:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
            <EnrollmentStatusActions enrollmentId={enrollment.id} />
          </Card>
        )}
      </div>
    </div>
  );
}
