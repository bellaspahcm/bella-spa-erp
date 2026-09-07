import { getStudentAction } from '@/products/bella-preschool/actions/student-actions';
import { notFound } from 'next/navigation';
import { StudentProfile } from './_components/StudentProfile';

interface StudentProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StudentProfilePage({
  params,
}: StudentProfilePageProps) {
  const { id } = await params;
  const result = await getStudentAction(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <StudentProfile student={result.data} />;
}
