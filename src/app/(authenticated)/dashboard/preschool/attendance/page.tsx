/**
 * Bella Preschool — Attendance Page
 *
 * Daily attendance tracking (check-in/check-out)
 */

import { Suspense } from 'react';
import { CalendarCheck } from 'lucide-react';
import { listAttendanceAction, listStudentsAction } from '@/products/bella-preschool/actions';

export default function AttendancePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Attendance
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Daily check-in and check-out tracking
        </p>
      </div>

      <Suspense fallback={<AttendanceSkeleton />}>
        <AttendanceView />
      </Suspense>
    </div>
  );
}

async function AttendanceView() {
  const today = new Date().toISOString().split('T')[0];
  
  const [attendanceResult, studentsResult] = await Promise.all([
    listAttendanceAction({ date: today }),
    listStudentsAction(),
  ]);

  if (!attendanceResult.success || !studentsResult.success) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">
          Failed to load attendance data
        </p>
      </div>
    );
  }

  const attendance = attendanceResult.data || [];
  const allStudents = studentsResult.data || [];
  const activeStudents = allStudents.filter(s => s.status === 'active');

  if (activeStudents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <CalendarCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No active students
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Enroll students first to start tracking attendance.
        </p>
      </div>
    );
  }

  // Group attendance by status
  const checkedIn = attendance.filter(a => a.status === 'checked_in');
  const checkedOut = attendance.filter(a => a.status === 'checked_out');
  const absent = attendance.filter(a => a.status === 'absent');
  const notYetCheckedIn = activeStudents.filter(
    s => !attendance.some(a => a.student_id === s.id)
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Present" 
          value={checkedIn.length + checkedOut.length} 
          total={activeStudents.length}
          color="green"
        />
        <StatCard 
          title="Checked In" 
          value={checkedIn.length} 
          color="blue"
        />
        <StatCard 
          title="Checked Out" 
          value={checkedOut.length} 
          color="gray"
        />
        <StatCard 
          title="Absent" 
          value={absent.length} 
          color="red"
        />
      </div>

      {/* Attendance Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttendanceSection
          title="Checked In"
          students={checkedIn}
          emptyMessage="No students checked in yet"
          color="blue"
        />
        <AttendanceSection
          title="Checked Out"
          students={checkedOut}
          emptyMessage="No students checked out yet"
          color="gray"
        />
        <AttendanceSection
          title="Not Yet Checked In"
          students={notYetCheckedIn.map(s => ({
            student: {
              id: s.id,
              student_code: s.student_code,
              first_name: s.first_name,
              last_name: s.last_name,
            },
          }))}
          emptyMessage="All students accounted for"
          color="orange"
        />
        <AttendanceSection
          title="Absent"
          students={absent}
          emptyMessage="No absences recorded"
          color="red"
        />
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  total,
  color 
}: { 
  title: string; 
  value: number; 
  total?: number;
  color: 'green' | 'blue' | 'gray' | 'red' | 'orange';
}) {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}{total !== undefined && ` / ${total}`}
      </p>
    </div>
  );
}

function AttendanceSection({
  title,
  students,
  emptyMessage,
  color,
}: {
  title: string;
  students: any[];
  emptyMessage: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title} ({students.length})
        </h3>
      </div>
      <div className="p-6">
        {students.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-3">
            {students.map((item, index) => {
              const student = item.student || item;
              return (
                <li
                  key={student.id || index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {student.student_code}
                    </p>
                  </div>
                  {item.check_in_time && (
                    <div className="text-right">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        In: {new Date(item.check_in_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {item.check_out_time && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Out: {new Date(item.check_out_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-24"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64"></div>
        ))}
      </div>
    </div>
  );
}
