/**
 * Bella Preschool — Students List Page
 *
 * View and manage preschool students
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { UserPlus, Users } from 'lucide-react';
import { listStudentsAction } from '@/products/bella-preschool/actions';

export default function StudentsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Students
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage preschool student records
          </p>
        </div>
        <Link
          href="/dashboard/preschool/students/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Enroll Student
        </Link>
      </div>

      <Suspense fallback={<StudentListSkeleton />}>
        <StudentList />
      </Suspense>
    </div>
  );
}

async function StudentList() {
  const result = await listStudentsAction();

  if (!result.success || !result.data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">
          {result.error || 'Failed to load students'}
        </p>
      </div>
    );
  }

  const students = result.data;

  if (students.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No students enrolled yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Start by enrolling your first student to begin managing your preschool.
        </p>
        <Link
          href="/dashboard/preschool/students/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Enroll First Student
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Student Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Age
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Classroom
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Guardians
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {students.map((student) => {
              const age = calculateAge(student.date_of_birth);
              const primaryGuardian = student.guardians?.find(g => g.is_primary_contact);
              
              return (
                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                    {student.student_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {age} years
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {student.current_classroom?.classroom_name || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {primaryGuardian?.guardian?.name_mother || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StudentStatusBadge status={student.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Link
                      href={`/dashboard/preschool/students/${student.id}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    active: {
      label: 'Active',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    },
    withdrawn: {
      label: 'Withdrawn',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    },
    graduated: {
      label: 'Graduated',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

function StudentListSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
