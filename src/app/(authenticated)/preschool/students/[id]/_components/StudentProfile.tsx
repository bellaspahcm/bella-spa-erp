'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { EditIcon, ArrowLeftIcon } from 'lucide-react';
import { AddGuardianDialog } from './AddGuardianDialog';
import { EditGuardianDialog } from './EditGuardianDialog';

type StudentDetail = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string;
  status: string;
  allergies?: string | null;
  medical_notes?: string | null;
  notes?: string | null;
  guardians?: Array<{
    id: string;
    customer_id: string;
    relationship_type: string;
    is_primary: boolean;
    pickup_authorized: boolean;
    guardian_name: string;
    guardian_phone?: string;
    guardian_email?: string;
  }>;
  classroom_name?: string;
  enrollment_date?: string;
};

interface StudentProfileProps {
  student: StudentDetail;
}

export function StudentProfile({ student }: StudentProfileProps) {
  const age = calculateAge(student.date_of_birth);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/preschool/students">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Students
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {student.first_name} {student.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={student.status === 'active' ? 'default' : 'secondary'}
              >
                {student.status}
              </Badge>
              <span className="text-sm text-gray-600">{age} years old</span>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/preschool/students/${student.id}/edit`}>
            <EditIcon className="w-4 h-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Basic Info */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Basic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Date of Birth
            </label>
            <p className="mt-1 text-gray-900">
              {new Date(student.date_of_birth).toLocaleDateString()}
            </p>
          </div>
          {student.gender && (
            <div>
              <label className="text-sm font-medium text-gray-700">Gender</label>
              <p className="mt-1 text-gray-900 capitalize">{student.gender}</p>
            </div>
          )}
          {student.classroom_name && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Classroom
              </label>
              <p className="mt-1 text-gray-900">{student.classroom_name}</p>
            </div>
          )}
          {student.enrollment_date && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Enrollment Date
              </label>
              <p className="mt-1 text-gray-900">
                {new Date(student.enrollment_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Health Information */}
      {(student.allergies || student.medical_notes) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Health Information
          </h2>
          {student.allergies && (
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700">
                Allergies
              </label>
              <p className="mt-1 text-gray-900">{student.allergies}</p>
            </div>
          )}
          {student.medical_notes && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Medical Notes
              </label>
              <p className="mt-1 text-gray-900">{student.medical_notes}</p>
            </div>
          )}
        </Card>
      )}

      {/* Guardians */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Guardians</h2>
          <AddGuardianDialog studentId={student.id} />
        </div>

        {!student.guardians || student.guardians.length === 0 ? (
          <p className="text-sm text-gray-600">No guardians added yet</p>
        ) : (
          <div className="space-y-3">
            {student.guardians.map((guardian) => (
              <div
                key={guardian.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">
                        {guardian.guardian_name}
                      </h3>
                      {guardian.is_primary && (
                        <Badge variant="default" className="text-xs">
                          Primary
                        </Badge>
                      )}
                      {guardian.pickup_authorized && (
                        <Badge variant="secondary" className="text-xs">
                          Pickup Authorized
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 capitalize">
                      {guardian.relationship_type.replace('_', ' ')}
                    </p>
                    {guardian.guardian_phone && (
                      <p className="text-sm text-gray-600 mt-1">
                        📞 {guardian.guardian_phone}
                      </p>
                    )}
                    {guardian.guardian_email && (
                      <p className="text-sm text-gray-600">
                        ✉️ {guardian.guardian_email}
                      </p>
                    )}
                  </div>
                  <EditGuardianDialog guardian={guardian} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notes */}
      {student.notes && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <p className="text-gray-900">{student.notes}</p>
        </Card>
      )}
    </div>
  );
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}
