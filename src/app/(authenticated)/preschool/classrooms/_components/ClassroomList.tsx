'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { ClassroomDetail } from '@/products/bella-preschool/types';
import { UsersIcon, UserIcon } from 'lucide-react';

interface ClassroomListProps {
  classrooms: ClassroomDetail[];
}

export function ClassroomList({ classrooms }: ClassroomListProps) {
  if (classrooms.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600">No classrooms found</p>
        <p className="text-sm text-gray-500 mt-2">
          Create your first classroom to get started
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {classrooms.map((classroom) => (
        <Link
          key={classroom.id}
          href={`/preschool/classrooms/${classroom.id}`}
          className="block"
        >
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {classroom.classroom_name}
                </h3>
                {classroom.classroom_code && (
                  <p className="text-sm text-gray-500">{classroom.classroom_code}</p>
                )}
              </div>
              {classroom.is_active ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>

            {classroom.age_group && (
              <p className="text-sm text-gray-600 mb-3">
                Age: {classroom.age_group}
              </p>
            )}

            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <UsersIcon className="w-4 h-4" />
                  <span>{classroom.enrollment_count || 0}</span>
                  {classroom.capacity && (
                    <span className="text-gray-400">/ {classroom.capacity}</span>
                  )}
                </div>
                {classroom.lead_teacher && (
                  <div className="flex items-center gap-1">
                    <UserIcon className="w-4 h-4" />
                    <span className="text-xs">{(classroom.lead_teacher as any).full_name}</span>
                  </div>
                )}
              </div>
            </div>

            {classroom.room_location && (
              <p className="text-xs text-gray-500 mt-3">
                📍 {classroom.room_location}
              </p>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
