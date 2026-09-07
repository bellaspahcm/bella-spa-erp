'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AttendanceDetail } from '@/products/bella-preschool/types';

interface AttendanceListProps {
  attendance: AttendanceDetail[];
}

export function AttendanceList({ attendance }: AttendanceListProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return <Badge variant="default">Checked In</Badge>;
      case 'checked_out':
        return <Badge variant="secondary">Checked Out</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (attendance.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No attendance records found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendance.map((record) => (
            <TableRow key={record.id}>
              <TableCell>{formatDate(record.attendance_date)}</TableCell>
              <TableCell>
                {record.student ? (
                  <div>
                    <div className="font-medium">
                      {record.student.first_name} {record.student.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {record.student.student_code}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>{formatTime(record.check_in_time)}</TableCell>
              <TableCell>{formatTime(record.check_out_time)}</TableCell>
              <TableCell>{getStatusBadge(record.status)}</TableCell>
              <TableCell>
                {record.notes ? (
                  <span className="text-sm">{record.notes}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
