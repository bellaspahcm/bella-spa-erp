'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AttendanceList } from '../_components/AttendanceList';
import { listAttendanceAction } from '@/products/bella-preschool/actions/attendance-actions';
import type { AttendanceDetail } from '@/products/bella-preschool/types';
import { toast } from 'sonner';

export default function AttendanceHistoryPage() {
  const [attendance, setAttendance] = useState<AttendanceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');

  const loadAttendance = async (date?: string) => {
    setLoading(true);
    try {
      const result = await listAttendanceAction(date ? { date } : undefined);
      if (result.success && result.data) {
        setAttendance(result.data);
      } else {
        toast.error(result.error || 'Failed to load attendance');
      }
    } catch (error) {
      toast.error('Failed to load attendance');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const handleFilter = () => {
    loadAttendance(filterDate || undefined);
  };

  const handleClearFilter = () => {
    setFilterDate('');
    loadAttendance();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attendance History</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="Filter by date"
              className="max-w-xs"
            />
            <Button onClick={handleFilter}>Apply</Button>
            <Button variant="outline" onClick={handleClearFilter}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading attendance...</div>
          ) : (
            <AttendanceList attendance={attendance} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
