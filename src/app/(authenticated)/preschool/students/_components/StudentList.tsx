'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchIcon, UserIcon } from 'lucide-react';

type StudentDetail = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  status: string;
  gender?: string;
  classroom_name?: string;
};

interface StudentListProps {
  students: StudentDetail[];
}

export function StudentList({ students }: StudentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        student.first_name.toLowerCase().includes(searchLower) ||
        student.last_name.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus =
        statusFilter === 'all' || student.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, searchQuery, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
            <SelectItem value="graduated">Graduated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        Showing {filteredStudents.length} of {students.length} students
      </div>

      {/* Student cards */}
      {filteredStudents.length === 0 ? (
        <Card className="p-12 text-center">
          <UserIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
          <p className="text-sm text-gray-600">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Get started by adding your first student'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => (
            <Link
              key={student.id}
              href={`/preschool/students/${student.id}`}
              className="block"
            >
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {student.first_name} {student.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      DOB: {new Date(student.date_of_birth).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      student.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {student.status}
                  </Badge>
                </div>

                {student.classroom_name && (
                  <div className="text-sm text-gray-600">
                    📚 {student.classroom_name}
                  </div>
                )}
                {student.gender && (
                  <div className="text-sm text-gray-500 mt-1">
                    {student.gender}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
