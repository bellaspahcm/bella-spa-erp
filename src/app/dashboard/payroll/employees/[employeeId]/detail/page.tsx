import { EmployeeDetailScreen } from '@/components/payroll/EmployeeDetailScreen';

interface PageProps {
  params: Promise<{
    employeeId: string;
  }>;
  searchParams: Promise<{
    month?: string;
  }>;
}

export default async function EmployeeDetailPage({ params, searchParams }: PageProps) {
  const { employeeId } = await params;
  const { month } = await searchParams;
  
  return <EmployeeDetailScreen employeeId={employeeId} month={month} />;
}
