import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from 'lucide-react';

export default function StudentNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Student Not Found</h2>
      <p className="text-gray-600 mb-6">The student you're looking for doesn't exist or has been removed.</p>
      <Button asChild>
        <Link href="/preschool/students">
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Students
        </Link>
      </Button>
    </div>
  );
}
