import { getClassroomAction } from '@/products/bella-preschool/actions/classroom-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { PencilIcon, ArrowLeftIcon, UsersIcon, UserIcon, MapPinIcon } from 'lucide-react';
import { EnrolledStudentsList } from '../_components/EnrolledStudentsList';

interface ClassroomDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClassroomDetailPage({ params }: ClassroomDetailPageProps) {
  const { id } = await params;
  const result = await getClassroomAction(id);

  if (!result.success) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{result.error || 'Failed to load classroom'}</p>
        </div>
      </div>
    );
  }

  const classroom = result.data!;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/preschool/classrooms">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{classroom.classroom_name}</h1>
            {classroom.classroom_code && (
              <p className="text-sm text-gray-500">{classroom.classroom_code}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {classroom.is_active ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
          <Link href={`/preschool/classrooms/${classroom.id}/edit`}>
            <Button variant="outline">
              <PencilIcon className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Classroom Details */}
        <Card className="md:col-span-1 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Classroom Details</h3>
          <div className="space-y-4">
            {classroom.age_group && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Age Group</p>
                <p className="text-sm text-gray-900">{classroom.age_group}</p>
              </div>
            )}

            {classroom.capacity && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Capacity</p>
                <div className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-900">
                    {classroom.enrollment_count || 0} / {classroom.capacity} students
                  </p>
                </div>
              </div>
            )}

            {classroom.room_location && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Location</p>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-900">{classroom.room_location}</p>
                </div>
              </div>
            )}

            {classroom.lead_teacher && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Lead Teacher</p>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-900">
                    {(classroom.lead_teacher as any).full_name}
                  </p>
                </div>
              </div>
            )}

            {classroom.assistant_teacher && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Assistant Teacher</p>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-900">
                    {(classroom.assistant_teacher as any).full_name}
                  </p>
                </div>
              </div>
            )}

            {classroom.notes && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Notes</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{classroom.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Enrolled Students */}
        <div className="md:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Enrolled Students</h3>
              <Link href={`/preschool/classrooms/${classroom.id}/enroll`}>
                <Button size="sm">Enroll Student</Button>
              </Link>
            </div>
            <EnrolledStudentsList students={classroom.enrolled_students || []} />
          </Card>
        </div>
      </div>
    </div>
  );
}
