/**
 * Bella Preschool — Classrooms List Page
 *
 * View and manage preschool classrooms
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, School } from 'lucide-react';
import { listClassroomsAction } from '@/products/bella-preschool/actions';

export default function ClassroomsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Classrooms
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage classroom groups and enrollments
          </p>
        </div>
        <Link
          href="/dashboard/preschool/classrooms/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Classroom
        </Link>
      </div>

      <Suspense fallback={<ClassroomListSkeleton />}>
        <ClassroomList />
      </Suspense>
    </div>
  );
}

async function ClassroomList() {
  const result = await listClassroomsAction();

  if (!result.success || !result.data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">
          {result.error || 'Failed to load classrooms'}
        </p>
      </div>
    );
  }

  const classrooms = result.data;

  if (classrooms.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <School className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No classrooms created yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Create your first classroom to start organizing students by age groups.
        </p>
        <Link
          href="/dashboard/preschool/classrooms/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create First Classroom
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {classrooms.map((classroom) => (
        <ClassroomCard key={classroom.id} classroom={classroom} />
      ))}
    </div>
  );
}

function ClassroomCard({ classroom }: { classroom: any }) {
  const utilization = classroom.capacity 
    ? Math.round((classroom.enrollment_count / classroom.capacity) * 100)
    : 0;
  
  const utilizationColor = 
    utilization >= 90 ? 'text-red-600' :
    utilization >= 75 ? 'text-orange-600' :
    'text-green-600';

  return (
    <Link
      href={`/dashboard/preschool/classrooms/${classroom.id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {classroom.classroom_name}
          </h3>
          {classroom.age_group && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {classroom.age_group}
            </p>
          )}
        </div>
        {classroom.is_active && (
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            Active
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Enrolled Students</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {classroom.enrollment_count || 0}
            {classroom.capacity && ` / ${classroom.capacity}`}
          </span>
        </div>

        {classroom.capacity && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">Capacity</span>
              <span className={`text-xs font-semibold ${utilizationColor}`}>
                {utilization}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  utilization >= 90 ? 'bg-red-500' :
                  utilization >= 75 ? 'bg-orange-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
          </div>
        )}

        {classroom.room_location && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              📍 {classroom.room_location}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function ClassroomListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48"></div>
      ))}
    </div>
  );
}
