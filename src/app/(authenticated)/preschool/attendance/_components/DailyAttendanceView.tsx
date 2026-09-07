'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  checkInStudentAction,
  checkOutStudentAction,
  getAttendanceStateAction,
} from '@/products/bella-preschool/actions/attendance-actions';
import { listStudentsAction } from '@/products/bella-preschool/actions/student-actions';
import type { PreschoolStudent, PreschoolAttendance } from '@/products/bella-preschool/types';

interface StudentWithAttendance {
  student: PreschoolStudent;
  attendance: PreschoolAttendance | null;
}

export function DailyAttendanceView() {
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);
  const today = new Date().toISOString().split('T')[0];

  const loadStudentsWithAttendance = async () => {
    setLoading(true);
    try {
      // Load all active students
      const studentsResult = await listStudentsAction({ status: 'active' });
      if (!studentsResult.success || !studentsResult.data) {
        toast.error('Failed to load students');
        return;
      }

      // Load attendance for each student
      const studentsWithAttendance = await Promise.all(
        studentsResult.data.map(async (student) => {
          const attendanceResult = await getAttendanceStateAction({
            student_id: student.id,
            date: today,
          });

          return {
            student,
            attendance: attendanceResult.success ? attendanceResult.data : null,
          };
        })
      );

      setStudents(studentsWithAttendance);
    } catch (error) {
      toast.error('Failed to load attendance data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentsWithAttendance();
  }, []);

  const handleCheckIn = async (studentId: string) => {
    setProcessingStudentId(studentId);
    try {
      const result = await checkInStudentAction({ student_id: studentId });
      if (result.success) {
        toast.success('Student checked in');
        await loadStudentsWithAttendance();
      } else {
        toast.error(result.error || 'Failed to check in');
      }
    } catch (error) {
      toast.error('Failed to check in');
      console.error(error);
    } finally {
      setProcessingStudentId(null);
    }
  };

  const handleCheckOut = async (studentId: string) => {
    setProcessingStudentId(studentId);
    try {
      const result = await checkOutStudentAction({ student_id: studentId });
      if (result.success) {
        toast.success('Student checked out');
        await loadStudentsWithAttendance();
      } else {
        toast.error(result.error || 'Failed to check out');
      }
    } catch (error) {
      toast.error('Failed to check out');
      console.error(error);
    } finally {
      setProcessingStudentId(null);
    }
  };

  const getStatusBadge = (attendance: PreschoolAttendance | null) => {
    if (!attendance) {
      return <Badge variant="outline">Not recorded</Badge>;
    }

    switch (attendance.status) {
      case 'checked_in':
        return <Badge variant="default">Checked In</Badge>;
      case 'checked_out':
        return <Badge variant="secondary">Checked Out</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">Loading attendance...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Attendance - {new Date().toLocaleDateString()}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {students.length === 0 ? (
            <p className="text-muted-foreground">No active students found.</p>
          ) : (
            <div className="space-y-2">
              {students.map(({ student, attendance }) => (
                <div
                  key={student.id}
                  data-testid={`student-row-${student.student_code}`}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {student.first_name} {student.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {student.student_code}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      {attendance?.check_in_time && (
                        <div>In: {formatTime(attendance.check_in_time)}</div>
                      )}
                      {attendance?.check_out_time && (
                        <div>Out: {formatTime(attendance.check_out_time)}</div>
                      )}
                    </div>

                    <div className="w-32">{getStatusBadge(attendance)}</div>

                    <div className="flex gap-2">
                      {(!attendance || attendance.status === 'absent') && (
                        <Button
                          size="sm"
                          onClick={() => handleCheckIn(student.id)}
                          disabled={processingStudentId === student.id}
                        >
                          Check In
                        </Button>
                      )}

                      {attendance?.status === 'checked_in' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckOut(student.id)}
                          disabled={processingStudentId === student.id}
                        >
                          Check Out
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
