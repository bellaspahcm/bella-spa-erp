'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { createClassroomAction, updateClassroomAction } from '@/products/bella-preschool/actions/classroom-actions';
import type { PreschoolClassroom } from '@/products/bella-preschool/types';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';

interface ClassroomFormProps {
  mode: 'create' | 'edit';
  classroom?: PreschoolClassroom;
}

export function ClassroomForm({ mode, classroom }: ClassroomFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    classroom_name: classroom?.classroom_name || '',
    classroom_code: classroom?.classroom_code || '',
    age_group: classroom?.age_group || '',
    capacity: classroom?.capacity?.toString() || '',
    room_location: classroom?.room_location || '',
    notes: classroom?.notes || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'create') {
        const result = await createClassroomAction({
          classroom_name: formData.classroom_name,
          classroom_code: formData.classroom_code || undefined,
          age_group: formData.age_group || undefined,
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          room_location: formData.room_location || undefined,
          notes: formData.notes || undefined,
        });

        if (result.success && result.data) {
          router.push(`/preschool/classrooms/${result.data.id}`);
        } else {
          setError(result.error || 'An error occurred');
        }
      } else if (mode === 'edit' && classroom) {
        const result = await updateClassroomAction(classroom.id, {
          classroom_name: formData.classroom_name,
          classroom_code: formData.classroom_code || undefined,
          age_group: formData.age_group || undefined,
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          room_location: formData.room_location || undefined,
          notes: formData.notes || undefined,
        });

        if (result.success && result.data) {
          router.push(`/preschool/classrooms/${result.data.id}`);
        } else {
          setError(result.error || 'An error occurred');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="classroom_name">
                  Classroom Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="classroom_name"
                  name="classroom_name"
                  type="text"
                  required
                  value={formData.classroom_name}
                  onChange={(e) => handleChange('classroom_name', e.target.value)}
                  placeholder="e.g., Rainbow Room"
                />
              </div>

              <div>
                <Label htmlFor="classroom_code">Classroom Code</Label>
                <Input
                  id="classroom_code"
                  name="classroom_code"
                  type="text"
                  value={formData.classroom_code}
                  onChange={(e) => handleChange('classroom_code', e.target.value)}
                  placeholder="e.g., RR-01"
                />
              </div>
            </div>
          </div>

          {/* Capacity & Age Group */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Capacity & Age Group</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="age_group">Age Group</Label>
                <Input
                  id="age_group"
                  name="age_group"
                  type="text"
                  value={formData.age_group}
                  onChange={(e) => handleChange('age_group', e.target.value)}
                  placeholder="e.g., 3-4 years"
                />
              </div>

              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => handleChange('capacity', e.target.value)}
                  placeholder="e.g., 15"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="room_location">Room Location</Label>
            <Input
              id="room_location"
              name="room_location"
              type="text"
              value={formData.room_location}
              onChange={(e) => handleChange('room_location', e.target.value)}
              placeholder="e.g., Building A, 2nd Floor"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional information about the classroom"
              rows={3}
            />
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        <Link href={mode === 'edit' && classroom ? `/preschool/classrooms/${classroom.id}` : '/preschool/classrooms'}>
          <Button type="button" variant="outline">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Classroom' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
