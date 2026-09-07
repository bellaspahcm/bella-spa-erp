'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { createStudentAction, updateStudentAction } from '@/products/bella-preschool/actions/student-actions';
import { ArrowLeftIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';

type StudentData = {
  id?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string;
  notes?: string | null;
};

interface StudentFormProps {
  mode: 'create' | 'edit';
  student?: StudentData;
}

export function StudentForm({ mode, student }: StudentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<StudentData>({
    first_name: student?.first_name || '',
    last_name: student?.last_name || '',
    date_of_birth: student?.date_of_birth || '',
    gender: student?.gender || '',
    notes: student?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let result;
      if (mode === 'create') {
        // Auto-generate student code from first/last name + timestamp
        const studentCode = `${formData.first_name.substring(0, 3).toUpperCase()}${formData.last_name.substring(0, 3).toUpperCase()}${Date.now().toString().slice(-4)}`;
        
        result = await createStudentAction({
          student_code: studentCode,
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender as 'male' | 'female' | 'other' | undefined,
          notes: formData.notes || undefined,
        });
      } else {
        result = await updateStudentAction(student!.id!, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender as 'male' | 'female' | 'other' | undefined,
          notes: formData.notes || undefined,
        });
      }

      if (result.success && result.data) {
        router.push(`/preschool/students/${result.data.id}`);
      } else {
        setError(result.error || 'An error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    field: keyof StudentData,
    value: string | null | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value || '' }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6">
        <div className="space-y-6">
          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <Label htmlFor="last_name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date_of_birth">
                  Date of Birth <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  required
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange('date_of_birth', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  name="gender"
                  value={formData.gender}
                  onValueChange={(value) => handleChange('gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional information about the student"
              rows={3}
            />
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" asChild>
          <Link href={mode === 'edit' ? `/preschool/students/${student?.id}` : '/preschool/students'}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Cancel
          </Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />}
          {mode === 'create' ? 'Create Student' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
