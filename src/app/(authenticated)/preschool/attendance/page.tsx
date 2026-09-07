import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DailyAttendanceView } from './_components/DailyAttendanceView';

export default function AttendancePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attendance</h1>
      </div>

      <Suspense fallback={<Card><CardContent className="p-6">Loading attendance...</CardContent></Card>}>
        <DailyAttendanceView />
      </Suspense>
    </div>
  );
}
